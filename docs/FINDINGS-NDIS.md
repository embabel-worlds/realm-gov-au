# NDIS integrity: what the public record actually supports

State as at 2026-08-03. Every claim here is reproducible by running the named lens or view; every
number came from a live run whose rows were read, not from a headline count. Where a screen produced
nothing, that is recorded too — a null result from a verified join is a finding.

**RE-VERIFIED after fixing embabel/me#676** (a comparison inside a `CASE` projection was pushed to
the producer as a fetch filter, silently truncating fetches). Every figure below was re-run against
the corrected engine and is unchanged. That is not luck: these findings rest on `tabular` producers
— the ACNC and NDIS CSVs — which match by key column and support NO predicate pushdown, so the
defect could not reach them. It reached the AusTender *remote* window producer, whose reports were
still JavaScript lenses banding in JS at the time, and which are now views (`views/procurement-shape.yml`).

## 1. Fraud the regulator has already found, and the network its prose hides

The compliance register states billing fraud in its own words **11 times** ("provision of
falsified and inappropriate claims for payment against the NDIS plans of NDIS participants"),
cites criminal history in **48** rows, and states a fraud conviction outright in at least one.

Its narratives also carry the only officer/attribution edges in open Australian data, and reading
them as a corpus (`au-register-names`) reveals coordinated cases **no register field links**:

- **Fine Care Pty Ltd + AlliedHealth Cleaning Services Pty Ltd** — suspended the same day with
  identical falsified-claims wording; **Berivan Khalil** (named as Fine Care's key personnel,
  attributed to AlliedHealth) banned permanently and **Hawre Khalil** (conduct "on behalf of"
  AlliedHealth) banned two years, the same day; both companies later revoked and banned. Five
  register rows, one operation, visible only in the prose.
- **Duggal Services / Healing Hands Complete Care** — compliance notice 2023 → company revocation
  and permanent ban 2025 → personal bans of **both** Duggals 2026, one of whom has **no ABN on
  his row**: a person no ABN-keyed join in existence can reach, and the prose can.

**Structural finding:** across all 780 banning orders, only ~3% state any basis. Banning-order
narratives describe the SCOPE of the prohibition and not the conduct — *the register does not say
why anyone is banned*.

## 2. Deletions nobody tracks

`au-register-diff` over eight dated extracts (Feb–Jul 2026): the register grew 2,285 → 3,333 rows;
**1,108 actions appeared**; **12 rows durably left the register while their own published end date
had not arrived** — nine of them banning orders, one published as running to 2036 — plus two
transient one-extract gaps (rows that vanished and returned). The Commission publishes current
state only, so nothing else in the public record shows this.

**The sharpest single question this work produced:** *Ryan Nugara* — banned to 2027, jailed
according to local press in September 2025, and his row left the public register while the ban was
nominally in force. The register offers no explanation; an appeal outcome, a correction and an
error are indistinguishable from outside.

## 3. The unpublished ledger, reconstructed

The NDIA publishes no per-provider payments. `au-provider-ledger` rebuilds them from the providers'
own ACNC filings: across the top-40 by residual, **$3.41bn of self-reported government revenue
against $133m published in GrantConnect and AusTender combined** — roughly 96% of these providers'
government revenue is itemised in no public register. The join demonstrably works (33 of 40 matched
real GrantConnect grants by ABN); the gap is the unpublished NDIS and state ledger.

## 4. Shapes the regulator has not acted on — and what they are worth

`au-unflagged-risk` screens 1,503 disability-declaring charities on seven arithmetic tests over two
years of their own filings. **51 trip at least one screen; 5 are already in the compliance register;
46 are not.** The 46 are *places to look*, and the honest summary of the follow-up is:

- **No adverse third-party coverage exists for any of the 46.** After a literal name gate (below),
  five had third-party items at all, and those describe a government-brokered rescue (Bedford:
  voluntary administration, acquired by The Disability Trust, 1,100 jobs), a merger (OC Connections
  into Meridia), an aged-care home, and sector explainers. Nothing alleges anything.
- **The workforce-model flip is the most interesting shape.** *Living My Way Limited*: employee
  expenses fell from 94% of service revenue to 17% in one year ($14.4m → $3.2m) while service
  revenue rose to $18.5m and "all other expenses" jumped $1.5m → $15.2m, with staff counts barely
  moving. Three other providers show the same flip. It is lawful, and it is the documented
  precondition of both sham contracting and billing intermediation.
- **The pass-through cohort**: ten providers where 80–100% of expenses leave as unspecified "all
  other expenses". This is where public money's ultimate recipient is named in no register at all.
- **The correction that keeps it honest**: the largest apparent outlier — $29.1m government revenue
  on 2 FTE with 99% pass-through — is mostly **aged care**. Its declared programs are Home Care
  Packages, meals and day care alongside disability, and brokered home care pays most funding out by
  design. Every flagged row now carries its full program mix so this correction is automatic.

## 5. Phoenix check: banned people who registered a business afterwards

`au-phoenix-check` — 495 banned individuals, **311 bans old enough** for a re-registration to be
observable, 14 checked against 2,477 surname-matched ABR records: **one** person holds an active
ABN registered after their ban (+230 days). Its trading names are a piano-tuning business. Piano
tuning is not NDIS work and a banned support worker may lawfully run one — the check works, and its
first hit is benign, which is exactly what makes it credible when a hit is not.

## 5b. What the regulator has told Parliament — and how enforcement is actually shaped

`au-estimates-integrity` searches the Senate Estimates record (ParlInfo) for integrity vocabulary,
keeps pages whose own excerpt uses it, and reads them. Five on-topic pages; **one contains the
pattern this whole investigation was built to look for, stated by an official on the record**
(Community Affairs Legislation Committee, 3 June 2024):

> Senator KOVACIC: … How is it, after that experience, that they are still a provider?
> **Mr Dardo: They're not. We've taken out the provider. We've wiped them out … They're coming
> through as a different provider, a different entity, or they're buying other providers, or
> they're establishing other providers, or they're coming back as an unregistered provider.**

That is official confirmation of phoenixing — and it names the two routes the ABN individual-name
check cannot see: a **new corporate entity** and **unregistered** operation. It reframes
`au-phoenix-check` as the narrow case and `au-unflagged-risk`'s "first filing already at scale"
screen as the corporate-entity analogue. February 2026 Estimates adds the regulator's own framing
that compliance actions are fraud PREVENTION ("things that are early on so that we can prevent the
fraud actually occurring"), and June 2026 shows senators raising integrity allegations about
individuals they are directed not to name.

No provider is named in any of these excerpts — the venue's confidentiality convention, not
evidence that none exist. The status is PARTIAL by design: ParlInfo caps each phrase at 8 pages, so
every count is a floor.

## 5c. The compliance-notice register is six mass audit batches

Clustering all 2,118 compliance notices (`cluster()`, then verified arithmetically because a model's
cluster label is not evidence):

- **93% (1,977) cite section 73J — the audit obligation.** Not conduct toward participants.
- **Seven days carry 1,936 of the 2,118 notices (91%)**: 775 effective 2026-01-30, 433 on
  2025-08-13, 307 on 2025-08-28, 151 on 2025-03-28, 149 on 2025-11-14, 100 on 2026-03-30, 21 on
  2026-03-26. The six largest alone account for 1,915 (90%). (An earlier draft said "six dates,
  ~90%"; the seventh day exists and is named here.)

**Consequence for every other surface**: a provider's presence in the compliance register is weak
evidence about that provider — it may mean only that it sat inside a mass audit-obligation batch.
That caveat is now carried by `au-provider-ledger` and `au-unflagged-risk`, and the counts are
published as `enforcementShape` in `au-register-names`.

## 5d. The register does not say what criminal history it acted on

Of the 47 banning orders whose narrative mentions criminal history, `classify()` (closed label set,
47/47 in-set) puts **35 in "unstated"** and 12 in "other" — none in a specific category. Reading the
narratives confirms why: the text says *"the delegate had regard to X's criminal history"* and stops.
The Commission bans people on criminal history without publishing what the history was.

## 5e. Reading the arrivals, the providers' own words, and the tribunal record

All three now run as VIEWS (`views/ndis-reading.yml`), no JavaScript.

**The arrivals (1,108 across the series; 134 in the latest pair).** `NdisNewEnforcement` diffs two
extracts by set difference and flags the instrument each new action cites; `NdisNewEnforcementRead`
reads the 28 banning orders and revocations among them. The pattern matches the opacity finding:
**revocations state a reason** (audit or registration failure, `statesAReason: true`), while new
**banning orders mostly state none** — split between worker screening and criminal history, with
`statesAReason: false` on nearly all.

**What providers say they do.** The AIS carries one free-text field ("how purposes were pursued",
96% filled) that had never been projected. Reading it against the pass-through cohort is the
sharpest pairing in this document: **seven of the eight providers whose money leaves as 80–100%
unspecified "other expenses" describe themselves as delivering services DIRECTLY** — "We provide
attendant carers services", "We provide community Support Services to older people, people with
disabilities and carers" — while booking almost nothing as wages. A brokerage description would
explain the shape; a direct-delivery description does not. (One, Community Connections, describes
only its mission, so the label is honestly `not-stated`.)

**The tribunal record does NOT corroborate the workforce flip.** `NdisFlaggedProviderLegalTrail`
pairs each flip provider with austlii.edu.au (exact quoted name, OPTIONAL MATCH so a provider with
no documents still appears with zero). All four return **0 documents**, so the flip stands as an
unexplained shape and nothing more — no employment or underpayment matter supports reading it as
sham contracting. For contrast the same search returns 8 documents for a large provider (Yooralla),
all governance and legislative, with no employment matter.

A negative result about a named organisation is itself a claim, so it was verified twice. The first
verification was WRONG and is worth recording: `apiCalls: 0` was read as "the search never ran",
producing a filed engine issue (embabel/me#675) that had to be closed. It was a shared-CACHE hit
serving a previously cached negative, which the log line beside it stated plainly
(`[cache] … 0 memo, 1 shared`). Re-tested with never-searched phrases, both seeding shapes fetch
correctly. **`apiCalls: 0` is ambiguous between "not fetched" and "served from cache"; the cache
line disambiguates it, and a cached negative must never be mistaken for a broken join.**

## 6. External corroboration — of the cohorts, never of individuals

Published reporting independently identifies the populations these screens isolate: the government
has referred ~4,000 providers to the ACCC over questionable billing (funds spent on float tanks and
golf lessons), rejected 8,000+ plan-manager claims in nine months, and the ABC's "rorts playbook"
describes billing for undelivered services and parking clients in supported accommodation to drain
plans — the intermediary and SDA cohorts. **None of that is evidence about any entity named above**,
and the lenses discard it rather than attach it.

## 7. Errors this work made, and the guards that now prevent them

Recorded because each was caught by reading rows, and each would have produced a false story:

| Error | How it surfaced | Guard now in place |
|---|---|---|
| `ai.relevant` passed generic sector articles as entity-specific, stamping "reports an allegation" on four innocent providers | reading the digests | items must LITERALLY name the entity; generic coverage is discarded, never judged |
| Name gate ranked tokens by length, gating "Giant Steps Melbourne" on *melbourne* and "Para-Quad Tasmania" on *tasmania* — an unrelated compliance story matched | unit-testing the gate against real retrieved titles (5 of 24 cases failed) | gate is the leading distinctive phrase; places and sector words can never lead; boundary-safe; concatenation-aware |
| Phoenix zero was meaningless — the sample was bans a few weeks old | asking what the zero could possibly show | `seasonDays` (≥270) and `abrRecordsMatchedBySurname` published so a broken join can't masquerade as a clean cohort |
| Surname parsing missed "TANTS, Jacob Alfred", "Rabnott (Orpin)", "Wardle aka Brenecki" | reading the subject list | all three name forms parsed; every plausible surname searched |
| "Gone dark" screen could never fire — candidates came from the very file that excludes non-filers | the screen returned exactly 0 | candidates drawn from FY23 **and** FY24 program files |
| An entity's own marketing summarised as if it were coverage | reading a digest praising an award | self-published hosts split out and never summarised |
| Per-row `ai.classify` would not hold a closed label set and misread explicit citations | comparing labels to the narratives | deterministic verbatim extraction of the register's own citations |

## What would move this forward

AustLII decisions for the workforce-flip cohort (a Fair Work underpayment matter would corroborate);
prior-year AIS back to 2013 for trajectories; state tender registers; the NDIA's SDA enrolled-dwelling
counts against published SDA price limits; and putting the Nugara removal, and the 12 durable
removals generally, to the Commission.
