# Brainstorming: citizen-facing public-record apps

_Working note, researched 3 August 2026._

This document collects possible extensions to `realm-gov-au` beyond the NDIS. It is deliberately
an opportunity catalogue rather than a delivery commitment. The central product idea is that the
most useful app is rarely a browser for one dataset. It is a **decision trail** that lets a citizen
ask:

> Who received public money? Who controls them? What did regulators know? Who had access to
> decision-makers? What changed, and when?

The app should then explain the answer without implying that an unusual pattern proves fraud,
corruption or improper influence.

## Product rules

These proposals should inherit the evidence discipline used by the NDIS Public Record app.

- Every finding must drill into the source record. A name without links is not an investigation
  path.
- Prefer joins on stable public identifiers: ABN/ACN in Australia and Companies House number in
  the UK. Name matching must be visible and must never silently become an identity claim.
- Separate **confirmed public record**, **two records disagree**, **events occurred close
  together**, **possible identity match**, and **the public record does not explain this**.
- Put status and dates beside the finding. Historical filings from revoked, dissolved or inactive
  entities must not be presented as if they describe a currently operating organisation.
- A director manages a company; a director is not necessarily its owner. A UK Person with
  Significant Control (PSC) is an ownership/control disclosure, but even PSC data can be
  incomplete or inaccurate.
- Do not produce a corruption, fraud or risk score. Offer a reading list and a question a citizen
  could reasonably ask.
