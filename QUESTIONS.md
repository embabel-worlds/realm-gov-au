# Questions this realm answers that other systems can't

*The demo script, and the honest boundary around it. Every figure quoted below was measured
against the live registers on 2026-08-01 — see the measurement note at the end for exactly what
has been run and what is designed-but-not-yet-executed.*

## Why these are hard elsewhere

The AusTender API filters by **id and date, and nothing else** — no agency, supplier, ABN, value
or text search exists. So every incumbent (Tendertrace, AwardedTenders, Intermedium, and the
official site itself) either mirrors the register into a warehouse and searches *that*, or can't
answer the question at all. Four consequences, and they're the whole differentiation:

1. **No portfolio, no ground text, no lobbying, no member** — the contract feed publishes an
   agency *name string* and a two-letter reason *code*. What portfolio that agency sits in, what
   the code means, whether the supplier is on the lobbyist register: all live in other registers,
   and nobody joins them.
2. **Structured fields and free text are searched separately** — a value-delta query and a text
   search are different products everywhere else. Here they're one query.
3. **Amendments are a time series, not a row** — most surfaces show the current value. The
   register publishes every version.
4. **Absence is never earned** — a dashboard that can't resolve an agency silently drops it. Here
   an answer states how much value it could *not* place.

---

## 1. Portfolio and agency context — the join AusTender structurally cannot make

> **"What did the whole Health portfolio sign last month, and which agencies inside it?"**

AusTender has no portfolio field. None. The concept exists in AGOR (a different register, CC BY),
and this realm seeds all 17 portfolios and 195 primary bodies as persisted nodes, so:

```cypher
MATCH (w:PublicationWindow {window:$window})-[:PUBLISHED]->(r:ContractRelease)
MATCH (a:Agency) WHERE r.agencyName = a.name OR r.agencyName IN a.austenderAliases
MATCH (a)-[:IN_PORTFOLIO]->(p:Portfolio)
RETURN p.name, count(r) AS contracts, sum(toFloat(r.amount)) AS committed
ORDER BY committed DESC
```

Related asks on the same spine:

- *"Which portfolio commits the most contract value per staff member?"* — joins AusTender value
  to AGOR's Average Staffing Level and appropriations. Neither register can answer it alone, and
  no product carries both.
- *"How much of last month's value could you NOT place in a portfolio?"* — the honesty question.
  19 of 21 observed agency names matched AGOR exactly; the rest are alias drift (`Austrade`, and
  program-level names like *Department of Foreign Affairs and Trade – Australian Aid Program*).
  The answer states the unplaced remainder instead of quietly dropping it.

## 2. Why a contract skipped open tender — codes made legible

The register publishes a two-letter code and its own verbatim text. This realm harvested **20
distinct codes** from 1,226 live releases and seeded them, so the codes become countable *and*
quotable:

> **"Which ground do agencies most often use to skip open tender, and what does it cost?"**

```cypher
MATCH (w:PublicationWindow {window:$window})-[:PUBLISHED]->(r:ContractRelease)
MATCH (g:ProcurementGround {code: r.exemptionCode})
RETURN g.code, g.text, count(r) AS contracts, sum(toFloat(r.amount)) AS committed
ORDER BY committed DESC
```

Measured over five days of live data (1,226 contracts, **$2.58B**):

| Ground | Contracts | Value |
|---|--:|--:|
| `AM` — *"Paragraph 2.6 was applied in some part"* | 18 | **$1.25B** |
| `LP` — leasing of immovable property | 8 | $53.4M |
| `GE` — from another government entity | 12 | $38.7M |

**Eighteen contracts carrying one exemption code account for roughly half the value in the
window.** That is a fact about a public register that no product surfaces, and it took one join.

Also on this spine:

- *"Show me every contract where the agency recorded that it did not comply with the procurement
  rules."* — the `DC` code exists and is real: **1 contract, $159,242** (Defence, photographic
  equipment) in the scanned window. Vanishingly rare, which is exactly why nobody looks — and why
  a system that can ask is worth having. The honest framing is "the register records this
  disclosure", never an accusation.
- *"Which agencies use 'no reasonable alternative supplier' most, by value?"* (`ER`/`TR` grounds).
- *"What share of value went to limited tender?"* — **58.2%** in the scanned window ($1.50B of
  $2.58B). A denominator most commentary asserts and few compute.

