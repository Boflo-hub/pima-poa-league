/* League table + Season switcher + Insights (Attack/Defense focus)
   Source: data/league.csv

   Supports CSV headers like:
   - Season,Pos,Player,P,W,L,BF,BA,BD,7B,BP,PTS
   - Season,Position,Player,Games Played,Wins,Losses,Balls For,Balls Against,Ball Difference,7- Ballers,Bonus Points,League Points (3 per win)
*/

const LEAGUE_CSV = "data/league.csv";

const elSeasonSelect = document.getElementById("seasonSelect");
const elSeasonBadge  = document.getElementById("seasonBadge");
const elBody         = document.getElementById("leagueBody");
const elPlayersCount = document.getElementById("playersCount");
const elInsightsGrid = document.getElementById("insightsGrid");
const elSparkPTS     = document.getElementById("sparkPTS"); // used for BF
const elSparkBD      = document.getElementById("sparkBD");  // used for BA
const elErrorBox     = document.getElementById("errorBox");

function showError(msg) {
  elErrorBox.style.display = "block";
  elErrorBox.textContent = msg;
}

function hideError() {
  elErrorBox.style.display = "none";
  elErrorBox.textContent = "";
}

function esc(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function playerLink(season, player){
  return `player.html?season=${encodeURIComponent(season)}&player=${encodeURIComponent(player)}`;
}

// Simple CSV parsing (keep your CSV clean: no commas inside names)
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const header = lines[0].split(",").map(s => s.trim());
  const rows = lines.slice(1).map(line => line.split(",").map(s => (s ?? "").trim()));
  return { header, rows };
}

