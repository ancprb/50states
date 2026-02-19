/* =============================================
   THE STATES — Fun Facts Page
   ============================================= */

let statesData = [];
let activeRegion = null;

fetch("states_data.json")
  .then(r => r.json())
  .then(data => {
    statesData = data.states;
    init();
  })
  .catch(err => console.error("Failed to load states_data.json:", err));

function init() {
  buildRegionChips();
  document.getElementById("facts-search").addEventListener("input", renderFacts);
  renderFacts();
}

function buildRegionChips() {
  const regions = [...new Set(statesData.map(s => s.region))].sort();
  const bar = document.getElementById("facts-region-filters");

  const allChip = makeChip("All Regions", true, () => { activeRegion = null; setActive(allChip); renderFacts(); });
  bar.appendChild(allChip);

  regions.forEach(r => {
    const chip = makeChip(r, false, () => { activeRegion = r; setActive(chip); renderFacts(); });
    bar.appendChild(chip);
  });

  function setActive(el) {
    bar.querySelectorAll(".region-chip").forEach(c => c.classList.remove("active"));
    el.classList.add("active");
  }
}

function makeChip(label, active, onClick) {
  const btn = document.createElement("button");
  btn.className = "region-chip" + (active ? " active" : "");
  btn.textContent = label;
  btn.addEventListener("click", onClick);
  return btn;
}

function allFacts() {
  const out = [];
  statesData.forEach(s => {
    [[s.funFact1, s.funFact1Source, 1],
     [s.funFact2, s.funFact2Source, 2],
     [s.funFact3, s.funFact3Source, 3]].forEach(([text, src, n]) => {
      if (text) out.push({ state: s.name, abbr: s.abbreviation, region: s.region, text, source: src, factNum: n });
    });
  });
  return out;
}

function renderFacts() {
  const query = document.getElementById("facts-search").value.trim().toLowerCase();
  const grid = document.getElementById("facts-grid");
  const countEl = document.getElementById("facts-count");

  let filtered = allFacts();
  if (activeRegion) filtered = filtered.filter(f => f.region === activeRegion);
  if (query) filtered = filtered.filter(f =>
    f.text.toLowerCase().includes(query) ||
    f.state.toLowerCase().includes(query) ||
    f.abbr.toLowerCase().includes(query)
  );

  const total = allFacts().length;
  countEl.textContent = filtered.length === total
    ? `${total} facts across all 50 states`
    : `${filtered.length} of ${total} facts`;

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="facts-empty">No facts match your search. Try a different term.</div>`;
    return;
  }

  grid.innerHTML = filtered.map(f => {
    const domain = (() => { try { return new URL(f.source).hostname.replace("www.", ""); } catch { return f.source; } })();
    return `
      <div class="fact-card" data-abbr="${f.abbr}" role="button" tabindex="0"
           aria-label="${f.state}: ${f.text}">
        <div class="fact-card-watermark">${f.abbr}</div>
        <div class="fact-card-header">
          <div class="fact-card-abbr">${f.abbr}</div>
          <div>
            <div class="fact-card-state">${f.state}</div>
            <div class="fact-card-region">${f.region}</div>
          </div>
          <span class="fact-card-num">Fact ${f.factNum}</span>
        </div>
        <p class="fact-card-text">${f.text}</p>
        <div class="fact-card-footer">
          <span class="fact-card-source">
            <a href="${f.source}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${domain}</a>
            <sup class="cite"><a href="${f.source}" target="_blank" rel="noopener" onclick="event.stopPropagation()">[↗]</a></sup>
          </span>
          <span class="fact-card-cta">View state &rarr;</span>
        </div>
      </div>
    `;
  }).join("");

  // Click → go to explore page with state panel open via URL param
  grid.querySelectorAll(".fact-card").forEach(card => {
    const handler = () => {
      window.location.href = `index.html?state=${card.dataset.abbr}`;
    };
    card.addEventListener("click", handler);
    card.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") handler(); });
  });
}
