# realm-gov-au — Where the Commonwealth's money went

Australian Government procurement over the government's own open registers — no API key, no
customer feed, per-hop sources on every answer. The realm behind the **Money Trail** app and the
lead demo of the AU-government suite (`target-customers/demos/au-government/`).

## What it answers

- **The life of one contract** — `MATCH (n:ContractNotice {cnId:'CN3942784'})-[:HAS_VERSION]->(v)`
  returns every published version: the original and each amendment, value as amended. CN3942784
  is four versions, $402.5M → $736.3M. The passport lens adds the lexical description check that
  catches what structured fields never carry: CN4118426's value was never amended, while its
  description records a $97,587.11 repayment.
- **What was signed in a period** — anchor a `PublicationWindow {window:'from/to'}` and aggregate
  committed value, procurement-method split (limited-tender reasons verbatim), top suppliers and
  agencies. A capped fetch is PARTIAL, never "the period".
- **What changed in a period** — the same shape over `ChangeWindow`, where amendment releases
  (tag `contractAmendment`) surface.
- **Is this supplier a registered lobbying client** — the federal Register of Lobbyists joined by
  conservative name match (the register publishes no client ABNs; the lens says so and shows the
  matched strings), with the register's own former-government-representative declarations.

## Sources (both keyless, verified live 2026-08-01)

| Source | Access | Licence |
|---|---|---|
| AusTender OCDS API (`api.tenders.gov.au/ocds`) | by CN id and by date window; cursor-paged 100/page; amendments first-class | CC BY 3.0 AU |
| Register of Lobbyists (`api.lobbyists.ag.gov.au`) | whole-register index + per-firm profiles (the two GETs that answer anonymously) | AGD site CC BY 4.0; API subdomain unverified |

What the OCDS API does NOT serve (measured, documented in `apis/austender-ocds.yaml`): any
search besides id/date — agency and supplier cuts happen after the fetch; and the website's
consultancy/confidentiality flags, which exist only in AusTender's XLSX exports.

## The app

`apps/moneytrail.html` — single-file app on the shared Embabel app runtime
(`/api/v1/apps-runtime/v1/embabel.js` + theme): contract passport with the amendment value
curve, the description-vs-value needle panel, window scan with method split and top tables, and
the lobbyist check with an honest name-match basis. `?demo=1` renders from
`apps/moneytrail-demo-data.json` — REAL register data baked 2026-08-01 — with no host required.

## Discipline

This realm reports what the registers record and never characterises it. Amounts are commitments,
not expenditure. A limited-tender reason is a stated ground, verbatim. A lobbying relationship is
a disclosure. Absence is scoped ("no client entry matched" ≠ "does not lobby" — the register is
third-party only). Fetch failure and genuine absence never render the same way.

## Layout

```
realm.yml          realm manifest + measured retry policy
apis/              vendored OpenAPI specs (the upstreams publish none that work keyless)
types/             ContractVersion, ContractRelease, LobbyistFirm, RegisteredLobbyist
producers/         versionsById, releases{Published,Modified}InWindow, firm{Summary,Lobbyists}ById
lenses/            au-contract-passport, au-window-signed, au-supplier-lobbying
sources.yml        collection shapes and the live-vs-mirror reasoning
apps/              moneytrail.html + baked demo data
```

## v2 candidates

Mirror partitioned by publication month (for "all contracts of supplier X since 2013" as a
traversal); GrantConnect (XLSX-only — needs a tabular producer); ABN Lookup enrichment (free GUID
env var); the weekly XLSX exports for the consultancy/confidentiality flags the API lacks.
