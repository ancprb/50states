/* =============================================
   THE STATES — Sources Page
   ============================================= */

const SOURCE_INDEX = {
  gdp:      { id: 1, label: "BEA — GDP by State", category: "Economics", url: "https://www.bea.gov/data/gdp/gdp-state" },
  income:   { id: 2, label: "Census ACS — Median Household Income", category: "Economics", url: "https://data.census.gov/table/ACSST1Y2023.S1901" },
  unemp:    { id: 3, label: "BLS — Local Area Unemployment Statistics", category: "Economics", url: "https://www.bls.gov/lau/" },
  pop:      { id: 4, label: "Census — Population Estimates Program", category: "Demographics", url: "https://www.census.gov/programs-surveys/popest.html" },
  obesity:  { id: 5, label: "CDC — Adult Obesity Prevalence Maps", category: "Health", url: "https://www.cdc.gov/obesity/data-and-statistics/adult-obesity-prevalence-maps.html" },
  uninsured:{ id: 6, label: "Census — Health Insurance Coverage", category: "Health", url: "https://www2.census.gov/library/publications/2025/demo/acsbr-024.pdf" },
  lifeexp:  { id: 7, label: "CDC NCHS — Life Expectancy by State", category: "Health", url: "https://www.cdc.gov/nchs/pressroom/states.htm" },
  industry: { id: 8, label: "BLS — Quarterly Census of Employment and Wages", category: "Economics", url: "https://www.bls.gov/cew/" },
};

fetch("states_data.json")
  .then(r => r.json())
  .then(data => {
    const globalSources = Object.values(SOURCE_INDEX).sort((a, b) => a.id - b.id);

    const jsonSources = (data.sources || []).map((s, i) => ({
      id: globalSources.length + i + 1,
      category: s["Data Category"] || s.category || "Reference",
      label: s["Source Name"] || s.name || s.url,
      url: s["URL"] || s.url || "",
    })).filter(s => s.url);

    const seen = new Set(globalSources.map(s => s.url));
    const extra = jsonSources.filter(s => !seen.has(s.url));
    const allSources = [...globalSources, ...extra];

    // Group by category
    const groups = {};
    allSources.forEach(s => {
      const cat = s.category || "Other";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(s);
    });

    const container = document.getElementById("sources-list");
    container.innerHTML = Object.entries(groups).map(([cat, items]) => `
      <div class="sources-group">
        <div class="sources-group-label">${cat}</div>
        ${items.map(s => `
          <div class="source-item">
            <div class="source-num">${s.id}</div>
            <div class="source-info">
              <div class="source-name">${s.label}</div>
              <div class="source-url"><a href="${s.url}" target="_blank" rel="noopener">${s.url}</a></div>
            </div>
          </div>
        `).join("")}
      </div>
    `).join("");
  })
  .catch(err => {
    document.getElementById("sources-list").innerHTML =
      `<p style="color:var(--text-light);text-align:center;padding:40px 0;">Could not load sources. Make sure the server is running.</p>`;
    console.error(err);
  });
