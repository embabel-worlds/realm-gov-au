# 0001 — NDIS integrity: reconstruct the unpublished ledger

Status: accepted (2026-08-02)
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

## Note on method

Three separate "impossible" calls in this work were wrong, each corrected by one
query against a catalogue API: shared addresses (the ACNC register carries full
street addresses against ABNs), the NDIS ledger (the AIS approximates it), and
entity age (the ABN Bulk Extract is free). Reasoning from recollection about a
dataset instead of asking it was the failure mode every time. **Query the
catalogue before concluding a source does not exist.**
