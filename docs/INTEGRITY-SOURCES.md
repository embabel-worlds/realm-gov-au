# The integrity registers: what is joined, what is not, and why

## The gap this exists to fill

**There is no federal debarment register.** Grepping the Commonwealth Procurement Rules for
`debar|exclud|blacklist|banned` returns nothing; the only mechanism is **CPR 6.9**, which says
officials *"should seek declarations from all tenderers"* about unsatisfied employee-entitlement
judgments. The entire mechanism is tenderer **self-declaration**. `au-integrity-screen` is the
check that replaces it with published registers.

## Wired (verified live 2026-08-01, all keyless)

| Source | Producer | Key | What it gives |
|---|---|---|---|
| NDIS Commission compliance actions | `ndisActionsByAbn` | ABN (83% fill) | 3,333 rows: banning orders, revocations, suspensions — **with effective dates**, so "in force during the contract" is checkable |
| Modern Slavery Register bulk export | `slaveryStatementsByAbn` | ABN | 22,016 statements; the useful signal is the NEGATIVE join |
| ATO corporate tax transparency 2023-24 | `taxRecordByAbn` | ABN | 4,198 entities ≥ $100M income; CC-BY |
| GrantConnect published awards | `grantsPublishedRecently` | (whole window) | ~10,500 awards per 90-day window, with DELIVERY postcode |

All are `tabular` producers: lazily fetched on first traversal, deployment-cached, `keyMatch:
digits` (the same ABN is published spaced, unspaced, numeric and float across this estate).

## Assessed and NOT wired — and what unblocks each

| Source | Blocker | Unblocks with |
|---|---|---|
| **WGEA named non-compliant** | 2024-25 is a **PDF**; 2023-24 is inline HTML. The bulk dataset is a 74MB **ZIP** of CSVs | a zip-aware tabular format, or a PDF-extract step. **Highest-value miss**: non-compliance is a statutory *eligibility breach* under the WGE Procurement Principles |
| **ABF sanctioned sponsors** (1,811 rows, clean ABNs) | JSON only via **POST with body `{}`**; endpoint path discoverable only from inline page config | a `remote` producer with a POST op — the realm's OpenAPI surface can express this |
| **Payment Times Register** | filename is date-stamped and must be scraped from an inline JS variable | a two-step producer (scrape → fetch), or a `{today}`-style pattern if the naming stabilises |
| **ASIC banned & disqualified (orgs)** | ACN only, no ABN | an ACN→ABN bridge (ASIC company dataset carries both) |

## Engine gaps found while building these (both fixed)

1. **Enumerated seeds.** `WHERE q.abn IN ['a','b']` marked the anchor *bound* but seeded nothing,
   so a batch screen returned a silent zero while the identical query written one ABN at a time
   worked. Fixed: an enumerated IN now mints one virtual anchor per literal (the batch form of a
   pinned equality) — and it must survive an **AND compound**, because the scope rewriter appends
   `AND (userId = … OR …)` to every production query.
2. **Row identity for identifier-less registers.** A record without the target label's identity
   property is silently skipped by the materializer. The NDIS CSV's `Provider Number` is blank on
   98% of rows, so the register produced nothing. Fixed: `rowIdAs` on the tabular producer
   synthesizes a deterministic per-row id.

A third, realm-side and just as silent: **GrantConnect's `GO ID` is the grant OPPORTUNITY**, shared
by every award under it — using it as the award identity MERGEd 10,473 awards down to **261**. The
award id is `GA ID`.

## Rules every consuming lens carries

- A register entry is about an **entity matched by ABN** — never a finding about a contract. An
  ABN can be shared across a corporate group or transferred.
- A miss is **"not in this register, as at its snapshot"** — never "clean".
- ATO: a **blank** taxable income or tax payable means **≤ $0 by legislation** (amounts of zero or
  less may not be reported), never "unknown"; the report is **entity-level**, not consolidated
  groups.
- Modern Slavery: joint statements pack several ABNs into one cell, which digits-matching cannot
  split — a joint-statement member may read as unlodged.
- NDIS: the dataset is a dated **snapshot**, and the Commission publishes each as a separate
  dataset — a pipeline pinned to one slug goes stale silently. The lens shows the snapshot date.
