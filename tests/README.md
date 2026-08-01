# Tests

`moneytrail-suite.js` — an offline regression over the app's demo mode: every tab, every routed
question landing on the right panel, the charts, and the honesty invariants (a stamp on every
result, the press tier fenced as not-evidence, the league never calling a commitment a budget,
no electorate/MP on a passport, no `[object Object]`, zero console errors).

It needs Playwright, which lives in the `me` repo's `uit/`:

```bash
(cd apps && python3 -m http.server 8765 &)
cd ../assistant/uit && node ../../realm-gov-au/tests/moneytrail-suite.js
```

45 assertions. It covers what demo mode can reach — the lens catalogue, generated queries and
live producer progress all need a running world and are verified there.
