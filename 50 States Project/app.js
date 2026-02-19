/* =============================================
   THE STATES — Main Application Script
   ============================================= */

// ── Source index for superscript citations ──
const SOURCE_INDEX = {
  gdp:      { id: 1, label: "BEA — GDP by State", url: "https://www.bea.gov/data/gdp/gdp-state" },
  income:   { id: 2, label: "Census ACS — Income", url: "https://data.census.gov/table/ACSST1Y2023.S1901" },
  unemp:    { id: 3, label: "BLS — Unemployment", url: "https://www.bls.gov/lau/" },
  pop:      { id: 4, label: "Census — Population Estimates", url: "https://www.census.gov/programs-surveys/popest.html" },
  obesity:  { id: 5, label: "CDC — Adult Obesity Maps", url: "https://www.cdc.gov/obesity/data-and-statistics/adult-obesity-prevalence-maps.html" },
  uninsured:{ id: 6, label: "Census — Health Insurance", url: "https://www2.census.gov/library/publications/2025/demo/acsbr-024.pdf" },
  lifeexp:  { id: 7, label: "CDC NCHS — Life Expectancy", url: "https://www.cdc.gov/nchs/pressroom/states.htm" },
  industry: { id: 8, label: "BLS — Quarterly Census", url: "https://www.bls.gov/cew/" },
};

// ── Metric configuration ──
const METRICS = {
  gdp:              { label: "Total GDP", fmt: v => `$${d3.format(",.1f")(v)}B`, colorDir: "high-good" },
  gdpPerCapita:     { label: "GDP Per Capita", fmt: v => `$${d3.format(",.0f")(v)}`, colorDir: "high-good" },
  medianIncome:     { label: "Median Household Income", fmt: v => `$${d3.format(",.0f")(v)}`, colorDir: "high-good" },
  population:       { label: "Population", fmt: v => d3.format(",.0f")(v), colorDir: "high-good" },
  unemploymentRate: { label: "Unemployment Rate", fmt: v => `${v.toFixed(1)}%`, colorDir: "low-good" },
  obesityRate:      { label: "Adult Obesity Rate", fmt: v => `${v.toFixed(1)}%`, colorDir: "low-good" },
  uninsuredRate:    { label: "Uninsured Rate", fmt: v => `${v.toFixed(1)}%`, colorDir: "low-good" },
  lifeExpectancy:   { label: "Life Expectancy", fmt: v => `${v.toFixed(1)} yrs`, colorDir: "high-good" },
};

// ── Global state ──
let statesData = [];
let sourcesData = [];
let activeStateAbbr = null;
let currentMetric = "medianIncome";

// ── Utility helpers ──
function cite(sourceKey) {
  const s = SOURCE_INDEX[sourceKey];
  return `<sup class="cite"><a href="${s.url}" target="_blank" rel="noopener" title="${s.label}">[${s.id}]</a></sup>`;
}

function fmtNum(n) {
  if (n >= 1e12) return `$${(n/1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n/1e9).toFixed(1)}B`;
  if (n >= 1e6)  return `${(n/1e6).toFixed(2)}M`;
  return d3.format(",.0f")(n);
}

function fmtPop(n) {
  if (n >= 1e6) return `${(n/1e6).toFixed(2)}M`;
  return d3.format(",.0f")(n);
}

// ── Load data then boot ──
fetch("states_data.json")
  .then(r => r.json())
  .then(data => {
    statesData = data.states;
    sourcesData = data.sources;
    init();
  })
  .catch(err => console.error("Failed to load states_data.json:", err));

function init() {
  setupCoverScreen();
  buildMap();
  buildSources();

  // Auto-open a state panel if ?state=XX is in the URL (e.g. linked from facts page)
  const urlState = new URLSearchParams(window.location.search).get("state");
  if (urlState) {
    const s = statesData.find(x => x.abbreviation === urlState);
    if (s) setTimeout(() => openPanel(s), 800);
  }
}

// ============================================================
//  COVER SCREEN
// ============================================================
function setupCoverScreen() {
  const cover = document.getElementById("cover-screen");
  const btn = document.getElementById("cover-enter");
  if (!cover || !btn) return;

  // If already dismissed this session, skip immediately
  if (sessionStorage.getItem("cover-dismissed")) {
    cover.classList.add("hidden");
    return;
  }

  btn.addEventListener("click", () => {
    cover.classList.add("hidden");
    sessionStorage.setItem("cover-dismissed", "1");
  });
}

