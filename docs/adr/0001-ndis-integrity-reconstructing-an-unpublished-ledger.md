# 0001 — NDIS integrity: reconstruct the unpublished ledger

Status: accepted (2026-08-02) — all three sources implemented same day, see Implementation below
Scope: realm-gov-au integrity sources and the lenses built on them

## Context

The question was whether this realm could produce a "Panama Papers of the NDIS" —
a permanent, public, searchable join over published data that surfaces provider
misconduct the fragmented registers hide.

Eight lenses were built and run against live registers. They uncover real
structure: $459m of grants published under reused boilerplate, publication
trailing commencement in 96% of awards, $69.4m running while an NDIS compliance
action was in force, and a working provider/address network layer.

They did **not** uncover NDIS fraud, and a 7-month sweep established why with a
number rather than an opinion: 7,502 funded entities, 1,632 on the charity
register, 24,031 addresses, 2,094 entities screened, and
`addressesWhereAnUNRELATEDNeighbourHasARecord: 0`.

The cause is structural. **We were joining conduct records to the wrong money.**
GrantConnect and AusTender publish grants and contracts — money going to bodies
that may also be NDIS providers. It is not NDIS money. NDIS payments flow through
participant plans, and the NDIA publishes them only in aggregate (by state, by
support class, and as the top-10 providers' *share*). No per-provider figures are
public.

## Decision

Stop trying to observe the NDIS ledger directly. **Reconstruct it from the
counterparties' own disclosures**, and treat the register estate as a time series
rather than a set of snapshots.

Three sources carry this, in build order:

1. **Compliance snapshot diff.** The NDIS Commission compliance register is
   published as dated extracts — eight exist for Feb–Jul 2026 — and this realm
   consumes exactly one. Diffing them exposes what no single extract shows: when
   an action APPEARED (an enforcement event, dated by snapshot even where
   `dateFrom` is blank) and when one DISAPPEARED (revoked, lapsed, or removed).
   The Commission publishes only current state; nobody tracks deletions. Same
   producer shape, eight URLs, no new integration risk.

2. **ACNC Annual Information Statement.** Per ABN, per year, back to 2013:
   `revenue from government`, `revenue from goods and services`, `total revenue`,
   full/part/casual staff and `total full time equivalent staff`,
   `employee expenses`, and a self-declared
   `charity has reportable related party transactions` flag. This is the ledger
   reconstruction: self-reported government revenue MINUS the published
   grants/contracts for that ABN leaves a residual that, for a disability
   provider, is largely NDIS. Derived signals, all arithmetic:
   revenue per FTE (the phantom-services shape — a provider cannot deliver $8m of
   supports with 3 FTE), employee-expense ratio, unexplained government revenue
   (reports millions, appears in no published register), year-on-year revenue
   explosion, and the related-party flag (the plan-manager-steering trace).

3. **ABN Bulk Extract.** Free, no credentials, published XSD. ABN status, entity
   type, GST registration, legal/trading/business names, state/postcode — giving
   entity AGE and alias resolution for EVERY entity, not only charities.

## Consequences

- The strongest fraud signal available from Australian open data is
  **revenue per FTE from a provider's own filing**, not anything in the money
  registers. It is division, needs no model, and no published list computes it.
- Coverage is bounded and must be stated on every surface: AIS is self-reported
  and lagged (FY24 latest), charities only, with reduced obligations for small
  charities. NDIS fee-for-service may be booked under `revenue from goods and
  services` rather than `revenue from government` — both lines must be read, and
  which one a provider uses is itself informative.
- The realm's existing discipline holds and is load-bearing: no risk scores,
  severity in the register's own words, exoneration shown as prominently as
  sanction, and every output a place to look rather than a finding. On the first
  window all four action overlaps were compliance notices, the mildest rung —
  flattening severity would have manufactured four scandals from none.
- `au-provider-network`'s co-location dimension adds nothing to the NDIS question
  on current data and should not be extended further until the ledger sources
  land. It stays because it is correct and cheap, not because it is productive.

## Sources assessed and deferred

AustLII ART/Federal Court determinations (the only source that can show an action
overturned); ASIC published insolvency notices (per-ACN, and ACN derives from ABN
— an Australian company's ABN is its ACN with two check digits prepended); state
tender registers (NSW/VIC/QLD — disability services draw state money too); Fair
Work Ombudsman and FWC underpayment decisions (sham contracting correlates with
billing fraud and the decisions name entities); NDIS SDA enrolled dwellings (known
hotspot, with a physical artifact to verify); adverse media (weakest evidentially,
last, most guardrails).

**Ruled out, with reason:** shared-DIRECTOR networks. No open Australian source
publishes officer or responsible-person names in bulk — ACNC publishes a COUNT
only, and ASIC sells company extracts individually. No lens may imply one.

## Implementation (2026-08-02)

1. **Snapshot diff → `au-register-diff`.** The eight extracts are enumerated LIVE from the
   data.gov.au CKAN catalogue (`datasetCatalogue`, vendored spec `apis/data-gov-au-ckan.yaml` —
   quoted phrase, or Solr ORs the words); any extract is fetched whole via
   `ndisActionsSnapshotRows` keyed `datasetId|resourceId|filename`, so a new extract joins the
   series without a YAML edit. Final surface: register 2,285 → 3,333 rows Feb→Jul; 1,108
   appearances; **12 rows durably left the register while their own published end date had not
   arrived** (9 banning orders, one published to 2036) plus 2 transient one-extract gaps
   (rows that vanished and returned — a different object, split out after one "removal" turned
   up alive two extracts later). Guards that mattered: day-normalize ±1 (two clock renderings),
   rekeyed/renamed detection (a 17-notice batch re-keyed, not removed), end-date within 2 days
   of the extract counts as expiry, and the reappearance check.
   **Reading the narratives** (measured, then made deterministic): compliance-notice narratives
   cite the instrument breached in near-boilerplate and often carry an "on the basis that…"
   clause — both are pattern-extracted VERBATIM (`citesRules`, `statedBasis`). Banning-order
   narratives state the SCOPE of the prohibition and never the conduct — a structural fact about
   the register: **it does not say why anyone is banned.** An `ai.classify` label was tried
   first and misread even explicit citations (Worker Screening cited, labelled otherwise), so
   the LLM label was dropped for the register's own words; `ai.relevant`/`ai.score` remain the
   right tools where the discriminator is genuinely subjective (au-contract-search,
   the ThinDisclosureLargeCommitments view, formerly the au-opaque-spend lens).
2. **AIS → `au-provider-ledger`.** Candidates default to the ACNC's own program taxonomy
   (`programsByClassification`, five disability classes, 1,374 ABNs) because the beneficiary
   flag alone tops the ledger with hospitals and universities; `scope=roll` widens to the
   16,035-charity flag. Naive revenue-per-FTE finds REPORTING ARTIFACTS (fte=0 with $30M
   employee expenses), so the low-staff shape requires low FTE AND low employee-expense share
   AND low grants-made share AND not consolidated, gated on government+goods revenue. First
   run surfaced the SDA-housing-trust cluster (mostly related-party=y) — the hotspot this ADR
   predicted. Residuals are withheld (not zeroed) when a money source fails; the FY24 money
   sweep is MONTHLY-partitioned so each month caches independently and runs converge across
   attempts (a single year-long kg call twice died at the socket / hit the 30-minute backstop).
   First full FY24 result (2026-08-02, COMPLETE, no warnings): across the top-40 residual
   ledger, **$3.41bn self-reported government revenue vs $133m published in GrantConnect +
   AusTender combined** — ~96% of these providers' government revenue is itemized in no public
   register. That gap is the unpublished NDIS/state ledger, now measured per provider. The
   join itself works: 33 of 40 rows matched real GrantConnect grants by ABN.
3. **ABN Bulk Extract → `abrByAbn`** (producers/abr.yml, isolated so older binaries drop only
   it). Needed an engine extension shipped same day: `format: xml` + `recordElement` (streaming
   StAX, zip-of-XML as one file) and `urls:` (one register split across files) on the tabular
   producer, plus lifting the JDK's default JAXP entity-size limit which aborted the real
   extract mid-file. VERIFIED LIVE: 10.2M records streamed from zip 1 in 103s; all probe ABNs
   resolved with status/from-date, entity type and trading names (~4 min cold for the whole
   two-zip register, then per-key cached). First reading: the ABN behind a removed banning
   order resolves to an individual whose registered trading names are a pressure-cleaning
   business — an individual's ABN spans all their sole-trader activity, so this is an alias
   surface to hand a human, never a contradiction by itself.

4. **The prose layer → `au-register-names` + the diff's `followUp` mode (2026-08-03).** The
   register links nothing, but its narratives do — and reading them at corpus scale changed the
   answer to this ADR's original question:
   - **The register DOES state billing fraud, 11 times, in its own words** ("provision of
     falsified and inappropriate claims for payment against the NDIS plans of NDIS
     participants"), 48 rows cite criminal history, and enforcement narratives leak
     officer/attribution edges no bulk source publishes ("key personnel, Ms Berivan Khalil",
     "sole director of Millennium Disability Care").
   - **The prose self-join reveals coordinated cases across rows no field links**: Fine Care and
     AlliedHealth Cleaning Services suspended the SAME DAY with identical falsified-claims
     wording; Berivan Khalil (named in Fine Care's row, attributed to AlliedHealth) banned
     permanently and Hawre Khalil (conduct "on behalf of" AlliedHealth) banned two years, same
     day; both companies then revoked and banned. Five subjects, one operation, visible only in
     the words. The Duggal arc (Healing Hands notice 2023 → company revocation + permanent ban
     2025 → personal bans of BOTH Duggals 2026, one with NO ABN on the row) shows the same:
     ABN-keyed joins cannot reach these people; the prose can.
   - **The pursuit works**: the news index connects removed rows to reality (Ryan Nugara —
     banned to 2027, JAILED per local press Sept 2025, and his row left the public register
     mid-force — the sharpest open question this work has produced for the Commission).
   - Method note, measured: `ai.classify` per-row labels drifted off any closed set and misread
     explicit citations; the aggregation `classify(text, labels)` held the set but still
     mislabelled; `extract()` names + a literal-containment no-fabrication gate + deterministic
     vocabulary counts and attribution-phrase capture proved the reliable shape. LLMs propose;
     the corpus verifies; the register's own words are the output.

Engine defect found and filed (embabel/me#673): an enumerated IN list silently drops a member
containing an apostrophe; `au-provider-ledger` uses pinned equality per class until fixed.
Producer fix: `ndisActionsByAbn.detail` had projected the dead "Other relevant info" column;
the narrative lives in "Relevant information".

## Note on method

Three separate "impossible" calls in this work were wrong, each corrected by one
query against a catalogue API: shared addresses (the ACNC register carries full
street addresses against ABNs), the NDIS ledger (the AIS approximates it), and
entity age (the ABN Bulk Extract is free). Reasoning from recollection about a
dataset instead of asking it was the failure mode every time. **Query the
catalogue before concluding a source does not exist.**
