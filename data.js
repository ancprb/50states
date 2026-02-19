/* =============================================
   THE STATES — Data Page (Rankings + Compare)
   ============================================= */

// ── Shared constants (duplicated from app.js for page independence) ──
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

const COMPARE_METRICS = [
  { key: "gdp",              label: "Total GDP",                fmt: v => `$${v.toFixed(0)}B`,              source: "gdp"      },
  { key: "gdpPerCapita",     label: "GDP Per Capita",           fmt: v => `$${d3.format(",.0f")(v)}`,       source: "gdp"      },
  { key: "medianIncome",     label: "Median Household Income",  fmt: v => `$${d3.format(",.0f")(v)}`,       source: "income"   },
  { key: "unemploymentRate", label: "Unemployment Rate",        fmt: v => `${v.toFixed(1)}%`,               source: "unemp"    },
  { key: "obesityRate",      label: "Adult Obesity Rate",       fmt: v => `${v.toFixed(1)}%`,               source: "obesity"  },
  { key: "uninsuredRate",    label: "Uninsured Rate",           fmt: v => `${v.toFixed(1)}%`,               source: "uninsured"},
  { key: "lifeExpectancy",   label: "Life Expectancy",          fmt: v => `${v.toFixed(1)} yrs`,            source: "lifeexp"  },
  { key: "population",       label: "Population",               fmt: v => fmtPop(v),                        source: "pop"      },
];

// ── State ──
let statesData = [];
let rankDesc = true;
let compareA = "CA";
let compareB = "TX";
// Track which ranking row slot to fill next (alternates A → B → A …)
let nextSlot = "a";

function fmtPop(n) {
  if (n >= 1e6) return `${(n/1e6).toFixed(2)}M`;
  return d3.format(",.0f")(n);
}

function cite(sourceKey) {
  const s = SOURCE_INDEX[sourceKey];
  return `<sup class="cite"><a href="${s.url}" target="_blank" rel="noopener" title="${s.label}">[${s.id}]</a></sup>`;
}

// ── Boot ──
fetch("states_data.json")
  .then(r => r.json())
  .then(data => {
    statesData = data.states;
    init();
  })
  .catch(err => console.error("Failed to load states_data.json:", err));

function init() {
  buildCompareSelectors();
  buildRankings();
  setupListeners();
  renderCompare();
}

// ── Rankings ──
function buildRankings() {
  const metric = document.getElementById("ranking-metric").value;
  const meta = METRICS[metric];
  const sorted = [...statesData]
    .filter(s => s[metric] != null)
    .sort((a, b) => rankDesc ? b[metric] - a[metric] : a[metric] - b[metric]);

  const vals = sorted.map(s => s[metric]);
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const range = max - min || 1;

  const container = document.getElementById("rankings-table");
  container.innerHTML = sorted.map((s, i) => {
    const pct = ((s[metric] - min) / range * 100).toFixed(1);
    const barWidth = rankDesc ? pct : (100 - parseFloat(pct));
    const isA = s.abbreviation === compareA;
    const isB = s.abbreviation === compareB;
    const rowClass = isA ? "ranking-row selected-a" : isB ? "ranking-row selected-b" : "ranking-row";
    const badge = isA
      ? `<span class="rank-badge rank-badge-a">A</span>`
      : isB ? `<span class="rank-badge rank-badge-b">B</span>` : "";

    return `
      <div class="${rowClass}" data-abbr="${s.abbreviation}">
        <span class="rank-num">${i + 1}</span>
        <span class="rank-abbr">${s.abbreviation}</span>
        <span class="rank-name">${s.name}</span>
        <div class="rank-bar-track">
          <div class="rank-bar-fill" style="width:${barWidth}%"></div>
        </div>
        <span class="rank-value">${meta.fmt(s[metric])}</span>
        ${badge}
      </div>
    `;
  }).join("");

  // Click a row → assign to next slot, then flip
  container.querySelectorAll(".ranking-row").forEach(row => {
    row.addEventListener("click", () => {
      const abbr = row.dataset.abbr;
      if (nextSlot === "a") {
        compareA = abbr;
        document.getElementById("compare-a").value = abbr;
        nextSlot = "b";
      } else {
        compareB = abbr;
        document.getElementById("compare-b").value = abbr;
        nextSlot = "a";
      }
      buildRankings(); // re-render to update highlights
      renderCompare();
      // Scroll compare pane to top
      document.querySelector(".compare-pane").scrollTo({ top: 0, behavior: "smooth" });
      updateInstruction();
    });
  });
}

