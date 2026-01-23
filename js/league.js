/* League table + Season switcher + Insights
   Source: data/league.csv

   Expected CSV header (your working one):
   Season,Pos,Player,P,W,L,BF,BA,BD,7B,BP,PTS
*/

const LEAGUE_CSV = "data/league.csv";

const elSeasonSelect = document.getElementById("seasonSelect");
const elSeasonBadge  = document.getElementById("seasonBadge");
const elBody         = document.getElementById("leagueBody");
const elPlayersCount = document.getElementById("playersCount");
const elInsightsGrid = document.getElementById("insightsGrid");
const elSparkPTS     = document.getElementById("sparkPTS");
const elSparkBD      = document.getElementById("sparkBD");
const elErrorBox     = document.getElementById("errorBox");

function showError(msg) {
  elErrorBox.style.display = "block";
  elErrorBox.textContent = msg;
}

function hideError() {
  elErrorBox.style.display = "none";
  elErrorBox.textContent = "";
}

// Simple CSV parsing (handles basic commas; keep your CSV clean: no commas inside names)
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const header = lines[0].split(",").map(s => s.trim());
  const rows = lines.slice(1).map(line => line.split(",").map(s => (s ?? "").trim()));
  return { header, rows };
}

function idxMap(header) {
  const i = (name) => header.indexOf(name);
  const required = ["Season","Pos","Player","P","W","L","BF","BA","BD","7B","BP","PTS"];
  for (const col of required) {
    if (i(col) === -1) throw new Error(`Missing column in league.csv: ${col}`);
  }
  return {
    season: i("Season"),
    pos: i("Pos"),
    player: i("Player"),
    P: i("P"),
    W: i("W"),
    L: i("L"),
    BF: i("BF"),
    BA: i("BA"),
    BD: i("BD"),
    sevenB: i("7B"),
    BP: i("BP"),
    PTS: i("PTS")
  };
}