// ============================================================
//  MAP (D3 choropleth)
// ============================================================
const WIDTH = 960, HEIGHT = 600;
let colorScale;
let pathFn;
let svgSel;

function buildMap() {
  const container = document.getElementById("map-container");

  svgSel = d3.select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${WIDTH} ${HEIGHT}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .style("width", "100%")
    .style("height", "100%");

  const projection = d3.geoAlbersUsa()
    .scale(1300)
    .translate([WIDTH / 2, HEIGHT / 2]);

  pathFn = d3.geoPath().projection(projection);

  // Load US TopoJSON from CDN
  d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json").then(us => {
    const stateFeatures = topojson.feature(us, us.objects.states).features;

    // FIPS → abbreviation mapping
    const fipsToAbbr = {
      "01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT",
      "10":"DE","11":"DC","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL",
      "18":"IN","19":"IA","20":"KS","21":"KY","22":"LA","23":"ME","24":"MD",
      "25":"MA","26":"MI","27":"MN","28":"MS","29":"MO","30":"MT","31":"NE",
      "32":"NV","33":"NH","34":"NJ","35":"NM","36":"NY","37":"NC","38":"ND",
      "39":"OH","40":"OK","41":"OR","42":"PA","44":"RI","45":"SC","46":"SD",
      "47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA","54":"WV",
      "55":"WI","56":"WY"
    };

    const abbrToState = {};
    statesData.forEach(s => abbrToState[s.abbreviation] = s);

    // Annotate features
    stateFeatures.forEach(f => {
      const abbr = fipsToAbbr[String(f.id).padStart(2,"0")];
      f.abbr = abbr;
      f.stateData = abbrToState[abbr] || null;
    });

    // Build color scale
    updateColorScale(stateFeatures);

    // Draw paths
    svgSel.selectAll("path.state-path")
      .data(stateFeatures.filter(f => f.stateData))
      .enter()
      .append("path")
      .attr("class", "state-path")
      .attr("d", pathFn)
      .attr("fill", d => colorScale(d.stateData[currentMetric] || 0))
      .on("mousemove", (event, d) => {
        if (hoverCard.style.display === "block") positionHoverCard(event);
        else onStateHover(event, d);
      })
      .on("mouseenter", onStateHover)
      .on("mouseleave", onStateLeave)
      .on("click", (event, d) => openPanel(d.stateData));

    // State abbreviation labels
    svgSel.selectAll("text.state-label")
      .data(stateFeatures.filter(f => f.stateData))
      .enter()
      .append("text")
      .attr("class", "state-label")
      .attr("transform", d => {
        const c = pathFn.centroid(d);
        return `translate(${c[0]},${c[1]})`;
      })
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("font-size", "8px")
      .attr("font-family", "'Inter', sans-serif")
      .attr("font-weight", "600")
      .attr("fill", "#fff")
      .attr("pointer-events", "none")
      .attr("opacity", 0.85)
      .text(d => d.abbr);

    buildLegend();

    // Metric dropdown
    document.getElementById("metric-select").addEventListener("change", e => {
      currentMetric = e.target.value;
      updateColorScale(stateFeatures);
      updateMapColors();
      buildLegend();
    });
  });
}

function updateColorScale(features) {
  const vals = features
    .filter(f => f.stateData)
    .map(f => f.stateData[currentMetric])
    .filter(v => v != null);

  const [lo, hi] = d3.extent(vals);
  const meta = METRICS[currentMetric];

  // "low-good" metrics use reverse scale (high = bad = dark red-ish)
  if (meta.colorDir === "low-good") {
    colorScale = d3.scaleSequential(d3.interpolateRdYlGn).domain([hi, lo]);
  } else {
    colorScale = d3.scaleSequential(d3.interpolateBlues).domain([lo * 0.6, hi]);
  }
}

function updateMapColors() {
  svgSel.selectAll("path.state-path")
    .transition().duration(500)
    .attr("fill", d => colorScale(d.stateData[currentMetric] || 0));
}