function idxMap(header) {
  const norm = (s) =>
    String(s || "")
      .replace(/^\uFEFF/, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/\s*-\s*/g, "-");

  const H = header.map(norm);

  const pick = (...names) => {
    for (const name of names) {
      const k = norm(name);
      const idx = H.indexOf(k);
      if (idx !== -1) return idx;
    }
    throw new Error(`Missing column in league.csv: ${names[0]}`);
  };

  return {
    season: pick("Season"),
    pos:    pick("Pos", "Position"),
    player: pick("Player"),
    P:      pick("P", "Games Played"),
    W:      pick("W", "Wins"),
    L:      pick("L", "Losses"),
    BF:     pick("BF", "Balls For"),
    BA:     pick("BA", "Balls Against"),
    BD:     pick("BD", "Ball Difference"),
    sevenB: pick("7B", "7-Ballers", "7- Ballers", "7-ballers"),
    BP:     pick("BP", "Bonus Points"),
    PTS:    pick("PTS", "League Points (3 per win)", "League Points")
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

function sparkBars(targetEl, items, valueKey, labelKey, suffix = "", invert = false) {
  targetEl.innerHTML = "";

  const values = items.map(x => x[valueKey]);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);

  items.forEach((it, k) => {
    let pct;
    if (!invert) {
      pct = Math.round((it[valueKey] / max) * 100);
    } else {
      const span = (max - min) || 1;
      pct = Math.round(((max - it[valueKey]) / span) * 100);
      pct = Math.max(pct, 8);
    }

    const row = document.createElement("div");
    row.className = "sparkRow";
    row.innerHTML = `
      <div class="sparkName">${k + 1}. ${esc(it[labelKey])}</div>
      <div class="sparkBar">
        <div class="sparkFill" style="width:${pct}%"></div>
      </div>
      <div class="sparkVal">${it[valueKey]}${suffix}</div>
    `;
    targetEl.appendChild(row);
  });
}

// ✅ now takes "season" so we can build player links
function renderTable(rows, idx, season) {
  elBody.innerHTML = "";

  const sorted = [...rows].sort((a, b) => toNum(a[idx.pos]) - toNum(b[idx.pos]));
  const totalPlayers = sorted.length;

  sorted.forEach((r) => {
    const pos = toNum(r[idx.pos]);

    let posClass = "posGrey";
    if (pos <= 5) posClass = "posGreen";
    if (pos >= (totalPlayers - 1)) posClass = "posRed";

    const playerName = r[idx.player];

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="posCell"><span class="posPill ${posClass}">${pos}</span></td>
      <td class="left strong">
        <a class="plink" href="${playerLink(season, playerName)}">${esc(playerName)}</a>
      </td>
      <td>${esc(r[idx.P])}</td>
      <td>${esc(r[idx.W])}</td>
      <td>${esc(r[idx.L])}</td>
      <td>${esc(r[idx.BF])}</td>
      <td>${esc(r[idx.BA])}</td>
      <td>${esc(r[idx.BD])}</td>
      <td>${esc(r[idx.sevenB])}</td>
      <td>${esc(r[idx.BP])}</td>
      <td class="strong">${esc(r[idx.PTS])}</td>
    `;
    elBody.appendChild(tr);
  });

  elPlayersCount.textContent = `Players: ${totalPlayers}`;
}

// ✅ now takes "season" so insight names can link too
function renderInsights(rows, idx, season) {
  if (!rows.length) {
    elInsightsGrid.innerHTML = `<div class="muted">No data for this season.</div>`;
    elSparkPTS.innerHTML = "";
    elSparkBD.innerHTML = "";
    return;
  }

  const byPts   = [...rows].sort((a,b) => toNum(b[idx.PTS]) - toNum(a[idx.PTS]));
  const byWinPc = [...rows].sort((a,b) => computeWinPct(b, idx) - computeWinPct(a, idx));
  const byBF    = [...rows].sort((a,b) => toNum(b[idx.BF]) - toNum(a[idx.BF]));
  const byBA    = [...rows].sort((a,b) => toNum(a[idx.BA]) - toNum(b[idx.BA]));
  const byBD    = [...rows].sort((a,b) => toNum(b[idx.BD]) - toNum(a[idx.BD]));
  const by7B    = [...rows].sort((a,b) => toNum(b[idx.sevenB]) - toNum(a[idx.sevenB]));

  const leader = byPts[0];
  const runner = byPts[1] || byPts[0];
  const gap = toNum(leader[idx.PTS]) - toNum(runner[idx.PTS]);

  const bestPctRow = byWinPc[0];
  const bestPct = Math.round(computeWinPct(bestPctRow, idx) * 100);

  const bestAttack  = byBF[0];
  const bestDefense = byBA[0];
  const bestDiff    = byBD[0];
  const most7B      = by7B[0];

  const linkP = (p) => `<a class="plink" href="${playerLink(season, p)}"><strong>${esc(p)}</strong></a>`;

  elInsightsGrid.innerHTML = [
    card({
      title: "Best Attack (BF)",
      value: `${linkP(bestAttack[idx.player])} • ${esc(bestAttack[idx.BF])}`,
      sub: `Balls For leader`,
      tone: "good"
    }),
    card({
      title: "Best Defense (BA)",
      value: `${linkP(bestDefense[idx.player])} • ${esc(bestDefense[idx.BA])}`,
      sub: `Lowest Balls Against`,
      tone: "good"
    }),
    card({
      title: "Best Ball Diff (BD)",
      value: `${linkP(bestDiff[idx.player])} • ${esc(bestDiff[idx.BD])}`,
      sub: `Net dominance`,
      tone: "good"
    }),
    card({
      title: "Most 7-Ballers",
      value: `${linkP(most7B[idx.player])} • ${esc(most7B[idx.sevenB])}`,
      sub: `7B this season`,
      tone: "neutral"
    }),
    card({
      title: "Best Win %",
      value: `${linkP(bestPctRow[idx.player])} • ${bestPct}%`,
      sub: `${esc(bestPctRow[idx.W])} wins / ${esc(bestPctRow[idx.P])} played`,
      tone: "neutral"
    }),
    card({
      title: "Title Race Gap",
      value: `${gap} pts`,
      sub: `#1 vs #2 (${esc(leader[idx.player])} vs ${esc(runner[idx.player])})`,
      tone: gap <= 3 ? "warn" : "neutral"
    })
  ].join("");

  const sparkTitles = document.querySelectorAll(".sparkTitle");
  if (sparkTitles.length >= 2) {
    sparkTitles[0].textContent = "Top 3 Balls For (BF)";
    sparkTitles[1].textContent = "Top 3 Defense (Lowest BA)";
  }

  const top3BF = byBF.slice(0,3).map(r => ({ player: r[idx.player], val: toNum(r[idx.BF]) }));
  const top3BA = byBA.slice(0,3).map(r => ({ player: r[idx.player], val: toNum(r[idx.BA]) }));

  sparkBars(elSparkPTS, top3BF, "val", "player", "");
  sparkBars(elSparkBD, top3BA, "val", "player", "", true);
}

function seasonsList(allRows, idx) {
  const set = new Set(allRows.map(r => String(r[idx.season]).trim()).filter(Boolean));
  return [...set].sort((a,b) => Number(a) - Number(b));
}

function setSeasonUI(season) {
  elSeasonBadge.textContent = `Season: ${season}`;
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

    elSeasonSelect.innerHTML = "";
    seasons.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = `Season ${s}`;
      elSeasonSelect.appendChild(opt);
    });

    const defaultSeason = seasons[seasons.length - 1];
    const selectedSeason = getSeasonFromURL(defaultSeason);

    elSeasonSelect.value = selectedSeason;
    setSeasonUI(selectedSeason);

    function renderSeason(season) {
      setSeasonUI(season);
      const filtered = rows.filter(r => String(r[idx.season]).trim() === String(season));
      renderInsights(filtered, idx, season);
      renderTable(filtered, idx, season);
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