## 3. Amendments as a time series, joined to *why*

> **"Which contracts grew the most past their original commitment — and what ground was used to
> award them in the first place?"**

Two hops the register supports and nobody combines: the change feed says *which* notices amended;
each notice's version chain gives original vs current; the ground code says how it was awarded.

```cypher
MATCH (w:ChangeWindow {window:$window})-[:CHANGED]->(r:ContractRelease)
WHERE 'contractAmendment' IN r.tags
MATCH (n:ContractNotice {cnId: r.cnId})-[:HAS_VERSION]->(v:ContractVersion)
OPTIONAL MATCH (g:ProcurementGround {code: r.limitedTenderReasonCode})
RETURN r.cnId, min(v.releaseDate), max(v.releaseDate), g.text
```

Verified live: **CN3942784 went $402,526,031 → $736,309,011** across three amendments — a
Services Australia contract awarded by limited tender on ground `AD` ("additional deliveries by
original supplier… for compatibility"). Growth *and* the stated reason for sole-sourcing, in one
answer, with both sources cited.

- *"Do limited-tender contracts amend upward more often than open-tender ones?"* — answerable
  with a denominator. Report it as an association and nothing more; the register cannot support a
  causal claim and the answer must not imply one.

## 4. Structured fields × free text — the needle

> **"Find contracts whose description records a repayment, but whose recorded value never
> changed."**

This is the CN4118426 case generalised: the Deloitte assurance review's $97,587.11 repayment
exists **only in the description text**; the contract value was never amended. A value-delta query
returns nothing. A text search finds the words but not the contradiction. One governed query does
both — and cites which field each half came from.

Honest calibration: **zero** such descriptions appeared in the 1,226-release scan. This is a
needle by nature, not a routine report. That it can be asked at all is the point.

- *"Which contracts describe work that doesn't match their UNSPSC category?"* — `ai_classify` over
  the description against the structured code. A model judgment, labelled as one.
- *"Anything about cyber security uplift this month"* — `ai_relevant` / `ai_score` semantic
  narrowing, which the app always renders beside the deterministic keyword mode so a user can see
  which kind of answer they're getting.

## 5. Three registers in one question

> **"Which of this agency's biggest suppliers appear as clients on the federal lobbyist register,
> and do those firms employ former government representatives?"**

AusTender → the Register of Lobbyists → each firm's declarations, with the register's own
`isFormerRepresentative` flags. The join is **by name** (the register publishes no client ABNs)
and the answer says so, showing the matched strings and their confidence. Absence means absent
*from the third-party register*, which exempts in-house lobbyists by design — never "does not
lobby".

## 6. Questions about the answer itself

No incumbent can even represent these, because their answers have no provenance model:

- *"Which parts of that answer came from a model rather than the register?"*
- *"What did you fail to fetch, and what would the number be if it had succeeded?"*
- *"As at when?"* — every hop carries its own as-at date, because the registers refresh on
  different cadences (AusTender business-daily, the lobbyist register on registration events,
  AGOR quarterly).

---

## What this realm deliberately will not answer

- **Where the work is delivered.** The contract feed has no delivery location — verified by a
  field census across 200 releases: the only address is the supplier's *registered* address,
  which for a national supplier is a head office. Any "where the money lands" map built on it
  would be a map of corporate HQs. (GrantConnect *does* publish `Delivery State/Territory` and
  `Delivery Postcode` — so that question belongs to the grants hop, not this one.)
- **Whether any contract was over budget.** AusTender records commitments; budgets are a
  different document.
- **Any characterisation of a person, supplier or agency.** A limited tender, an amendment, a
  lobbying relationship and an electorate are all sourced facts. The system reports them and
  stops.

## Measurement note

Every figure above was measured against the live registers on 2026-08-01 by direct API fetch —
the $2.58B/1,226-release census, the exemption table, the 58.2% limited-tender share, the `DC`
contract, the CN3942784 chain and the 19/21 agency-name match are all real. The **Cypher
traversals are designed but have not yet been executed against a booted world**: this realm was
registered in the dev world after the last app start. First live run of the portfolio and ground
joins is the outstanding verification, and one open question is whether the planner binds a
virtual row's property (`r.agencyName`, `r.exemptionCode`) against persisted seeded nodes in a
single query, or whether those need expressing as virtual joins instead.
