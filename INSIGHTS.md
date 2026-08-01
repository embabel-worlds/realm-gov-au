# Insight catalogue for Commonwealth procurement

The useful product is not another procurement table. It is a **signal desk** that tells a reader
what changed, what is unusually concentrated, and where the public record deserves a closer read —
then lets them open the evidence without implying wrongdoing.

## Product rules

- Say **committed value**, not spending or expenditure.
- A limited-tender ground is the agency's stated reason, not an assessment of that reason.
- Amendment growth is not a budget overrun; AusTender does not publish the budget.
- A supplier postcode is its registered address, not the place where work happens.
- A lobbying client match is a conservative name match, not proof of entity identity or influence.
- Every total must say whether it covers the whole window or a capped sample.
- Keep arithmetic facts and model judgments visually separate.

## Strong insight ideas

### 1. The concentration signal

Show the share of a window's committed value represented by its largest contract, top supplier,
and top five suppliers. This reveals when a dashboard total is really the story of one or two
notices. It is deterministic and can be calculated from `au-window-signed`.

### 2. The count/value inversion

Compare procurement methods twice: share of contract count and share of committed value. A method
can dominate the number of notices while representing little value, or the reverse. Showing the
two measures together prevents a misleading single percentage.

### 3. Small-contract activity versus large-contract value

Use fixed size bands to show the characteristic procurement split: many small notices can create
most of the administrative activity while a handful of large notices carry most of the value.
The fixed bands in `au-money-by` make windows comparable.

### 4. Amendment velocity

Rank contracts that changed in the period by both percentage growth and absolute dollar change.
The two rankings answer different questions: a small contract can grow dramatically in percentage
terms while a large contract moves much more money. Link every row to its complete version chain.

### 5. Award path × later amendment

For amended contracts, join the original procurement method and stated limited-tender ground to
the version curve. Across a sufficiently complete window, compare how frequently open and limited
contracts later amend upward. Present it as an association only, never a causal finding.

### 6. Which stated grounds carry the value

Decode limited-tender and exemption codes into the register's own words, then rank by both count
and value. Surface a ground that accounts for an outsized share of the fetched window, while
retaining its verbatim meaning and top agencies for context.

### 7. Supplier dependency and recurrence

Within a window, show suppliers appearing across several agencies or portfolios and calculate
their share of value. With a future monthly mirror, extend this to supplier recurrence, new
entrants, and agency–supplier dependency over time. Prefer ABN grouping where available; disclose
name normalization where it is not.

### 8. Portfolio character and disclosure quality

Join agencies to AGOR portfolios for factual totals, then keep model-produced themes in a separate
"machine reading" tier. A particularly useful prompt is the least informative description among
high-value contracts: it is a reading list for humans, not a finding about the agency.

### 9. The unresolved-value ledger

Treat failed joins as an insight. Show exactly how many contracts and how much value could not be
placed into a portfolio, category, postcode, or other reference spine. This makes coverage drift
visible instead of silently shrinking denominators.

### 10. Structured fields versus free text

Find cases where the description records a repayment, variation, or scope change while the
structured value is unchanged. The existing CN4118426 example demonstrates why searching prose
and version fields together can reveal facts neither view exposes alone.

### 11. Public-register intersection

For leading suppliers, offer an explicit check against the third-party Register of Lobbyists and
show any matched client spellings, firms, and former-government-representative declarations. This
should always be an opt-in evidence check because the join is by name and the register excludes
in-house lobbyists.

### 12. Data-release rhythm

With several adjacent, uncapped windows, show publication bursts, amendment bursts, and the time
between signing and publication. The product value is operational visibility into the register,
not a claim that an unusual delay is improper.

## What the alternative app implements now

`apps/signal-room.html` implements a simpler first slice:

1. A single window scan creates an executive snapshot and derives concentration, count/value,
   postcode-coverage, and largest-notice signals.
2. The largest commitments are a short evidence list rather than a dense dashboard table.
3. Amendments, procurement grounds, category/size, and portfolio context are lazy-loaded from
   their existing governed lenses.
4. Every screen keeps coverage and interpretation boundaries next to the numbers.
5. `?demo=1` uses the existing baked, real-register envelopes without requiring a running host.

The original `moneytrail.html` remains the full workbench. Signal Room is an additional,
reader-first entry point.
