# The parliamentary record: what this realm does, and the verified upgrade path

## What ships today

`ParliamentMention` (types/parliament.yml) joins contracts and suppliers to pages of the
parliamentary record — Hansard, Questions on Notice, committee and Estimates material — through a
web index **scoped to `site:aph.gov.au`** (producers/parliament.yml, riding the existing Brave
key). Two lenses consume it:

- **`au-contract-deepdive`** Tier 4: two searches, sharpest first — the CN id itself (QoNs cite
  contract notice ids verbatim, so a hit is close to a direct reference), then supplier+agency
  (broad by construction).
- **`au-supplier-profile`**: the supplier's name across the parliamentary record, only when the
  window actually found contracts.

The fencing is the press-coverage discipline plus one addition: a silence here is **doubly**
qualified — nothing found by THIS index for THIS phrase — because the web index holds less than
ParlInfo's own search. No surface may render an empty result as "never raised in Parliament".

## The direct ParlInfo route (verified live 2026-08-01) — the upgrade

ParlInfo has a genuinely consumable **keyless search feed**:

```
https://parlinfo.aph.gov.au/parlInfo/feeds/rss.w3p;query=Dataset:hansardr,hansards Content:"<phrase>"
```

- Returns `application/rss+xml`, one `<item>` per match with `title`, `link` (a permalink into the
  fragment, e.g. `Id:"chamber/hansards/29227/0253"`), and `pubDate`.
- Verified with a live supplier phrase: **15 items**, House + Senate Hansard.
- `Dataset:` accepts a comma list; `qon` is also a valid dataset (verified: a three-dataset query
  returned results).
- **Gotcha 1 — zero results are a 301, not an empty feed.** A query with no matches redirects to
  `search/unexpectedError.w3p` (verified with a nonsense term). A client MUST treat that redirect
  as an honest empty; treating it as a failure makes every no-mention contract look broken, and
  following it blindly yields an HTML error page.
- **Gotcha 2 — the gateway cannot parse it yet.** The learned-API client is JSON-only (no XML/RSS
  mapper) — an ENGINE gap, noted upstream. When it closes, swap `parliamentMentions`' source for
  the direct feed: recall improves (ParlInfo indexes everything; the web index does not), and the
  type, joins and lenses stay untouched.
- OpenAustralia's JSON API was also probed: functional but **registration-gated** (`"No API key
  provided"`), so not usable keyless.

## Why not Acts of Parliament

The Federal Register of Legislation has an API, but contract→Act is a fuzzy name join with no
sharp question behind it. The real "what authorises this spend" chain is contract → program →
appropriation, which is the Portfolio Budget Statements join (see docs/TABULAR-SOURCES.md — PBS
is a `tabular` source).
