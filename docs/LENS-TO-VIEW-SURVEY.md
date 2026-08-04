# Lens → view survey

Views are Plan A. This is a per-lens verdict on the 40 remaining lenses, measured rather than
eyeballed: every lens's script was counted for `gateway.kg.query` calls, other gateway calls, date
parsing, regex use, and whether it builds a `headline` envelope, and the promising ones were read.

Why it matters, from today: `au-opaque-spend` post-processed rows in JavaScript and **both** apps
carried their own copy of that screen for demo mode — three copies of one rule, and the sort key
silently diverged between them. A view has one statement and nowhere for a second copy to live.

The four things a lens does that a view cannot, which decide every verdict below:

| Blocker | Why | Affects |
|---|---|---|
| **Another gateway** — `fetch`, `ingest`, `referenceDocs`, `agLobbyists`, `ai.complete` | a view is one Cypher statement; it cannot call the web, ingest a document, or synthesise prose | 7 lenses |
| **Arbitrary-character normalisation** — `toUpperCase().replace(/[^A-Z0-9]/g,'')` | Cypher `replace()` takes a literal, so only NAMED separators can be stripped; there is no character-class replace without APOC | 6 lenses |
| **Published date formats** — `new Date('9-July-2026')` | no reachable Cypher function parses these | 5 lenses |
| **Envelope shape** — `headline` + rows + `limits` in one payload | a view returns ONE row shape | ~20 lenses, and it is the cheapest to solve: a second summary view, as `ndis-integrity.yml` already does |

---

## Tier 0 — already superseded by an existing view. Delete after a field check.

These were written as lenses before the equivalent views existed. Same window, same arithmetic.

| Lens | Superseded by | Apps to convert first | Check before deleting |
|---|---|---|---|
| `au-grounds` | `LimitedTenderGrounds` | moneytrail, signal-room (+ demo data) | the lens also aggregates per agency; the view returns `agencies` as a count |
| `au-new-suppliers` | `NewSuppliersInWindow` | moneytrail | comparison-window semantics identical? |
| `au-tax-vs-contracts` | `SupplierTaxTransparency` | moneytrail, scrutiny-room | the view carries the two legislated caveats; confirm the lens says nothing more |

**These are not free deletions.** Every one is referenced by at least one app, so each costs what
`au-opaque-spend` cost: point the app's renderer at view ROWS, replace its demo path with one that
does not re-implement the screen, update the manifest, and fix the tests that assert the old
envelope's wording. Measured on `au-opaque-spend`: two apps, ~150 lines, and three test suites
touched. The *duplication* removed is the return, not the deletion itself.

## Tier 0b — PARTIALLY superseded. Extend the view, then delete the lens.

Measured field-by-field, so these are not drop-in deletions:

| Lens | Existing view | Missing from the view |
|---|---|---|
| `au-concentration` | `SupplierConcentration` | grouping by **category family** (the lens cuts per agency AND per family), the top supplier's NAME, and the `soleSupplier` flag. All expressible: `left(code,4)` for the family, `collect(...)` for the name, `supplierCount = 1` for the flag |
| `au-money-by` | `ContractsBySize`, `ContractsByMethod` | the **category** cut — the lens groups by UNSPSC sector with example codes. Nothing covers it today |

## Tier 1 — straight port. One rows view, plus a summary view where an app shows totals.

Post-query JS is grouping, summing, share-of-total, rounding and sorting — all of which now exist in
Cypher in `procurement-shape.yml`. `ai.*` is fine in a view.

| Lens | Note |
|---|---|
| `au-year-end-rush` | May-vs-June comparison; a `CASE` month split is safe again since me#676 and the projection fix |
| `au-short-dated` | one date arithmetic on ISO fields, expressible with `duration` |
| `au-contract-search` | already 4 `ai.*` calls and almost no post-processing — the closest thing to a view already |
| `au-evergreen` | two `new Date` uses on ISO values only |
| `au-money-trace` | single query; the envelope is the only lens-shaped part |
| `au-integrity-screen` | single query + screens; check whether its name matching needs normalisation |

## Tier 2 — port, but not as one statement.

| Lens | Why | Shape |
|---|---|---|
| `au-agency-profile`, `au-supplier-profile` | 3 and 2 queries | a rows view + a summary view; profile is a UI composition, not one answer |
| `au-amended-up` | 2 queries — window, then the version chain per notice | needs the chain as a second view, or accept two invocations |
| `au-contract-passport`, `au-contract-deepdive` | 1 and 4 queries, deliberately tiered output | these are DOSSIERS. A view per tier is possible; whether that is better than one lens is a judgement call, not a defect |
| `au-portfolio-themes` | 3 queries + a seeded spine join | portable, but the join makes it two views |
| `au-accountability-gap`, `au-threshold-clusters`, `au-window-signed` | single query, but supplier grouping uses character-class normalisation | blocked on the normalisation gap below |

## Tier 3 — genuinely a lens. Keep.

**Another gateway:** `au-hansard-index` and `au-parliament` (fetch + document ingest), `au-hansard-rag`
and `au-said-vs-signed` (vector search + `ai.complete` prose), `au-grant-overlap` (`ai.complete`),
`au-supplier-lobbying` (the lobbyist register API). `au-ask` writes and runs Cypher — it is the
generator, not a query.

**Fuzzy identity and published-format dates:** `au-register-diff` (7 date parses, 12 regex — the
dd/mm/yyyy-to-ISO change mid-series lives here), `au-register-names`, `au-phoenix-check` (surname
parsing, aka/bracket forms), `au-provider-ledger`, `au-unflagged-risk` (437 lines, 15 regex),
`au-shared-premises`, `au-provider-network`, `au-grant-hop`, `au-grant-access`, `au-grant-boilerplate`,
`au-grant-theme`, `au-estimates-integrity`.

These are where the JavaScript earns its place: matching a name spelled four ways, parsing
`9-July-2026`, walking a version chain with date tolerance. A view would be a worse expression of it.

---

## The engine asks that would move the line

1. **A normalisation scalar** — `normalize(s)` / `slug(s)` reducing to `[A-Z0-9]`. Unblocks exact
   name grouping in ~6 lenses. Note `apoc.text.replace` is a FUNCTION, not a procedure, so the
   scope rewriter's ban on `CALL`/procedures may not apply to it — worth establishing before
   building something new.
2. **A published-date parser** — `parseDate(s, 'd-MMMM-yyyy')`. Unblocks the grant lenses, which are
   otherwise pure arithmetic.
3. **Nothing else.** Aggregation, banding, share-of-total, nested `collect`, `ai.*` gating and
   two-window comparison are all already expressible — several were proven today.

## Suggested order

1. Tier 0 (3 deletions) — no new QUERY code, but each carries an app conversion; `au-new-suppliers`
   is the cheapest (one app) and the right one to do first.
2. Tier 0b (2 view extensions, then 2 deletions) — small, and `au-money-by`'s category cut is a real
   gap in view coverage today.
3. Tier 1 (6 ports) — mechanical now that the patterns exist.
4. Decide on the normalisation scalar; if it lands, Tier 2's last three become Tier 1.
5. Leave Tier 3 alone.

Every deletion needs the same check `au-opaque-spend` needed: which apps reference it
(`grep -rn '<lens-id>' apps/`), and does its demo path carry a second copy of the screen.