function buildLegend() {
  const legend = document.getElementById("map-legend");
  legend.innerHTML = "";

  const meta = METRICS[currentMetric];
  const vals = statesData.map(s => s[currentMetric]).filter(v => v != null);
  const [lo, hi] = d3.extent(vals);

  // Create gradient
  const gradId = "legend-grad";
  const svgEl = document.createElementNS("http://www.w3.org/2000/svg","svg");
  svgEl.setAttribute("width","200");
  svgEl.setAttribute("height","14");
  svgEl.style.borderRadius = "6px";
  svgEl.style.overflow = "hidden";

  const defs = document.createElementNS("http://www.w3.org/2000/svg","defs");
  const grad = document.createElementNS("http://www.w3.org/2000/svg","linearGradient");
  grad.setAttribute("id", gradId);
  grad.setAttribute("x1","0%"); grad.setAttribute("x2","100%");
  grad.setAttribute("y1","0%"); grad.setAttribute("y2","0%");

  for (let i=0;i<=10;i++) {
    const t = i/10;
    const v = lo + t*(hi-lo);
    const stop = document.createElementNS("http://www.w3.org/2000/svg","stop");
    stop.setAttribute("offset",`${t*100}%`);
    stop.setAttribute("stop-color", colorScale(v));
    grad.appendChild(stop);
  }
  defs.appendChild(grad);
  svgEl.appendChild(defs);

  const rect = document.createElementNS("http://www.w3.org/2000/svg","rect");
  rect.setAttribute("width","200"); rect.setAttribute("height","14");
  rect.setAttribute("rx","6"); rect.setAttribute("fill",`url(#${gradId})`);
  svgEl.appendChild(rect);

  const loSpan = document.createElement("span");
  loSpan.textContent = meta.fmt(lo);
  loSpan.style.fontSize = ".72rem";
  loSpan.style.color = "var(--text-light)";

  const hiSpan = document.createElement("span");
  hiSpan.textContent = meta.fmt(hi);
  hiSpan.style.fontSize = ".72rem";
  hiSpan.style.color = "var(--text-light)";

  const metaLabel = document.createElement("span");
  metaLabel.textContent = meta.label;
  metaLabel.style.fontSize = ".78rem";
  metaLabel.style.fontWeight = "600";
  metaLabel.style.color = "var(--text-mid)";
  metaLabel.style.marginRight = "auto";

  legend.appendChild(metaLabel);
  legend.appendChild(loSpan);
  legend.appendChild(svgEl);
  legend.appendChild(hiSpan);
}

const hoverCard = document.getElementById("map-tooltip");

function onStateHover(event, d) {
  if (!d.stateData) return;
  const s = d.stateData;

  // Pick a random fun fact for this state to show in the card
  const facts = [s.funFact1, s.funFact2, s.funFact3].filter(Boolean);
  const fact = facts[Math.floor(Math.random() * facts.length)];

  hoverCard.innerHTML = `
    <div class="hc-header">
      <div class="hc-abbr">${s.abbreviation}</div>
      <div>
        <div class="hc-name">${s.name}</div>
        <div class="hc-region">${s.region} · Capital: ${s.capital}</div>
      </div>
    </div>
    <div class="hc-stats">
      <div class="hc-stat">
        <span class="hc-stat-label">Population</span>
        <span class="hc-stat-value">${fmtPop(s.population)}</span>
      </div>
      <div class="hc-stat">
        <span class="hc-stat-label">GDP</span>
        <span class="hc-stat-value">$${s.gdp.toFixed(0)}B</span>
      </div>
      <div class="hc-stat">
        <span class="hc-stat-label">Med. Income</span>
        <span class="hc-stat-value">$${d3.format(",.0f")(s.medianIncome)}</span>
      </div>
      <div class="hc-stat">
        <span class="hc-stat-label">Life Expectancy</span>
        <span class="hc-stat-value">${s.lifeExpectancy.toFixed(1)} yrs</span>
      </div>
      ${fact ? `
      <div class="hc-highlight">
        <div class="hc-highlight-label">Did you know?</div>
        <div class="hc-highlight-val">${fact.length > 100 ? fact.slice(0, 97) + "…" : fact}</div>
      </div>` : ""}
    </div>
    <div class="hc-hint">Click to explore full profile</div>
  `;

  positionHoverCard(event);
  hoverCard.style.display = "block";
}

function positionHoverCard(event) {
  const cw = hoverCard.offsetWidth || 260;
  const ch = hoverCard.offsetHeight || 200;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let x = event.clientX + 18;
  let y = event.clientY - 10;
  if (x + cw > vw - 12) x = event.clientX - cw - 18;
  if (y + ch > vh - 12) y = vh - ch - 12;
  hoverCard.style.left = x + "px";
  hoverCard.style.top = y + "px";
}

function onStateLeave() {
  hoverCard.style.display = "none";
}

// ============================================================
//  STATE PANEL
// ============================================================
const panel = document.getElementById("state-panel");
const overlay = document.getElementById("panel-overlay");
const panelContent = document.getElementById("panel-content");
document.getElementById("panel-close").addEventListener("click", closePanel);
overlay.addEventListener("click", closePanel);

