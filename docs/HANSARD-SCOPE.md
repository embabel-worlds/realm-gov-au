# Scope: indexing Hansard, rather than searching it

Status: **scoping only, nothing built.** Every URL, size and count below was measured live on
2026-08-03 against ParlInfo. Nothing here is an estimate dressed as a fact; where a number is
extrapolated it says so.

## 1. What this realm does today, and why it is not indexing

Every parliament producer in `producers/parliament.yml` is a **phrase search executed at query
time** against ParlInfo's RSS (`Content:"{key}"`). There is no corpus, nothing is stored, and
nothing is walked.

| Producer | Items cap | Fetches the transcript? |
|---|---|---|
| `hansardChamberMentions` (House + Senate debates) | 40 | **No** — no `follow`, so RSS metadata only |
| `committeeMentions` (Senate + joint) | 40 | **No** |
| `estimatesMentions` | 60 | Yes — 5 pages, 4,000-char excerpts |
| `estimatesMentionsInPeriod` | 8 | Yes — 3 pages |
| `parliamentAnyMentions` | 5 | No |

`au-hansard-index` is named for something it does not do: its own description says it fetches "up to
two Chamber Hansard, two committee and two Senate Estimates records" for a phrase you supply, and
writes them to the document store so `au-hansard-rag` can search them. That is an opt-in scratchpad
of at most six documents per phrase.

Three consequences, and they are the reason to do this work:

1. **Absence is not evidence of absence.** "This supplier was never raised in Parliament" is
   unsupportable today. The honest statement is "a phrase search returned nothing within a 5–60 item
   cap" — and for chamber Hansard, without reading one word of transcript.
2. **No corpus-wide question is possible.** Mention counts over a decade, which of 40 suppliers has
   never been scrutinised, whether mentions cluster before a contract was signed — all need the
   corpus.
3. **Recall is hostage to phrasing.** A supplier Hansard names differently from AusTender is
   invisible, with no entity-resolved path.

## 2. The bulk route, verified

A whole sitting day is one XML file:

```
https://parlinfo.aph.gov.au/parlInfo/download/chamber/hansardr/29171/toc_unixml/House%20of%20Representatives_2026_07_02.xml;fileType=text%2Fxml
                                              ^^^^^^^^ dataset      ^^^^^ day id            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ chamber + date
```

`hansardr` = House, `hansards` = Senate. Measured, both for 2 July 2026:

| | Bytes | `talk.start` | `speech` | Prose |
|---|---|---|---|---|
| House (id 29171) | 1,553,032 | 301 | 118 | 846,209 chars |
| Senate (id 29228) | 1,509,202 | 352 | 132 | 839,094 chars |

### The structure is better than expected

Not a wall of text — speaker-attributed, party-attributed, timestamped:

```
debate (29)  >  subdebate.1 (104)  >  speech (118)
                                        talk.start (301)
                                          talker: name, name.id, electorate, party, in.gov, first.speech
                                          time.stamp
                                        talk.text
question (19) / answer (20)      <- Question Time is structurally marked
```

`name.id` is a stable member identifier, so speeches can join a `Person` spine without name
matching. `party` and `in.gov` come per speech, so government/opposition is a fact in the data
rather than something to infer. `question`/`answer` elements mean Question Time can be separated
from debate without heuristics.

### Enumeration: id walking, because dated queries do not work

Day ids are **dense and sequential in sitting-day order** within a chamber (measured):

```
29167 House 2026-06-25    29170 House 2026-07-01
29168 House 2026-06-29    29171 House 2026-07-02
29169 House 2026-06-30    29172 (not yet published — the frontier)
```

The chambers share one numbering space but occupy different ranges (House 29171 and Senate 29228 are
the *same sitting date*), so each chamber needs its own frontier and its own walk.

What does **not** work, tested: `Dataset:hansardr Date:01/06/2026 >> 31/07/2026` on the RSS feed
returns 15 items covering a single sitting day. The feed is a latest-N window; the date filter does
not enumerate. So there is no cheap "give me every sitting day in this year" call, and discovery is
a walk of ~2 requests per sitting day (one display page to learn chamber+date, one download).

### The trap that will bite a naive walker

A wrong id, or a wrong filename against a right id, returns **HTTP 200 with a ~19KB error page** —
not a 404:

