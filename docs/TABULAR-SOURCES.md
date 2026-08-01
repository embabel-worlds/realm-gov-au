# Tabular sources, and how they should be cached

*The capability gap holding back the most valuable remaining hops, and the design for closing it.
Written after seeding grants was tried and correctly rejected.*

## The problem

Several of the highest-value Australian registers publish **no API** — only CSV or XLSX:

| Source | Format | Size | Cadence | Join key | What it unlocks |
|---|---|---|---|---|---|
| **GrantConnect** grant awards | XLSX report | ~1.3MB / 7k rows per month | daily | Recipient **ABN**, **delivery postcode** | Where money is actually SPENT — the only honest basis for a geographic or electoral claim (delivery differs from the recipient's address in **99.4%** of grants) |
| **Modern Slavery Register** | CSV per year | 0.9–1.8MB / ~2–3k rows | as lodged | **ABN, ACN, ARBN** + `ReportingEntities`/`IncludedEntities` | Corporate GROUP STRUCTURE, self-declared, zero entity resolution |
| **AEC** donations & returns | CSV bundles | ~26MB zip | annual (Feb) | names only | Donations ↔ suppliers (name match) |
| **ATO** corporate tax transparency | CSV | small | annual | **ABN** | Tax paid by large suppliers |
| **IP Australia** IP RAPID | CSV in a 1.3GB zip | large | weekly | **ABN** (80% fill for orgs) | What a supplier actually does |

None can be reached today: the twelve producer kinds are JSON-, SQL-, file- or model-shaped, and
none parses tabular data.

## What we will NOT do

**Seed them into `reference/`.** Reference data is for small, slow-moving catalogues — electorates
(150, fixed until an election), agencies (195), reason codes (20), UNSPSC titles (586). A feed
seeded as reference goes stale the moment it is written, bloats the pack, and bypasses the
TTL-cache machinery built for exactly this.

It also breaks: SnakeYAML rejects a document over ~3MB, and the realm loader then drops the **whole
file** with one terse "loading problems: 1". 7,067 grants vanished that way with no other signal.

`reference/banned-persons.yml` is the boundary case that stayed: **1,951 in-force ASIC bans**
(filtered from 7,202 — an expired ban is history, not a risk signal), 0.5MB, monthly. That is a
catalogue. 5,592 modern-slavery statements at 2.6MB is a feed wearing a catalogue's clothes.

## The design: a `tabular` producer with two cache layers

```yaml
- name: grantsByRecipientAbn
  kind: tabular                    # NEW
  url: "https://www.grants.gov.au/Reports/GaPublishedDownload?...&DateStart={from}&DateEnd={to}"
  format: xlsx                     # csv | xlsx | tsv
  headerRow: auto                  # these files carry a provenance banner above the real header
  userAgent: browser               # GrantConnect's WAF 403s a bare client — see the gotchas
  keyColumn: "Recipient ABN"       # what a query anchors on
  project:
    recipient: "Recipient Name"
    value: "Value (AUD)"
    deliveryPostcode: "Delivery Postcode"
    deliveryState: "Delivery State/Territory"
  cache:
    file: { seconds: 21600, conditional: true }   # the DOWNLOAD — ETag / If-Modified-Since
    records: { kind: ttl, seconds: 3600 }         # the per-key RESULT, as today
  maxRows: 200000                  # refuse to OOM on a source that balloons
```

**Layer 1 — the file.** Download once per TTL, deployment-wide rather than per-user (these files
are public and identical for everyone, like the API spec cache). Honour `ETag`/`Last-Modified` so a
refresh is usually a 304. Key by resolved URL, so a date-windowed report caches per window.

**Layer 2 — the records.** Parse once into an index on `keyColumn`; per-key lookups are then a map
hit. The existing `ProducerResultCache` already does this half — a tabular producer only has to
produce records in the shape it expects.

**Lazy by construction.** Nothing downloads until a query traverses that edge — the same contract
as every `remote` producer.

## Why this is small

Parsing is the only new code. Keying, pushdown, per-key caching, rate budgeting, provenance and
partial-result semantics all already exist and are shared with `remote`. The files are small in
memory (7k rows ≈ a few MB of heap); the 3MB problem was YAML seeding, never the data volume.

## Gotchas already measured

- **GrantConnect WAF**: a bare `curl` gets 403; a full browser `User-Agent` gets 200. The producer
  needs a declarable UA.
- **Provenance banner**: AusTender's and the AEC's CSVs put a generation banner *above* the header
  row — hence `headerRow: auto`. That banner is also the source's own as-at stamp and should ride
  into the hop's provenance.
- **XLSX is a zip**: shared strings plus sheet XML; no external library needed for a flat sheet.
- **Freshness is the honest part**: the download timestamp becomes the hop's as-at date, so an
  answer states how old its tabular hop is instead of implying it is live.