document.addEventListener("keydown", e => {
  if (e.key === "Escape") closePanel();
});

function openPanel(s) {
  activeStateAbbr = s.abbreviation;
  panelContent.innerHTML = buildPanelHTML(s);
  panel.classList.add("open");
  overlay.classList.add("visible");
  document.body.style.overflow = "hidden";

  // Set up tab switching
  panelContent.querySelectorAll(".panel-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      panelContent.querySelectorAll(".panel-tab").forEach(b => b.classList.remove("active"));
      panelContent.querySelectorAll(".panel-tab-content").forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      panelContent.querySelector(`#tab-${btn.dataset.tab}`).classList.add("active");
    });
  });

  // Highlight on map
  svgSel && svgSel.selectAll("path.state-path")
    .classed("active", d => d.abbr === s.abbreviation);
}

function closePanel() {
  panel.classList.remove("open");
  overlay.classList.remove("visible");
  document.body.style.overflow = "";
  activeStateAbbr = null;
  svgSel && svgSel.selectAll("path.state-path").classed("active", false);
}

function buildPanelHTML(s) {
  const industries = s.topIndustries.split(",").map(i => i.trim()).filter(Boolean);
  const employers = s.majorEmployers.split(",").map(e => e.trim()).filter(Boolean);

  return `
    <div class="panel-state-header">
      <div class="panel-state-abbr">${s.abbreviation}</div>
      <div>
        <div class="panel-state-name">${s.name}</div>
        <div class="panel-state-meta">
          <span>${s.capital}</span>
          <span>${s.region}</span>
        </div>
      </div>
    </div>

    <div class="panel-tabs" role="tablist">
      <button class="panel-tab active" data-tab="overview" role="tab">Overview</button>
      <button class="panel-tab" data-tab="economy" role="tab">Economy</button>
      <button class="panel-tab" data-tab="health" role="tab">Health</button>
      <button class="panel-tab" data-tab="industry" role="tab">Industries</button>
      <button class="panel-tab" data-tab="facts" role="tab">Fun Facts</button>
    </div>

    <!-- OVERVIEW TAB -->
    <div id="tab-overview" class="panel-tab-content active">
      <div class="stat-grid">
        <div class="stat-card full">
          <div class="stat-label">Population (2024 est.)${cite("pop")}</div>
          <div class="stat-value large">${fmtPop(s.population)}</div>
          <div class="stat-source">Annual change: ${s.popChange > 0 ? "+" : ""}${s.popChange.toFixed(2)}%</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Capital</div>
          <div class="stat-value">${s.capital}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Region</div>
          <div class="stat-value">${s.region}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total GDP${cite("gdp")}</div>
          <div class="stat-value">$${s.gdp.toFixed(1)}<span class="stat-unit">B</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-label">GDP Per Capita${cite("gdp")}</div>
          <div class="stat-value">$${d3.format(",.0f")(s.gdpPerCapita)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Median Household Income${cite("income")}</div>
          <div class="stat-value">$${d3.format(",.0f")(s.medianIncome)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Unemployment Rate${cite("unemp")}</div>
          <div class="stat-value">${s.unemploymentRate.toFixed(1)}<span class="stat-unit">%</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Life Expectancy${cite("lifeexp")}</div>
          <div class="stat-value">${s.lifeExpectancy.toFixed(1)}<span class="stat-unit"> yrs</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Adult Obesity Rate${cite("obesity")}</div>
          <div class="stat-value">${s.obesityRate.toFixed(1)}<span class="stat-unit">%</span></div>
        </div>
      </div>
    </div>

    <!-- ECONOMY TAB -->
    <div id="tab-economy" class="panel-tab-content">
      <div class="stat-grid">
        <div class="stat-card full">
          <div class="stat-label">Total GDP (2024)${cite("gdp")}</div>
          <div class="stat-value large">$${s.gdp.toFixed(1)}<span class="stat-unit">B</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-label">GDP Per Capita${cite("gdp")}</div>
          <div class="stat-value">$${d3.format(",.0f")(s.gdpPerCapita)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Median Household Income${cite("income")}</div>
          <div class="stat-value">$${d3.format(",.0f")(s.medianIncome)}</div>
        </div>
        <div class="stat-card full">
          <div class="stat-label">Unemployment Rate${cite("unemp")}</div>
          <div class="stat-value">${s.unemploymentRate.toFixed(1)}<span class="stat-unit">%</span></div>
        </div>
      </div>
    </div>

    <!-- HEALTH TAB -->
    <div id="tab-health" class="panel-tab-content">
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-label">Life Expectancy${cite("lifeexp")}</div>
          <div class="stat-value large">${s.lifeExpectancy.toFixed(1)}<span class="stat-unit"> yrs</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Adult Obesity Rate${cite("obesity")}</div>
          <div class="stat-value large">${s.obesityRate.toFixed(1)}<span class="stat-unit">%</span></div>
        </div>
        <div class="stat-card full">
          <div class="stat-label">Uninsured Rate${cite("uninsured")}</div>
          <div class="stat-value">${s.uninsuredRate.toFixed(1)}<span class="stat-unit">%</span></div>
          <div class="stat-source">Percentage of population without health insurance coverage</div>
        </div>
      </div>

      <div class="panel-section-label">U.S. Context</div>
      <div class="stat-grid">
        ${healthContextCard("Life Expectancy", s.lifeExpectancy, "lifeExpectancy", "yrs", "lifeexp")}
        ${healthContextCard("Obesity Rate", s.obesityRate, "obesityRate", "%", "obesity")}
        ${healthContextCard("Uninsured Rate", s.uninsuredRate, "uninsuredRate", "%", "uninsured")}
      </div>
    </div>

    <!-- INDUSTRY TAB -->
    <div id="tab-industry" class="panel-tab-content">
      <div class="panel-section-label">Top Industries${cite("industry")}</div>
      <div class="industry-tags">
        ${industries.map(i => `<span class="industry-tag">${i}</span>`).join("")}
      </div>
      <div class="panel-section-label">Major Employers${cite("industry")}</div>
      <div class="employers-list">
        ${employers.map(e => `<span class="employer-tag">${e}</span>`).join("")}
      </div>
    </div>

    <!-- FUN FACTS TAB -->
    <div id="tab-facts" class="panel-tab-content">
      <div class="fun-fact-list">
        ${funFactCard(s.funFact1, s.funFact1Source, 1)}
        ${funFactCard(s.funFact2, s.funFact2Source, 2)}
        ${funFactCard(s.funFact3, s.funFact3Source, 3)}
      </div>
    </div>
  `;
}