| Request | Status | Bytes |
|---|---|---|
| exact id + exact filename | 200 | 1,553,032 |
| exact id + arbitrary filename | 200 | **18,885** |
| right filename + wrong id | 200 | **18,912** |

A walker that trusts the status code will ingest error pages as sitting days, and they will look like
short sitting days rather than failures. Any producer here MUST validate: expected root element
present, `talk.start` count > 0, and the `<date>` inside the file equal to the date requested. This
is the third instance of this pattern in this realm (AusTender's `/Cn/Show/<bad-uuid>` and
GrantConnect's over-cap banner are the others), which is why it belongs in the notes rather than in
someone's memory.

## 3. Corpus size

Measured per chamber-day: ~1.5 MB XML, ~840k chars of prose. Sitting days per year are ~65–70 House
and ~55–60 Senate — that figure is **from the published sitting calendar, not measured here**, so
treat the yearly totals as extrapolation:

| Scope | XML | Prose | Chunks at ~1k chars |
|---|---|---|---|
| One chamber-day | 1.5 MB | 840k chars | ~840 |
| One year, both chambers (~125 days) | ~190 MB | ~105M chars | ~105k |
| Ten years | ~1.9 GB | ~1.05B chars | ~1.05M |

The walk itself is cheap: ~250 requests per year of corpus at the ≥1s pacing this realm already
declares, so roughly 5 minutes of politeness-bound fetching per year indexed, plus download time.
**Embedding is the cost driver, not fetching** — ~105k chunks per year of corpus. A decade is a
seven-figure chunk count and needs a deliberate decision, not a default.

## 4. Phasing

**Phase 1 — the corpus exists, and says what it holds.** A `tabular`/`xml` producer over one sitting
day (`recordElement: talk.start`), an id-walking discovery step per chamber, the validation guard
above, and a coverage record naming which sitting days are actually held. Unlocks nothing on its own
and is the only phase where "we indexed Hansard" can be said honestly, because a query can state its
own coverage. Without the coverage record, phase 1 makes claim (1) in §1 *worse*: a corpus with
silent holes is more convincing and no more complete than a capped search.

**Phase 2 — speeches as graph.** `talk.start` → a speech node carrying `name.id`, party, electorate,
`in.gov`, timestamp, debate and subdebate titles, joined to the existing `Person` spine by `name.id`
rather than by name. Unlocks mention counts, who raised what, government-vs-opposition, and
Question-Time-only questions.

**Phase 3 — RAG over the prose.** Chunk `talk.text` with the speech as provenance so a quote carries
speaker, party, date and debate. Only here does `au-hansard-rag` stop being limited to whatever
someone previously pulled in. Cost as above; start with one year, not ten.

**Phase 4 — the questions that are impossible today.** Suppliers never mentioned; mention timing
against contract dates; a portfolio's scrutiny density; silence as a measurable quantity rather than
an assumption.

## 5. Open questions, honestly

- **Frontier discovery.** Walking down from a known id works; finding *today's* id needs the RSS
  (latest 15) or a probe upward until the 19KB error page appears. Both are fine; neither is elegant.
- **Historical depth.** ParlInfo carries back to 1901, but only 2026 ids were probed. The id space is
  dense at the frontier; whether it stays dense across decades and parliament boundaries is unknown
  and would need sampling before committing to a decade-scale walk.
- **Committees and Estimates.** `commsen`/`commjnt`/`estimate` are separate datasets whose bulk shape
  was NOT examined. Estimates is the accountability venue for procurement, so it may deserve
  precedence over chamber debate — a scoping question of its own.
- **Questions on Notice** remain a known hole (`qon`/`qanda`/`qonsw` error as sole datasets, probed
  earlier and recorded in `producers/parliament.yml`).
- **Terms of use.** ParlInfo is a public service and this realm is polite by declaration
  (`minIntervalMs`, capped items). A systematic walk is a different order of use from a phrase
  search, and I have not read the site's terms. That should be checked before anything walks.
- **Where the corpus lives.** A per-user document store is the wrong home for a public corpus every
  user shares; this needs the public/reference scoping the realm already uses for `ContractRelease`,
  or it will be re-fetched and re-embedded per user.
