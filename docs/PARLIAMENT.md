# The parliamentary record: direct ParlInfo search

## What ships (upgraded 2026-08-01 — the `feed` producer closed the XML gap)

`ParliamentMention` (types/parliament.yml) joins contracts and suppliers to the parliamentary
record through **ParlInfo's own keyless RSS search** (producers/parliament.yml), one producer per
record class, selected by the edge's `via`:

| via | dataset | what it holds |
|---|---|---|
| `chamber` | `hansardr,hansards` | House + Senate debates |
| `committees` | `commsen,commjnt` | Senate + joint committee evidence |
| `estimates` | `estimate` | **Senate Estimates transcripts — the accountability venue** |
| `estimates-period` | `estimate` + `Date:` | Estimates WITHIN a date range (composite key `phrase|fromIso|toIso`) |

Consumers:

- **`au-contract-deepdive`** Tier 4: the CN id across all three classes (QoNs cite notice ids
  verbatim; they surface through committee documents), then supplier+agency against Estimates.
- **`au-supplier-profile`**: the supplier's name against Estimates **date-filtered to the
  profile's own window** — "was this supplier before Estimates during the period" as a checkable
  claim.

Fencing: a match is a page where the phrase appears, never evidence about a contract. A silence
is qualified per record class — and because Questions on Notice are NOT yet searchable (below),
no surface may render an empty result as "never raised in Parliament"; only "not found in these
records".

## Verified source behaviour (live probes 2026-08-01)

- Keyless RSS: `https://parlinfo.aph.gov.au/parlInfo/feeds/rss.w3p;query=Dataset:<list> Content:"<phrase>"`
  — title / link / pubDate per item. 15 items for a live supplier phrase against `estimate`.
- **Date filter works**: `Date:dd/MM/yyyy >> dd/MM/yyyy` (13 of 15 items in a 7-month range).
  Percent-encoded slashes accepted.
- **Zero results are a 301** to `search/unexpectedError.w3p`, not an empty feed — the producer's
  `redirectMeansEmpty: true` maps it to an honest empty.
- The engine-encoded URL forms (spaces/quotes/`>>` percent-encoded) verified against the live
  service: 200 with items, and the zero-result 301, both reproduce exactly.
- `pubDate` carries numeric offsets (`+1000`); the engine normalizes to ISO instants.

## Open items

- **Questions on Notice as a standalone dataset**: `qon`, `qanda`, `qonsw` all error as sole
  datasets (probed). QoN citations still surface via committee documents; finding the right
  dataset name (or confirming QoNs are not in the RSS surface) is the remaining recall gap.
- **Semantic search over Estimates** — the corpus proposal (`me` repo,
  specs/CORPUS_INDEXING_PROPOSAL.md): realm-declared vector indexing of transcript pages, for
  which these feed producers are the fetch layer. Estimates is paraphrase; keyword search
  structurally misses "advisory services" ≈ "remuneration of external consultants".

## Why not Acts of Parliament

The Federal Register of Legislation has an API, but contract→Act is a fuzzy name join with no
sharp question behind it. The real "what authorises this spend" chain is contract → program →
appropriation: the Portfolio Budget Statements join (docs/TABULAR-SOURCES.md — PBS is a
`tabular` source).