function healthContextCard(label, val, key, unit, sourceKey) {
  const vals = statesData.map(s => s[key]).filter(v => v != null).sort((a,b)=>a-b);
  const rank = vals.findIndex(v => v >= val) + 1;
  const dir = METRICS[key].colorDir === "high-good" ? "higher" : "lower";
  return `
    <div class="stat-card">
      <div class="stat-label">${label}${cite(sourceKey)}</div>
      <div class="stat-value">${val.toFixed(1)}<span class="stat-unit">${unit}</span></div>
      <div class="stat-source">Ranks #${rank} of 50 states (${dir} is better)</div>
    </div>
  `;
}

function funFactCard(fact, sourceUrl, n) {
  if (!fact) return "";
  return `
    <div class="fun-fact-item">
      <div class="fun-fact-text">${fact}</div>
      <div class="fun-fact-source">
        Source: <a href="${sourceUrl}" target="_blank" rel="noopener">${sourceUrl}</a>
        <sup class="cite"><a href="${sourceUrl}" target="_blank" rel="noopener">[↗]</a></sup>
      </div>
    </div>
  `;
}

// ============================================================
//  SOURCES
// ============================================================
function buildSources() {
  // Combine per-state sources with global SOURCE_INDEX
  const globalSources = Object.values(SOURCE_INDEX).sort((a,b) => a.id - b.id);

  // Also add any additional sources from the JSON
  const jsonSources = sourcesData.map((s, i) => ({
    id: globalSources.length + i + 1,
    category: s.category || s["Data Category"] || "",
    name: s.name || s["Source Name"] || "",
    url: s.url || s["URL"] || "",
  })).filter(s => s.url);

  // Deduplicate by URL
  const seen = new Set(globalSources.map(s => s.url));
  const extra = jsonSources.filter(s => !seen.has(s.url));

  const allSources = [...globalSources, ...extra];

  const container = document.getElementById("sources-list");
  container.innerHTML = allSources.map(s => `
    <div class="source-item" id="source-${s.id}">
      <div class="source-num">${s.id}</div>
      <div class="source-info">
        <div class="source-category">${s.category || "Data Source"}</div>
        <div class="source-name">${s.label || s.name || s.url}</div>
        <div class="source-url"><a href="${s.url}" target="_blank" rel="noopener">${s.url}</a></div>
      </div>
    </div>
  `).join("");
}

