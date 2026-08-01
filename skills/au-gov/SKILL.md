---
name: au-gov
description: >-
  Answer questions about Australian Government contracts and lobbying from the AusTender OCDS
  register and the federal Register of Lobbyists. Use for "what did agency X sign", "how did
  contract CN… change", "who supplies the Commonwealth", or "is this supplier a lobbying client".
---

# Australian Government procurement

## Route by question shape

- **One contract's story** ("what happened to CN3942784", "did this contract grow"): run the
  `au-contract-passport` lens, or traverse
  `MATCH (n:ContractNotice {cnId:'CN…'})-[:HAS_VERSION]->(v:ContractVersion) RETURN v ORDER BY v.releaseDate`.
  Growth = last amount over first. Always read `v.description` too — repayments and variations
  sometimes exist ONLY there, never in the value fields.
- **A period** ("what was signed last week", "biggest contracts in July"): `au-window-signed`
  lens, or anchor `PublicationWindow {window:'2026-07-21T00:00:00Z/2026-07-28T00:00:00Z'}`.
  Keep windows under ~2 weeks — the walk caps at 1,200 releases and a capped result is PARTIAL.
- **What changed** ("which contracts were amended this month"): anchor `ChangeWindow` the same
  way and filter `WHERE 'contractAmendment' IN r.tags`; then pin each interesting `cnId` as a
  `ContractNotice` for its before/after.
- **Agency or supplier cuts**: the source cannot filter by them — fetch the window, then WHERE
  on `agencyName` / `supplierName` / `supplierAbn`. Never claim a supplier's or agency's total
  from a capped window.
- **Lobbying** ("is Acme a client of a lobbyist", "former officials at their lobbying firm"):
  `au-supplier-lobbying` lens. It matches by NAME (the register has no client ABNs) and says so.

## Discipline (non-negotiable)

- Amounts are contract COMMITMENTS as published — never call them spending.
- `limitedTenderReason` is the agency's stated ground: quote it, attribute it, never assess it.
- The lobbyist register is THIRD-PARTY only: "no match" means absent from that register, nothing
  more. `isFormerRepresentative` is the firm's declaration — report it as one.
- Fetch failure ≠ zero. If a producer warned, the count is unproven — say so.
- Never characterise: an amendment, a limited tender or a lobbying relationship is a sourced
  fact. No "concerning", no "suspicious", no rankings dressed as findings.