function toNum(v) {
  const n = Number(String(v).replace(/[^\d\-\.\+]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function computeWinPct(row, idx) {
  const p = toNum(row[idx.P]);
  const w = toNum(row[idx.W]);
  return p > 0 ? (w / p) : 0;
}

function card({ title, value, sub, tone = "neutral" }) {
  return `
    <div class="insightCard ${tone}">
      <div class="insightTitle">${title}</div>
      <div class="insightValue">${value}</div>
      <div class="insightSub">${sub || ""}</div>
    </div>
  `;
}

function sparkBars(targetEl, items, valueKey, labelKey, suffix = "") {
  targetEl.innerHTML = "";

  const max = Math.max(...items.map(x => x[valueKey]), 1);

  items.forEach((it, k) => {
    const pct = Math.round((it[valueKey] / max) * 100);
    const row = document.createElement("div");
    row.className = "sparkRow";
    row.innerHTML = `
      <div class="sparkName">${k+1}. ${it[labelKey]}</div>
      <div class="sparkBar">
        <div class="sparkFill" style="width:${pct}%"></div>
      </div>
      <div class="sparkVal">${it[valueKey]}${suffix}</div>
    `;
    targetEl.appendChild(row);
  });
}

function renderTable(rows, idx) {
  elBody.innerHTML = "";

  // Sort by Pos (numeric)
  const sorted = [...rows].sort((a, b) => toNum(a[idx.pos]) - toNum(b[idx.pos]));
  const n = sorted.length;

  sorted.forEach((r, i) => {
    const pos = toNum(r[idx.pos]);

    // Your top/bottom coloring rule:
    // top 5 green, bottom 2 red, else grey
    let posClass = "posGrey";
    if (pos <= 5) posClass = "posGreen";
    if (pos >= (n - 1)) posClass = "posRed"; // last 2 positions => n-1 and n
    // BUT if pos numbering is 1..N, bottom2 are N-1 and N:
    // If someone skipped a number, this still works mostly by using n.

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="posCell"><span class="posPill ${posClass}">${pos}</span></td>
      <td class="left strong">${r[idx.player]}</td>
      <td>${r[idx.P]}</td>
      <td>${r[idx.W]}</td>
      <td>${r[idx.L]}</td>
      <td>${r[idx.BF]}</td>
      <td>${r[idx.BA]}</td>
      <td>${r[idx.BD]}</td>
      <td>${r[idx.sevenB]}</td>
      <td>${r[idx.BP]}</td>
      <td class="strong">${r[idx.PTS]}</td>
    `;
    elBody.appendChild(tr);
  });

  elPlayersCount.textContent = `Players: ${n}`;
}

function renderInsights(rows, idx) {
  if (!rows.length) {
    elInsightsGrid.innerHTML = `<div class="muted">No data for this season.</div>`;
    elSparkPTS.innerHTML = "";
    elSparkBD.innerHTML = "";
    return;
  }

  const byPts = [...rows].sort((a,b) => toNum(b[idx.PTS]) - toNum(a[idx.PTS]));
  const byWinPct = [...rows].sort((a,b) => computeWinPct(b, idx) - computeWinPct(a, idx));
  const by7B = [...rows].sort((a,b) => toNum(b[idx.sevenB]) - toNum(a[idx.sevenB]));
  const byBD = [...rows].sort((a,b) => toNum(b[idx.BD]) - toNum(a[idx.BD]));

  const leader = byPts[0];
  const runner = byPts[1] || byPts[0];

  const gap = toNum(leader[idx.PTS]) - toNum(runner[idx.PTS]);

  const bestPctRow = byWinPct[0];
  const bestPct = Math.round(computeWinPct(bestPctRow, idx) * 100);

  const top7B = by7B[0];
  const topBD = byBD[0];

  elInsightsGrid.innerHTML = [
    card({
      title: "Leader (PTS)",
      value: `${leader[idx.player]} • ${leader[idx.PTS]}`,
      sub: `Position ${leader[idx.pos]}`,
      tone: "good"
    }),
    card({
      title: "Best Win %",
      value: `${bestPctRow[idx.player]} • ${bestPct}%`,
      sub: `${bestPctRow[idx.W]} wins / ${bestPctRow[idx.P]} played`,
      tone: "good"
    }),
    card({
      title: "Most 7-Ballers",
      value: `${top7B[idx.player]} • ${top7B[idx.sevenB]}`,
      sub: `7B this season`,
      tone: "good"
    }),
    card({
      title: "Best Ball Diff (BD)",
      value: `${topBD[idx.player]} • ${topBD[idx.BD]}`,
      sub: `BF ${topBD[idx.BF]} • BA ${topBD[idx.BA]}`,
      tone: "good"
    }),
    card({
      title: "Title Race Gap",
      value: `${gap} pts`,
      sub: `#1 vs #2 (${leader[idx.player]} vs ${runner[idx.player]})`,
      tone: gap <= 3 ? "warn" : "neutral"
    }),
    card({
      title: "Most Matches Played",
      value: `${[...rows].sort((a,b)=>toNum(b[idx.P])-toNum(a[idx.P]))[0][idx.player]}`,
      sub: `Based on P column`,
      tone: "neutral"
    })
  ].join("");

  // Spark bars (top 3)
  const top3Pts = byPts.slice(0, 3).map(r => ({
    player: r[idx.player],
    val: toNum(r[idx.PTS])
  }));

  const top3BD = byBD.slice(0, 3).map(r => ({
    player: r[idx.player],
    val: toNum(r[idx.BD])
  }));

  sparkBars(elSparkPTS, top3Pts, "val", "player", "");
  sparkBars(elSparkBD, top3BD, "val", "player", "");
}

function seasonsList(allRows, idx) {
  const set = new Set(allRows.map(r => String(r[idx.season]).trim()).filter(Boolean));
  return [...set].sort((a,b) => Number(a) - Number(b));
}

function setSeasonUI(season) {
  elSeasonBadge.textContent = `Season: ${season}`;
  // Also store in URL for sharing
  const url = new URL(window.location.href);
  url.searchParams.set("season", season);
  window.history.replaceState({}, "", url.toString());
}

function getSeasonFromURL(defaultSeason) {
  const url = new URL(window.location.href);
  return url.searchParams.get("season") || defaultSeason;
}

async function init() {
  hideError();

  try {
    const res = await fetch(LEAGUE_CSV, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load ${LEAGUE_CSV} (${res.status})`);

    const text = await res.text();
    const { header, rows } = parseCSV(text);
    const idx = idxMap(header);

    const seasons = seasonsList(rows, idx);
    if (!seasons.length) throw new Error("No seasons found in league.csv");

    // Build dropdown
    elSeasonSelect.innerHTML = "";
    seasons.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = `Season ${s}`;
      elSeasonSelect.appendChild(opt);
    });

    const defaultSeason = seasons[seasons.length - 1]; // latest
    const selectedSeason = getSeasonFromURL(defaultSeason);

    // Apply selection
    elSeasonSelect.value = selectedSeason;
    setSeasonUI(selectedSeason);

    function renderSeason(season) {
      setSeasonUI(season);

      const filtered = rows.filter(r => String(r[idx.season]).trim() === String(season));
      renderInsights(filtered, idx);
      renderTable(filtered, idx);
    }

    renderSeason(selectedSeason);

    elSeasonSelect.addEventListener("change", (e) => {
      renderSeason(e.target.value);
    });

  } catch (err) {
    showError(`Couldn't load league table: ${err.message}`);
    console.error(err);
  }
}

init();
