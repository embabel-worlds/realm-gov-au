# Watching for potential fraud as it appears

The integrity lenses answer a question once. A **watch** answers it repeatedly and reports only
what changed — which is the difference between an investigation and a monitor. Every lens meant
to be watched emits a `watch` block whose keys are stable across runs, so the watcher stores the
previous set and reports the difference. Nothing here needs new engine machinery: a scheduled
invoke, a stored key set, and a diff.

## The contract a watchable lens meets

1. **Stable keys.** A key identifies an OBSERVATION, not a row position: `au-unflagged-risk`
   keys on (ABN, screens fired, filing-year pair); `au-register-diff` keys on (entity, action
   type, effective day, the extract pair it vanished between). Re-running unchanged data
   produces an identical key set.
2. **A vintage.** `latestExtract` (register) or the filing-year pair (AIS) says which publication
   the answer came from. A watcher that sees an unchanged vintage knows nothing upstream moved
   and can skip the expensive stages.
3. **Determinism where it matters.** The screens are arithmetic, so a key never appears or
   vanishes because a model changed its mind. Only the reading stages are model-driven, and they
   are attached to findings, never used to create or suppress one.
4. **Disappearance means something.** A key that stops appearing is not silence: the shape no
   longer holds in the current data — the provider corrected a filing, or the regulator acted.

## The three surfaces, and their real cadences

| Watch | Fires when | Cadence to poll | What "new" means |
|---|---|---|---|
| `au-register-diff` | the Commission publishes a new dated extract | weekly (extracts are irregular: 8 in six months, gaps of days to six weeks) | new enforcement appeared; an action was DELETED while nominally in force |
| `au-unflagged-risk` | new AIS data lands, or a provider files late | monthly, and hard on the annual AIS release | a provider trips a screen it did not trip before; a provider stops filing |
| `au-provider-ledger` | new AIS or new published Commonwealth money | monthly | a residual materially changes; a new provider enters the low-staff shape |

The register watch is the only one that is genuinely fast-moving. The AIS-based watches change
annually in bulk and in dribs as late filings arrive — their value is catching the late filing
that quietly restates last year, not daily novelty.

## What a watch must never do

- **Never alert on a score.** No lens computes one, and a watch that ranks entities by "risk"
  invents a claim the data does not support.
- **Never alert on a first sighting alone.** A provider appearing in a screen because the ACNC
  published its first filing is a data event, not a provider event. The key includes the
  filing-year pair so a watcher can tell the difference.
- **Never let generic coverage attach to an entity.** The coverage reader requires an item to
  literally name the organisation. A model asked "is this article about X" will say yes to an
  article about the scheme, which would alert on innocent providers — measured, and the reason
  the name gate exists.
- **Never treat a removal as exoneration or as scandal.** Both readings are available and the
  register supports neither; the watch reports the fact and the dates.

## Wiring one

A watch is a scheduled invoke plus a stored key set:

```
POST /api/v1/lenses/au-register-diff/invoke?background=true   {"args":{"followUp":"yes"}}
# poll the run, take data.watch.removalKeys
# diff against the previous run's set → new keys are the alert
```

The expensive stages are already parameterised so a watch can run cheap and escalate: run
`au-unflagged-risk` with `assess: "no"` on the schedule (arithmetic only, no search or model
calls), and only when the key set changes, re-run the changed entities with `assess: "yes"` to
read their coverage. That keeps a daily watch nearly free and pays for judgment exactly when
something moved.