function updateInstruction() {
  const el = document.getElementById("compare-instruction");
  const slotLabel = nextSlot === "a" ? "State A" : "State B";
  el.textContent = `Next click sets ${slotLabel} · or use the dropdowns below`;
}

// ── Compare selectors ──
function buildCompareSelectors() {
  const selA = document.getElementById("compare-a");
  const selB = document.getElementById("compare-b");

  statesData.forEach(s => {
    selA.appendChild(new Option(s.name, s.abbreviation));
    selB.appendChild(new Option(s.name, s.abbreviation));
  });

  selA.value = compareA;
  selB.value = compareB;
}

function setupListeners() {
  document.getElementById("ranking-metric").addEventListener("change", buildRankings);

  document.getElementById("rank-desc").addEventListener("click", () => {
    rankDesc = true;
    document.getElementById("rank-desc").classList.add("active");
    document.getElementById("rank-asc").classList.remove("active");
    buildRankings();
  });
  document.getElementById("rank-asc").addEventListener("click", () => {
    rankDesc = false;
    document.getElementById("rank-asc").classList.add("active");
    document.getElementById("rank-desc").classList.remove("active");
    buildRankings();
  });

  document.getElementById("compare-a").addEventListener("change", e => {
    compareA = e.target.value;
    buildRankings();
    renderCompare();
  });
  document.getElementById("compare-b").addEventListener("change", e => {
    compareB = e.target.value;
    buildRankings();
    renderCompare();
  });
}

// ── Compare output ──
function renderCompare() {
  const sA = statesData.find(s => s.abbreviation === compareA);
  const sB = statesData.find(s => s.abbreviation === compareB);
  if (!sA || !sB) return;

  const out = document.getElementById("compare-output");
  out.innerHTML = buildCompareHTML(sA, sB);
}

function buildCompareHTML(a, b) {
  const group1 = COMPARE_METRICS.slice(0, 4);
  const group2 = COMPARE_METRICS.slice(4);

  function barRows(group) {
    return group.map(m => {
      const vA = a[m.key], vB = b[m.key];
      const mx = Math.max(vA, vB);
      const pctA = mx > 0 ? (vA / mx * 100) : 0;
      const pctB = mx > 0 ? (vB / mx * 100) : 0;
      return `
        <div class="compare-bar-group">
          <div style="font-size:.78rem;font-weight:600;color:var(--text-mid);margin-bottom:6px;">
            ${m.label}${cite(m.source)}
          </div>
          <div style="margin-bottom:5px;">
            <div style="font-size:.7rem;display:flex;justify-content:space-between;margin-bottom:3px;">
              <span style="color:#3b82f6;font-weight:700;">${a.abbreviation}</span>
              <span style="font-weight:600;">${m.fmt(vA)}</span>
            </div>
            <div class="compare-bar-track">
              <div class="compare-bar-fill fill-a" style="width:${pctA}%"></div>
            </div>
          </div>
          <div>
            <div style="font-size:.7rem;display:flex;justify-content:space-between;margin-bottom:3px;">
              <span style="color:#f59e0b;font-weight:700;">${b.abbreviation}</span>
              <span style="font-weight:600;">${m.fmt(vB)}</span>
            </div>
            <div class="compare-bar-track">
              <div class="compare-bar-fill fill-b" style="width:${pctB}%"></div>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  return `
    <div class="compare-hero">
      <div class="compare-state-card side-a">
        <div class="compare-abbr">${a.abbreviation}</div>
        <div class="compare-name">${a.name}</div>
        <div class="compare-region">${a.region} · Pop. ${fmtPop(a.population)}</div>
      </div>
      <div class="compare-divider">VS</div>
      <div class="compare-state-card side-b">
        <div class="compare-abbr">${b.abbreviation}</div>
        <div class="compare-name">${b.name}</div>
        <div class="compare-region">${b.region} · Pop. ${fmtPop(b.population)}</div>
      </div>
    </div>
    <div class="compare-charts">
      <div class="compare-chart-card">
        <div class="compare-chart-title">Economics</div>
        ${barRows(group1)}
      </div>
      <div class="compare-chart-card">
        <div class="compare-chart-title">Health &amp; Demographics</div>
        ${barRows(group2)}
      </div>
    </div>
  `;
}
