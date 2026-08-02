(function () {
  "use strict";

  var E = window.embabel || null;
  var runner = E ? E.createRunner({ timeoutMs: 900000 }) : null;
  var currentData = null;
  var $ = function (id) { return document.getElementById(id); };
  var esc = E && E.html ? E.html.escape : function (value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  };

  function dataOf(event) {
    if (!event) return null;
    var value = event.data != null ? event.data : event;
    if (typeof value === "string") {
      try { return JSON.parse(value); } catch (ignored) { return null; }
    }
    if (value && typeof value.content === "string") {
      try { return JSON.parse(value.content); } catch (ignored2) { return null; }
    }
    return value;
  }

  function money(value, compact) {
    var amount = Number(value);
    if (!isFinite(amount)) return "—";
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      notation: compact === false ? "standard" : "compact",
      maximumFractionDigits: compact === false ? 0 : 1
    }).format(amount);
  }

  function dateText(value) {
    if (!value) return "date not supplied";
    var iso = String(value).slice(0, 10);
    var date = new Date(iso + "T00:00:00Z");
    return isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat("en-AU", {
      day: "numeric", month: "short", year: "numeric", timeZone: "UTC"
    }).format(date);
  }

  function isoLocal(date) {
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function notice(message, error) {
    var box = $("notice");
    box.hidden = !message;
    box.textContent = message || "";
    box.style.color = error ? "var(--salmon)" : "";
  }

  function parseAmount(value) {
    var match = String(value || "").trim().toLowerCase().replace(/[$,\s]/g, "").match(/^(\d+(?:\.\d+)?)\s*([kmb]?)$/);
    if (!match) return null;
    var factor = match[2] === "b" ? 1e9 : match[2] === "m" ? 1e6 : match[2] === "k" ? 1e3 : 1;
    var amount = Number(match[1]) * factor;
    return isFinite(amount) && amount >= 0 ? Math.round(amount) : null;
  }

  function trimNumber(value, digits) {
    return value.toFixed(digits).replace(/(\.\d*?[1-9])0+$|\.0+$/, "$1");
  }

  function compactAmount(value) {
    if (value >= 1e9) return trimNumber(value / 1e9, 3) + "b";
    if (value >= 1e6) return trimNumber(value / 1e6, 3) + "m";
    if (value >= 1e3) return trimNumber(value / 1e3, 1) + "k";
    return new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 }).format(value);
  }

  function syncAmount(report) {
    var display = $("minimum-display");
    var amount = parseAmount(display.value);
    if (amount == null) {
      display.setCustomValidity("Enter an amount such as 100k, 1.1m or 1,100,000.");
      display.setAttribute("aria-invalid", "true");
      if (report) display.reportValidity();
      return null;
    }
    display.setCustomValidity("");
    display.removeAttribute("aria-invalid");
    $("minimum").value = String(amount);
    return amount;
  }

  function normaliseAmount() {
    var amount = syncAmount(false);
    if (amount != null) $("minimum-display").value = compactAmount(amount);
  }

  function selectedDays() {
    var from = Date.parse($("from").value + "T00:00:00Z");
    var to = Date.parse($("to").value + "T00:00:00Z");
    return isFinite(from) && isFinite(to) ? Math.floor((to - from) / 86400000) + 1 : 0;
  }

  function updateRangeHint() {
    var from = $("from");
    var to = $("to");
    var days = selectedDays();
    var valid = !from.value || !to.value || from.value <= to.value;
    to.setCustomValidity(valid ? "" : "Published to must be on or after published from.");
    from.setCustomValidity(valid ? "" : "Published from must be on or before published to.");
    var hint = $("range-hint");
    if (!days || !valid) {
      hint.textContent = "Choose a valid inclusive date range.";
    } else if (days <= 90) {
      hint.innerHTML = "<strong>" + days + " inclusive days.</strong> A cached range is quick; a cold GrantConnect export can take about a minute.";
    } else if (days <= 365) {
      hint.innerHTML = "<strong>" + days + " inclusive days.</strong> This larger export may take a few minutes on its first run. Progress will remain visible, and the shared cache makes repeats faster.";
    } else {
      hint.innerHTML = "<strong>" + days + " inclusive days.</strong> This is a very large public export and may take several minutes. You can leave this view and return while the gateway operation continues.";
    }
    if ($("topic").value.trim()) {
      hint.innerHTML += ' <strong>Semantic filter on.</strong> After the export, a model must judge the date/value-scoped grants; this can add several minutes for a large result set.';
    }
  }

  function switchTab(id, focus) {
    document.querySelectorAll('[role="tab"]').forEach(function (tab) {
      var selected = tab.id === id;
      tab.setAttribute("aria-selected", selected ? "true" : "false");
      $(tab.getAttribute("aria-controls")).hidden = !selected;
      if (selected && focus) tab.focus();
    });
  }

  function notes(data) {
    var limits = data.limits || [];
    if (!limits.length) return "";
    return '<details class="notes"><summary>Geographic and source limits</summary><ul>' + limits.map(function (item) {
      return "<li>" + esc(item) + "</li>";
    }).join("") + "</ul></details>";
  }

  function registerLink(kind, id) {
    if (!id) return "";
    var award = kind === "award";
    var href = award ? "https://www.grants.gov.au/ga/list" : "https://www.grants.gov.au/go/list";
    var label = award ? "Copy " + id + " + open award search ↗" : "Copy " + id + " + open opportunity search ↗";
    return '<a class="register-link" href="' + href + '" target="_blank" rel="noopener" data-copy-id="' + esc(id) +
      '" title="Copies the published ID, then opens GrantConnect search; its XLSX export does not contain the UUID needed for a direct record URL">' + esc(label) + "</a>";
  }

  function thresholdHtml(data) {
    var context = data.thresholdContext || {};
    if (!data.minValue || context.belowCount == null) return "";
    var examples = (context.examples || []).map(function (grant) {
      return '<li><span><b>' + esc(grant.activity || grant.program || "Untitled grant") + '</b><small>' + esc(grant.recipient || "Recipient not supplied") +
        " · " + registerLink("award", grant.gaId) + '</small></span><strong>' + money(grant.value, false) + "</strong></li>";
    }).join("");
    return '<details class="threshold-context"><summary><span><b>Around your ' + money(data.minValue, false) + ' cutoff</b><small>' +
      esc(context.belowCount || 0) + " awards sit within " + esc(context.windowPct || 10) + "% below it; " + esc(context.aboveCount || 0) +
      ' sit within the same distance above.</small></span><span>Inspect bunching →</span></summary><div class="threshold-body"><p>' +
      esc(context.note || "The selected minimum is a display filter, not evidence of a funding rule.") + "</p>" +
      (examples ? '<ul class="threshold-examples">' + examples + "</ul>" : "") + "</div></details>";
  }

  function coverageHtml(data) {
    var coverage = data.coverage || {};
    var rangeLabel = coverage.exactRequest === false ? "Requested source range:" : "Complete source range:";
    var observed = coverage.observedFrom && coverage.observedTo
      ? "Observed publish dates " + dateText(coverage.observedFrom) + "–" + dateText(coverage.observedTo) + "."
      : "No publish dates were returned for this request.";
    var rowLabel = coverage.semanticApplied ? " model-matched candidate rows." : " source rows.";
    return '<div class="coverage"><div><strong>' + rangeLabel + '</strong> ' + dateText(coverage.from) + "–" + dateText(coverage.to) +
      " · " + esc(coverage.requestedDays || 0) + ' inclusive days</div><div><strong>' + esc(coverage.rowsFetched || 0) + rowLabel + "</strong> " + esc(observed) + "</div></div>";
  }

  function semanticHtml(data) {
    var basis = data.matchBasis || {};
    if (!basis.criterion) return "";
    return '<div class="semantic-basis"><strong>Model-judged subject</strong><span>Only awards judged relevant to “' + esc(basis.criterion) +
      '” are shown. This is semantic relevance, not a GrantConnect category; clear the field for a deterministic register view.</span></div>';
  }

  function renderResults(data) {
    var headline = data.headline || {};
    var bands = data.byMarginBand || [];
    var divisions = (data.divisions || []).filter(function (division) { return Number(division.grants) > 0; });
    var bandMaximum = Math.max.apply(null, bands.map(function (band) { return Number(band.value) || 0; }).concat([1]));
    var bandHtml = bands.map(function (band) {
      return '<div class="item"><div class="item-head"><span>' + esc(band.band) + "</span><span>" + money(band.value) +
        '</span></div><div class="meta">' + esc(band.grants) + " grants · " + esc(band.divisions) + " divisions · " +
        money(band.valuePerDivision) + ' per represented division</div><div class="bar"><div class="fill" style="width:' +
        Math.max(2, Math.min(100, Number(band.value) / bandMaximum * 100)) + '%"></div></div></div>';
    }).join("");
    var divisionHtml = divisions.map(function (division, index) {
      return '<details class="division" data-index="' + index + '" data-division="' + esc(division.division) + '"><summary><span class="rank">#' +
        (index + 1) + '</span><span class="division-name"><b>' + esc(division.division) + ", " + esc(division.state) +
        '</b><span>' + esc(division.marginBand) + " · held " + esc(division.heldByAbbrev) + " · " + esc(division.member) +
        '</span></span><span class="division-total"><b>' + money(division.value) + "</b><span>" + esc(division.grants) +
        ' grants</span></span></summary><div class="awards"><div class="meta">Open to load the underlying awards.</div></div></details>';
    }).join("");

    $("result").innerHTML = coverageHtml(data) + semanticHtml(data) + '<div class="headline"><div class="big">' + esc(headline.attributed || 0) + " / " +
      esc(headline.grantsConsidered || 0) + "</div><p>" + esc(headline.note || "No grants met this threshold.") +
      '</p></div>' + thresholdHtml(data) + '<div class="grid"><article class="card"><h3>By 2025 margin band</h3>' + (bandHtml || '<p class="meta">No attributable grants.</p>') +
      '</article><article class="card"><h3>Divisions · open for individual grants</h3><div class="division-list">' +
      (divisionHtml || '<p class="meta">No grants mapped to exactly one division.</p>') + "</div></article></div>" + notes(data);
  }

  function renderAwards(details) {
    if (details.dataset.loaded === "true") return;
    var divisions = (currentData.divisions || []).filter(function (division) { return Number(division.grants) > 0; });
    var division = divisions[Number(details.dataset.index)];
    var target = details.querySelector(".awards");
    target.innerHTML = (division.awards || []).map(function (award) {
      return '<div class="award"><b>' + esc(award.activity || "Untitled grant activity") + '</b><span class="award-value">' +
        money(award.value, false) + '</span><div class="award-meta">' + esc(award.recipient || "Recipient not supplied") + " · " +
        esc(award.agency || "Agency not supplied") + " · published " + esc(dateText(award.publishDate)) + " · delivery postcode " +
        esc(award.deliveryPostcode || "not supplied") + '</div><div class="award-links">' + registerLink("award", award.gaId) +
        (award.goId ? registerLink("opportunity", award.goId) : "") + "</div></div>";
    }).join("") || '<div class="meta">No underlying award rows.</div>';
    details.dataset.loaded = "true";
  }

  function mapLevel(value, thresholds) {
    if (!(value > 0)) return 0;
    for (var index = 0; index < thresholds.length; index++) {
      if (value <= thresholds[index]) return index + 1;
    }
    return 5;
  }

  function mapPoint(division) {
    var longitude = Number(division.centroidLon);
    var latitude = Number(division.centroidLat);
    return {
      division: division,
      anchorX: (longitude + 180) / 360 * 1000,
      anchorY: (90 - latitude) / 180 * 500,
      x: (longitude + 180) / 360 * 1000,
      y: (90 - latitude) / 180 * 500
    };
  }

  function spreadMapPoints(points) {
    var minimum = 3.15;
    for (var pass = 0; pass < 90; pass++) {
      for (var i = 0; i < points.length; i++) {
        for (var j = i + 1; j < points.length; j++) {
          var dx = points[j].x - points[i].x;
          var dy = points[j].y - points[i].y;
          var distance = Math.sqrt(dx * dx + dy * dy) || .01;
          if (distance >= minimum) continue;
          var push = (minimum - distance) * .22;
          var ux = dx / distance || ((i % 3) - 1) * .5;
          var uy = dy / distance || ((j % 3) - 1) * .5;
          points[i].x -= ux * push; points[i].y -= uy * push;
          points[j].x += ux * push; points[j].y += uy * push;
        }
        points[i].x += (points[i].anchorX - points[i].x) * .035;
        points[i].y += (points[i].anchorY - points[i].y) * .035;
      }
    }
    return points;
  }

  function renderMap(data) {
    var divisions = data.divisions || [];
    var resultDivisions = divisions.filter(function (division) {
      return Number(division.grants) > 0;
    });
    var agencyCounts = {};
    resultDivisions.forEach(function (division) {
      (division.awards || []).forEach(function (award) {
        var agency = (award.agency || "").trim();
        if (agency) agencyCounts[agency] = (agencyCounts[agency] || 0) + 1;
      });
    });
    var agencies = Object.keys(agencyCounts).sort(function (left, right) {
      return agencyCounts[right] - agencyCounts[left] || left.localeCompare(right);
    });
    var agencySummary = agencies.length
      ? " Most represented here: " + agencies.slice(0, 3).map(esc).join(" · ") + "."
      : " The responsible agency is shown on each expanded grant.";
    var semanticSummary = data.matchBasis && data.matchBasis.criterion
      ? " Only awards a model judged relevant to “" + esc(data.matchBasis.criterion) + "” are included."
      : "";
    if (!resultDivisions.length) {
      $("map-result").innerHTML = '<article class="map-card map-empty"><div><div class="kicker">No result divisions</div><h3>There is nothing to plot for this result set</h3><p>No grant in the current results mapped unambiguously to a federal division. Change the filters or inspect the exclusion counts in Results.</p></div></article>';
      return;
    }
    var positive = resultDivisions.map(function (division) { return Number(division.value) || 0; }).filter(function (value) { return value > 0; }).sort(function (a, b) { return a - b; });
    var thresholds = [0.2, 0.4, 0.6, 0.8].map(function (position) {
      return positive[Math.min(positive.length - 1, Math.floor(positive.length * position))] || 0;
    });
    var points = spreadMapPoints(resultDivisions.filter(function (division) {
      return isFinite(Number(division.centroidLat)) && isFinite(Number(division.centroidLon));
    }).map(mapPoint));
    var shapes = points.map(function (point) {
      var division = point.division;
      var label = division.division + ", " + division.state + ": " + division.grants + " grants, " + money(division.value);
      return '<circle class="division-cell level-' + mapLevel(Number(division.value), thresholds) + '" cx="' + point.x.toFixed(2) + '" cy="' + point.y.toFixed(2) +
        '" r="1.42" tabindex="0" role="button" data-division="' + esc(division.division) + '" aria-label="' + esc(label) +
        '"><title>' + esc(label) + "</title></circle>";
    }).join("");
    var outline = window.AUSTRALIA_PATH || "";
    var mapStatus = points.length
      ? '<span class="map-status">' + points.length + ' result division' + (points.length === 1 ? '' : 's') + ' shown</span>'
      : '<span class="map-status map-status-error">The result divisions have no usable coordinates. Their grants remain available in Results.</span>';
    var outlineStatus = outline ? "" : '<div class="map-warning">The Australia outline did not load. Division markers are still shown in their geographic positions.</div>';
    var boundaries = "M858.3 288L858.3 347M858.3 322.2L883.3 322.2M883.3 288L883.3 322.2M883.3 322.2L891.7 322.2L891.7 346M891.7 330.6L924 330.6";
    $("map-result").innerHTML = '<article class="map-card"><div class="map-top"><div><h3>Where these results map</h3><p>Only divisions containing grants in the current result set are shown. Point or focus to preview one, then click, tap or press Enter to open its grants in Results.</p></div>' + mapStatus + '</div>' + outlineStatus +
      '<div class="map-context"><strong>Result divisions only</strong><span>These are Australian Government grant awards published on GrantConnect—not all government spending.' + semanticSummary + ' Colour compares total value among the divisions in this result set.' + agencySummary + '</span></div>' +
      '<svg class="cartogram" viewBox="808 277 125 108" role="img" aria-label="Map of Australia showing only federal divisions represented in the current grant results">' +
      '<path class="australia-outline" d="' + esc(outline) + '"></path><path class="state-boundaries" d="' + boundaries + '"></path>' + shapes +
      '</svg><div class="map-footer"><div class="legend"><span>Lower result total</span><i class="level-1"></i><i class="level-2"></i><i class="level-3"></i><i class="level-4"></i><i class="level-5"></i><span>Higher</span></div>' +
      '<div class="map-preview" id="map-preview">Point to, focus or tap a division for its total.</div></div></article>';
  }

  function showMapPreview(name) {
    if (!currentData) return;
    var division = (currentData.divisions || []).find(function (item) { return item.division === name; });
    if (!division) return;
    var button = division.grants ? '<button type="button" data-open-division="' + esc(name) + '">View grants</button>' : "";
    $("map-preview").innerHTML = "<strong>" + esc(name) + ", " + esc(division.state) + ": " + money(division.value) + "</strong> · " +
      esc(division.grants) + " grants · " + esc(division.marginBand) + button;
  }

  function openDivision(name) {
    switchTab("tab-results", false);
    var details = Array.from(document.querySelectorAll(".division")).find(function (item) { return item.dataset.division === name; });
    if (!details) return;
    details.open = true;
    renderAwards(details);
    details.scrollIntoView({ behavior: "smooth", block: "center" });
    details.querySelector("summary").focus({ preventScroll: true });
  }

  function render(data) {
    currentData = data;
    renderResults(data);
    renderMap(data);
    var coverage = data.coverage || {};
    var basis = data.matchBasis || {};
    $("method-coverage").textContent = "For " + dateText(coverage.from) + " to " + dateText(coverage.to) +
      ", Virtual Cypher traversed the GrantConnect window" + (basis.criterion
        ? ", used ai.relevant and ai.score to judge awards against “" + basis.criterion + "”,"
        : "") + " then joined delivery postcodes to the geographic correspondence and AEC election facts before applying the exclusion rules.";
  }

  async function run() {
    if (!runner) {
      notice("The Embabel app runtime is unavailable.", true);
      return;
    }
    if (!$("controls").reportValidity() || syncAmount(true) == null) return;
    var days = selectedDays();
    var topic = $("topic").value.trim();
    var button = $("run");
    button.disabled = true;
    button.textContent = "Working…";
    notice("");
    try {
      var event = await runner.lens("au-grant-hop", {
        from: $("from").value,
        to: $("to").value,
        minValue: $("minimum").value,
        topic: topic
      }, {
        waitSeconds: 15,
        state: $("operation"),
        message: topic
          ? "Fetching grants, then judging subject relevance before the electorate join…"
          : "Fetching grants and joining delivery postcodes to electorates…",
        expectation: (topic ? "Semantic matching adds a batched model review after the public export and may add several minutes. " : "") + (days > 365
          ? "This very large GrantConnect export may take several minutes. The gateway operation continues even if you leave this view."
          : days > 90
            ? "A larger uncached date range may take a few minutes; repeated runs use the shared file cache."
            : "A cold GrantConnect export can take about a minute; repeated runs use the shared file cache.")
      });
      var data = dataOf(event);
      if (!data) throw new Error("The grant lens returned no readable result.");
      render(data);
      if (data.status === "PARTIAL") notice("The source reported a partial result. Read the geographic and source limits before interpreting totals.");
      if (data.status === "FAILED") notice("The public export failed. Retry from the operation panel.", true);
    } catch (error) {
      if ($("operation").dataset.state !== "error") $("operation").setState("error", { error: error });
    } finally {
      button.disabled = false;
      button.textContent = "Map grants";
    }
  }

  var today = new Date();
  var targetMonth = new Date(today.getFullYear(), today.getMonth() - 2, 1);
  var lastDayOfTargetMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
  var start = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), Math.min(today.getDate(), lastDayOfTargetMonth));
  $("to").value = isoLocal(today);
  $("from").value = isoLocal(start);
  $("to").max = isoLocal(today);
  $("from").max = isoLocal(today);
  updateRangeHint();
  syncAmount(false);

  $("from").addEventListener("input", updateRangeHint);
  $("to").addEventListener("input", updateRangeHint);
  $("topic").addEventListener("input", updateRangeHint);
  $("minimum-display").addEventListener("input", function () { syncAmount(false); });
  $("minimum-display").addEventListener("blur", normaliseAmount);
  $("minimum-display").addEventListener("keydown", function (event) {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      var amount = parseAmount(this.value);
      if (amount == null) amount = Number($("minimum").value) || 100000;
      amount = Math.max(0, amount + (event.key === "ArrowUp" ? 100000 : -100000));
      this.value = compactAmount(amount);
      syncAmount(false);
    }
  });
  $("controls").addEventListener("submit", function (event) {
    event.preventDefault();
    normaliseAmount();
    run();
  });
  $("operation").addEventListener("embabel-retry", run);
  document.querySelector(".tabs").addEventListener("click", function (event) {
    if (event.target.getAttribute("role") === "tab") switchTab(event.target.id, false);
  });
  $("result").addEventListener("toggle", function (event) {
    if (event.target.matches("details.division") && event.target.open) renderAwards(event.target);
  }, true);
  $("map-result").addEventListener("mouseover", function (event) {
    if (event.target.dataset && event.target.dataset.division) showMapPreview(event.target.dataset.division);
  });
  $("map-result").addEventListener("focusin", function (event) {
    if (event.target.dataset && event.target.dataset.division) showMapPreview(event.target.dataset.division);
  });
  $("map-result").addEventListener("click", function (event) {
    var name = event.target.dataset && (event.target.dataset.openDivision || event.target.dataset.division);
    if (!name) return;
    openDivision(name);
  });
  $("map-result").addEventListener("keydown", function (event) {
    if ((event.key === "Enter" || event.key === " ") && event.target.matches(".division-cell")) {
      event.preventDefault();
      openDivision(event.target.dataset.division);
    }
  });
  document.addEventListener("click", function (event) {
    var link = event.target.closest && event.target.closest(".register-link[data-copy-id]");
    if (link && navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link.dataset.copyId).catch(function () {});
  });

  if (E && E.progress) E.progress.label(function (name) {
    return /semantic|relevan|score|llm|model/i.test(name) ? "the semantic grant relevance review" : /grant/i.test(name) ? "the GrantConnect awards export" : /division|elector/i.test(name) ? "the AEC electorate geography" : String(name || "the public source");
  });
})();