- Contract value is not necessarily expenditure. AusTender values are maximum lifetime committed
  values and [do not reflect annual expenditure](https://www.finance.gov.au/government/procurement/statistics-australian-government-procurement-contracts-).
- Temporal order is useful context, not causation: `donation -> meeting -> decision -> contract`
  is a sequence of public records, not proof that one event caused another.

## The strongest Australian opportunities

### 1. Public Money and Conduct

**Citizen question:** Why is government still buying from this organisation, and what public
conduct history was available at the time?

Build an organisation passport combining:

- AusTender contracts and amendments;
- GrantConnect awards;
- Fair Work enforceable undertakings and litigation;
- ACCC undertakings, infringement notices and public warnings;
- ASIC insolvency appointments and published notices;
- NDIS, aged-care and other sector-specific regulatory actions;
- ACNC registration and filing history; and
- press and parliamentary references as a separate narrative layer.

[Fair Work publishes its enforceable undertakings](https://www.fairwork.gov.au/about-us/compliance-and-enforcement/enforceable-undertakings),
the [ACCC maintains several public enforcement registers](https://www.accc.gov.au/public-registers),
and ASIC publishes a [weekly downloadable insolvency appointment dataset](https://asic.gov.au/regulatory-resources/find-a-document/statistics/insolvency-statistics/).

An appropriate finding would be:

> This organisation entered a Fair Work undertaking concerning $2.3 million in underpayments.
> Four later Commonwealth contract notices report $18.4 million in committed value. The records
> shown here do not say whether the buyers considered the undertaking.

This is probably the best next Australian app because it reuses much of the existing realm and
adds records that answer an ordinary citizen's question.

### 2. Slow Payers Paid by Government

**Citizen question:** Does a major government supplier pay its own small-business suppliers
promptly?

The Payment Times Reports Register has a free downloadable file, searchable by ABN or ACN, with
payment-time distributions and compliance notices. See the regulator's
[guide to the register and data file](https://paymenttimes.gov.au/how-view-reports).

Join it to AusTender and explain both sides:

> This entity has $63 million in reported Commonwealth contract commitments. In its latest
> payment-times report, 22% of its small-business invoices were paid after more than 60 days.

This is a particularly clean MVP: the identifier join is strong, the numbers are comprehensible,
and the source file is already downloadable.

### 3. Care Quality versus Public Money

**Citizen question:** Are poorly rated care providers still receiving identifiable public grants
or contracts, and do several services belong to the same group?

The Department of Health publishes quarterly
[service-level residential aged-care Star Ratings extracts](https://www.health.gov.au/our-work/star-ratings-for-residential-aged-care).
Combine overall, compliance, staffing, resident-experience and quality-measure ratings with:

- provider and service registration history;
- compliance actions;
- corporate or charity group membership;
- grants and procurement contracts where an exact recipient can be identified; and
- press and parliamentary discussion.

The app must say that ordinary aged-care subsidy payments are not necessarily visible in these
grants and procurement records. That missing provider-payment ledger is itself a transparency
finding, not a reason to substitute contract value for total public funding.

### 4. Supplier Distress Watch

**Citizen question:** Was a contract awarded, extended or enlarged shortly before or after a
public insolvency event?

Join AusTender version chains to ASIC insolvency appointments and
[published insolvency notices](https://www.asic.gov.au/regulatory-resources/insolvency/more-insolvency-information/insolvency-notices/).
Useful, neutral observations include:

- award shortly before external administration;
- amendment after appointment of an external administrator or controller;
- continuing commitments after deregistration; and
- a large increase during a period of publicly recorded financial distress.

A true phoenix-company detector is a later and more difficult product. It requires evidence about
directors, ownership, assets, names, addresses and business continuity; it cannot safely be
inferred from similar names alone.

### 5. Government AI Watch

**Citizen question:** Where might government AI directly affect people, and what has the agency
actually disclosed about the system, human review and safeguards?

Australian non-corporate Commonwealth entities must publish
[AI transparency statements](https://www.digital.gov.au/policy/ai/list-of-transparency-statements).
However, the standard says statements are a high-level overview and
[does not require agencies to list individual use cases](https://www.digital.gov.au/ai/ai-in-government-policy/standard-ai-transparency-statements).

The app could extract and compare:

- usage pattern and government domain;
- whether the public directly interacts with AI;
- whether a person may be significantly affected without human review;
- named systems, vendors and affected services, where disclosed;
- monitoring, appeal, privacy and impact-assessment information;
- last-updated date; and
- relevant AI procurement, FOI releases and parliamentary material.

A valid finding could be:

> The agency reports AI-assisted decision support but does not identify the individual systems,
> affected services or suppliers. The Australian standard does not require use-case-level
> disclosure.

### 6. Influence-to-Outcome Timeline

**Citizen question:** What donations, lobbying disclosures, gifts, meetings, decisions and public
awards occurred around the same period?

Potential Australian inputs include AEC donation disclosures, the Register of Lobbyists, agency
gifts and benefits registers, ministerial and parliamentary records, grants, procurement and
regulatory decisions. The [AEC Transparency Register supports data export](https://transparency.aec.gov.au/).

This would be high-value but sensitive. It should never use a headline such as "donation caused
contract". It should say:

> These public events occurred in this order. The records do not establish whether they are
> connected.

Australia also lacks Canada's comparable downloadable log of reportable lobbying communications,
so the absence of meeting-level visibility should be stated explicitly.

### 7. Environmental Money Paradox

**Citizen question:** Is public support going to a corporate group while its reported emissions,
Safeguard obligations or environmental compliance history move in the other direction?

The Clean Energy Regulator publishes facility baselines, net emissions, surrendered units and
other [Safeguard data](https://cer.gov.au/markets/reports-and-data/safeguard-data). Combine it with
NGER corporate data, ACCU projects, grants, procurement and EPBC decisions.

The unit of analysis matters: a facility, legal entity and corporate group are different things.
The app must preserve those boundaries and show the ownership path used to aggregate them.

### 8. FOI Public Interest Map

**Citizen question:** What subjects are people repeatedly trying to discover from government, and
can the released documents still be opened?

The OAIC now links to disclosure logs for more than 240 agencies through its
[agency FOI disclosure-log hub](https://www.oaic.gov.au/freedom-of-information/how-to-access-government-information/agency-foi-disclosure-logs).
An app could identify:

- recurring subjects and organisations;
- logs that give a title but no downloadable document;
- broken or withdrawn links;
- agencies whose logs are not searchable or machine-readable;
- connections to contracts, grants, policies or parliamentary questions; and
- the time between release to the applicant and public availability.

This is less about detecting misconduct than recovering a dispersed public library of government
information.

## What comparison between jurisdictions can reveal

Comparison supplies a useful counterfactual: if another government faced the same supplier,
service or regulatory event, what did it pay, disclose or do differently?

### Known Elsewhere

Start inside Australia, where an ABN may survive across Commonwealth and state datasets.

> A regulator in one jurisdiction recorded an undertaking or ban. Another jurisdiction later
> awarded the same ABN a contract. The public award record does not say whether the regulatory
> event was considered.

Possible comparisons include regulatory action versus later procurement, a licence cancelled in
one jurisdiction while another remains active, and the same corporate group operating services
with very different quality outcomes.

Internationally this becomes a corporate-family problem. The app must distinguish the exact
contracting entity from parents, subsidiaries, directors and beneficial controllers.

### Same Supplier, Different Deal

Compare what different agencies or jurisdictions bought from the same supplier:

- duration and maximum value;
- amendments and growth;
- procurement method;
- stated number of suppliers on a framework;
- line-item or per-user cost when quantities are genuinely comparable;
- performance notices and breaches; and
- actual payments where a jurisdiction publishes them.

Contract titles alone are not enough to claim a price discrepancy. A safe app begins with tightly
defined categories such as identical software licences or published labour-hire rate cards.

Canada publishes a consolidated
[federal contracts dataset](https://open.canada.ca/data/dataset/d8f85d91-7dec-4fd1-8055-483b77225d8b),
while UK rules now require qualifying contract-payment information to be linked to the public
contract. Australia's central register exposes committed contract values rather than a comparable
whole-of-government payment ledger.

### Different Consequences for Similar Conduct

Compare what happened after wage underpayment, consumer-law breaches, insolvency, late filings,
care-quality failures, privacy breaches or poor contract performance.

The useful questions are:

- Did one buyer suspend or exclude the entity while another renewed it?
- How long elapsed between the public event and government action?
- Was the consequence itself published?
- Was public money awarded afterwards?

This can reveal inconsistent consequences without claiming which jurisdiction made the correct
decision.

### What Can Citizens See?

Attempt the same ordinary questions in Australia, the UK and Canada:

1. Who ultimately controls this supplier?
2. How much has government actually paid it?
3. Which officials did it lobby, and when?
4. Has it been excluded from procurement?
5. How did major contracts perform?
6. Which algorithms affect public decisions?
7. Can a citizen download the underlying records?

The result should be a field-level transparency comparison, not a league table of corruption.
Differences in legal scope, reporting thresholds and fiscal periods make broad country rankings
misleading.

Canada is a strong comparator because it centrally publishes contracts, grants, briefing-note
titles and [monthly lobbying communication reports](https://open.canada.ca/data/en/dataset/a34eb330-7136-4f5e-9f5f-3ba41df58b06).
It also publishes a downloadable
[federal AI register](https://open.canada.ca/data/en/dataset/fcbc0200-79ba-4fa4-94a6-00e32facea6b)
and system-level Algorithmic Impact Assessments. The UK publishes tool-level records through its
[Algorithmic Transparency Recording Standard hub](https://www.gov.uk/government/collections/algorithmic-transparency-recording-standard-hub).

## UK deep dive: recurring directors, beneficial owners, contracts and donations

### The app concept: Who Keeps Appearing?

The concrete product definition is in [`DIRECTOR-WEB.md`](DIRECTOR-WEB.md).

**Citizen question:** Which directors and beneficial controllers repeatedly appear behind public
suppliers, and do those people or their companies also appear in political-finance records?

The app would begin with a company, contract, director or PSC and open an evidence graph:

```text
Person
  -> director/officer of Company A
  -> director/officer of Company B
  -> PSC of Company C

Company A -> public contract -> Department X
Company B -> political donation -> Party Y
Company C -> public contract -> Council Z
```

It should answer more than "show this company's directors". The useful recurrence questions are:

- Which people appear across the largest number or value of public suppliers?
- Which directors repeatedly appear in newly formed, dissolved or renamed suppliers?
- Which PSCs sit behind several nominally different bidders or framework suppliers?
- Which pairs of directors repeatedly co-occur across companies?
- Which supplier clusters share directors, PSCs, service addresses or company secretaries?
- Did a person join or leave shortly before an award, insolvency event or political donation?
- Do companies controlled or directed by the same person donate to several parties?
- Does the same corporate family receive contracts through different legal entities?

These are navigation and recurrence signals. A prolific professional director, accountant or
company-formation agent can legitimately appear many times, so volume alone must not be labelled
suspicious.

### Why the UK data makes this feasible

Companies House offers free public data on companies, officers and PSCs. The API exposes:

- [officers of a company](https://developer-specs.company-information.service.gov.uk/companies-house-public-data-api/reference/officers/list);
- [all appointments for an officer identifier](https://developer-specs.company-information.service.gov.uk/companies-house-public-data-api/reference/officer-appointments/list);
- a [daily full PSC snapshot](https://download.companieshouse.gov.uk/en_pscdata.html); and
- a monthly [free company data product](https://download.companieshouse.gov.uk/en_output.html).

The PSC register has been public since 2016, although Parliament's research service notes
[longstanding concerns about its accuracy](https://commonslibrary.parliament.uk/research-briefings/cbp-8259/).
The product must therefore say "Companies House records this person as a PSC", not "this is the
verified ultimate owner".

Contracts Finder and Find a Tender publish OCDS data. Awarded suppliers' Companies House or
charity identifiers are included
[where the buyer provided them](https://www.gov.uk/government/publications/open-contracting).
Under the Procurement Act's central platform, supplier registration captures a Companies House
number or equivalent. Historical gaps and missing identifiers must remain visible.

### Can companies and directors be connected to political donations?

**Companies: yes, often exactly.** The Electoral Commission's donations records include donor
status and, for company donors, a company registration number. Its
[public search](https://search.electoralcommission.org.uk/) exposes that field. This permits the
strong path:

```text
Companies House company number
  -> Electoral Commission company donor
  -> recipient party or regulated donee
```

The app can therefore show:

> Company 01234567 donated £X to Party Y on date D. The same legal entity appears as an awarded
> supplier on contracts with reported value £Z.

It can also traverse indirectly from a person:

```text
Person -> director or PSC of Company -> company made disclosed donation
```

That does **not** mean the person personally made or authorised the donation; it means a company
with which the person has a recorded role made it.

**Directors donating personally: possible to search, but not an exact register join.** Individual
donation records contain the donor's name but no Companies House officer identifier. A same-name
match can be useful as a lead, especially with corroborating public information, but it must render
as "possible match" until confirmed. Name equality alone is particularly unsafe for common names.

The app should consequently use three evidence labels:

1. **Exact company donation** — matched on company registration number.
2. **Company associated with this person donated** — exact company match plus a dated Companies
   House role; no claim that the person made the decision.
3. **Possible personal-donor match** — name-based lead requiring corroboration.

### Has this already been built?

Substantial parts have. A generic "Companies House + contracts + donations" explorer would not be
novel.

| Existing work | What it already does | Remaining distinction for a realm app |
|---|---|---|
| [OC Intelligence](https://ocintelligence.co.uk/) | Commercial platforms combining Companies House directors/PSCs, government contracts, Electoral Commission donations, MP interests, land and charities. It explicitly offers people search across companies and donations within company profiles. | It is the closest existing implementation. A realm app would need to differentiate through free citizen access, governed per-edge source provenance, plain-language caveats, reproducible queries and cross-jurisdiction comparison. |
| [UKGovScan](https://ukgovscan.com/) | Independent beta covering contracts, company/officer search, donations, lobbying, grants, payments and MP interests. It already presents donation-to-contract timelines. | This substantially overlaps the citizen product. A useful alternative would focus narrowly on director/PSC recurrence, exact-versus-possible identity labels, corporate-family aggregation and complete evidence links rather than being another broad portal. |
| [Givers and Takers](https://autonomy.work/portfolio/givers-and-takers-uncovering-the-donor-contractor-nexus-at-the-heart-of-government/) | Autonomy Institute research cross-referencing company donations and public contracts; it identified 373 companies appearing in both categories. | It is a research project/report rather than the proposed recurring-person and beneficial-control navigator. Its existence validates the join but means the company-donor/contract question itself is already well explored. |
| [chgraph](https://www.chgraph.co.uk/) | Company network analysis, shared directors, full appointment history, PSC lookup, addresses and recurring-company connections. | It covers "what directors keep popping up" well, but its published feature set is company-network intelligence rather than a political-finance and public-money decision trail. |

There are also other commercial procurement and company-intelligence products. The conclusion is
not that the UK has an empty product gap. It is:

> Do not build another generic UK company explorer. Build a recurrence-first, evidence-first
> public record app only if it makes the exact legal-entity, director, PSC, donation, contract and
> timing relationships substantially clearer to a non-expert than the existing tools do.

The defensible distinctive features would be:

- start with **people who keep recurring behind public suppliers**, not a company search box;
- roll contract value up through a disclosed corporate-family path while retaining each legal
  entity and avoiding double counting;
- show exact company-number joins separately from officer-name or supplier-name matches;
- put donations, appointments, contracts, amendments, performance notices, insolvency and
  debarment on one dated timeline;
- compare the consequence of the same corporate group across UK nations or against Australia and
  Canada;
- provide a direct official link on every graph edge; and
- explain what each relationship does and does not establish.

### Example citizen findings

> **A director appears across six public suppliers**  
> Companies House records this person as an officer of six companies that appear in public award
> notices. Three appointments are historical. Open the appointment and award records. This does
> not show common ownership or coordination.

> **One PSC, several supplier names**  
> Companies House records the same PSC for four legal entities. Those entities appear on contracts
> from three buyers. Values are shown separately and as a deduplicated group total. PSC data is a
> self-reported public register and may not describe every layer of ultimate ownership.

> **A supplier company also made political donations**  
> The Electoral Commission records donations by the same Companies House number. Contract and
> donation dates are shown together. Their proximity does not establish influence over an award.

> **Possible personal-donor name match**  
> A director's name resembles an individual donor name. The donations register provides no officer
> identifier, so the app cannot confirm they are the same person.

## Canadian opportunities

Canada's centrally consolidated disclosures make several apps unusually feasible:

- **Lobbying to Money Timeline:** reportable lobbying communications -> briefing-note titles ->
  contracts or grants -> later regulatory or policy decisions.
- **Public Funding Passport:** federal contracts over C$10,000, grants and contributions,
  corporate control information and regulatory history.
- **Charity Public-Money Passport:** CRA T3010 finance, compensation, directors and activities ->
  government grants/contracts -> lobbying disclosures. Canada publishes historical T3010 data as
  structured CSV files through its [List of Charities dataset](https://open.canada.ca/data/en/dataset/80c00cdb-1358-415c-bb8b-0de7f12675b8).
- **Government AI Decisions:** compare published Algorithmic Impact Assessment scores, mitigation
  answers, peer reviews, affected services and procurement.
- **Transparency Lag:** measure the delay between a communication, briefing, award, amendment and
  public disclosure.

Again, a communication followed by a grant is a timeline, not evidence that lobbying secured the
grant.

## Suggested build sequence

1. **Public Money and Conduct — Australia.** Highest reuse of the current realm and a strong
   citizen question.
2. **Slow Payers Paid by Government — Australia.** Small, identifier-clean and easy to explain.
3. **Known Elsewhere — Commonwealth versus selected Australian states.** Establish the
   cross-jurisdiction evidence model while ABNs remain available.
4. **Government AI: What Can You See? — Australia/UK/Canada.** Compare disclosure at the field and
   system level, not with a country score.
5. **UK Who Keeps Appearing? research prototype.** Proceed only as a deliberately differentiated
   director/PSC recurrence and evidence product; do not reproduce OC Intelligence or UKGovScan.
6. **Same Supplier, Different Deal.** Start with one genuinely comparable procurement category
   before attempting broad price comparisons.

The common interaction should be a short finding card, followed by **What this means**, **What it
does not prove**, **Why a citizen might ask a question**, and **Open the records**. That pattern is
more valuable than adding another expert-oriented graph or anomaly dashboard.
