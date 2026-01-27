// js/insights.js
// Robust CSV parser + insights computed from league.csv, ranking.csv, fixtures.csv

const $ = (sel) => document.querySelector(sel);

function normKey(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/g, "");
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return { header: [], rows: [] };

  // simple CSV split (works fine for your data because values don't contain commas)
  const header = lines[0].split(",").map(h => h.trim());
  const rows = lines.slice(1).map(line => line.split(",").map(v => (v ?? "").trim()));
  return { header, rows };
}

function idxMap(header) {
  const map = new Map();
  header.forEach((h, i) => map.set(normKey(h), i));
  return map;
}

function getCol(row, map, ...names) {
  for (const n of names) {
    const i = map.get(normKey(n));
    if (i !== undefined) return row[i] ?? "";
  }
  return "";
}

function n(x, fallback = 0) {
  const v = Number(String(x ?? "").trim());
  return Number.isFinite(v) ? v : fallback;
}

function linkPlayer(name, season) {
  const p = encodeURIComponent(name);
  const s = encodeURIComponent(season);
  return `player.html?season=${s}&player=${p}`;
}

function pill(html) {
  return `<span class="pill">${html}</span>`;
}

function card({ label, value, sub = "", accent = "" }) {
  return `
    <div class="statCard ${accent}">
      <div class="k">${label}</div>
      <div class="v">${value}</div>
      <div class="s">${sub}</div>
    </div>
  `;
}

async function loadText(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch ${path} (${res.status})`);
  return await res.text();
}

async function loadAll() {
  const [leagueText, rankingText, fixturesText] = await Promise.all([
    loadText("data/league.csv"),
    loadText("data/ranking.csv"),
    loadText("data/fixtures.csv"),
  ]);

  const league = parseCSV(leagueText);
  const ranking = parseCSV(rankingText);
  const fixtures = parseCSV(fixturesText);

  return { league, ranking, fixtures };
}

function seasonsFromLeague(league) {
  const m = idxMap(league.header);
  const set = new Set();
  league.rows.forEach(r => {
    const s = getCol(r, m, "Season");
    if (s) set.add(s);
  });
  const arr = [...set].map(Number).filter(Number.isFinite).sort((a,b)=>a-b).map(String);
  return arr.length ? arr : ["1"];
}

function setSeasonUI(seasons, currentSeason) {
  const badge = $("#seasonBadge");
  const sel = $("#seasonSelect");

  badge.textContent = `Season: ${currentSeason}`;
  sel.innerHTML = "";

  seasons.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = `Season ${s}`;
    sel.appendChild(opt);
  });

  sel.value = currentSeason;

  sel.addEventListener("change", () => {
    const s = sel.value;
    const url = new URL(window.location.href);
    url.searchParams.set("season", s);
    window.location.href = url.toString();
  });
}

function filterBySeason(dataset, season) {
  const m = idxMap(dataset.header);
  const out = dataset.rows.filter(r => String(getCol(r, m, "Season")).trim() === String(season));
  return { header: dataset.header, rows: out, map: m };
}

function computeCurrentRound(fixturesRows) {
  // current round = first round that has any pending match
  const rounds = [...new Set(fixturesRows.map(f => f.round))]
    .map(Number).filter(Number.isFinite).sort((a,b)=>a-b).map(String);

  let currentRound = rounds[0] || "1";
  for (const r of rounds) {
    const hasPending = fixturesRows.some(f => f.round === r && !f.played);
    if (hasPending) { currentRound = r; break; }
  }
  return currentRound;
}

function formFromFixtures(fixturesRows) {
  // compute per-player last 5 results from PLAYED matches only
  // We don't have scores; we have Winner column. If played and winner matches player => W else L.
  const played = fixturesRows
    .filter(f => f.played)
    // sort newest first by round descending (rough proxy)
    .sort((a,b)=> Number(b.round) - Number(a.round));

  const formMap = new Map(); // player -> array of "W"/"L"
  for (const f of played) {
    const a = f.a, b = f.b, w = f.winner;
    if (!formMap.has(a)) formMap.set(a, []);
    if (!formMap.has(b)) formMap.set(b, []);

    if (formMap.get(a).length < 5) formMap.get(a).push(w === a ? "W" : "L");
    if (formMap.get(b).length < 5) formMap.get(b).push(w === b ? "W" : "L");
  }

  // score by wins count
  const ranked = [...formMap.entries()].map(([player, arr]) => {
    const wins = arr.filter(x => x === "W").length;
    return { player, arr, wins };
  }).sort((x,y)=> y.wins - x.wins || x.player.localeCompare(y.player));

  return ranked.slice(0, 6);
}

function biggestRivalry(fixturesRows) {
  const map = new Map(); // "A|B" -> count
  fixturesRows.forEach(f => {
    const a = f.a, b = f.b;
    const key = [a,b].sort().join(" | ");
    map.set(key, (map.get(key) || 0) + 1);
  });

  let best = null;
  for (const [k, count] of map.entries()) {
    if (!best || count > best.count) best = { k, count };
  }
  return best;
}

function renderInsights({ leagueS, rankingS, fixturesS, season }) {
  // --- League table leaders
  const lm = leagueS.map;
  const leagueRows = leagueS.rows.map(r => ({
    pos: n(getCol(r, lm, "Pos", "Position")),
    player: getCol(r, lm, "Player"),
    p: n(getCol(r, lm, "P", "Games Played")),
    w: n(getCol(r, lm, "W", "Wins")),
    l: n(getCol(r, lm, "L", "Losses")),
    bf: n(getCol(r, lm, "BF", "Balls For")),
    ba: n(getCol(r, lm, "BA", "Balls Against")),
    bd: n(getCol(r, lm, "BD", "Ball Difference")),
    zb: n(getCol(r, lm, "7B", "7 Ballers", "7 Ballers")),
    bp: n(getCol(r, lm, "BP", "Bonus Points")),
    pts: n(getCol(r, lm, "PTS", "League Points (3 per win)", "League Points")),
  })).filter(x => x.player);

  // --- Ranking leaders
  const rm = rankingS.map;
  const rankingRows = rankingS.rows.map(r => ({
    pos: n(getCol(r, rm, "Position", "Pos")),
    player: getCol(r, rm, "Player"),
    wins: n(getCol(r, rm, "Wins", "W")),
    bonus: n(getCol(r, rm, "Bonus")),
    zb: n(getCol(r, rm, "7-Baller", "7 Baller", "7 Ballers", "7-Baller")),
    score: n(getCol(r, rm, "Ranking Score", "Score")),
  })).filter(x => x.player);

  // --- Fixtures parsing
  const fm = fixturesS.map;
  const fixturesRows = fixturesS.rows.map(r => {
    const round = String(getCol(r, fm, "Round")).trim();
    const a = getCol(r, fm, "Player A", "PlayerA");
    const b = getCol(r, fm, "Player B", "PlayerB");
    const playedStr = getCol(r, fm, "Played?", "Played");
    const winner = getCol(r, fm, "Winner");
    const played = normKey(playedStr) === "yes";
    return { round, a, b, played, winner };
  }).filter(f => f.round && f.a && f.b);

  const totalMatches = fixturesRows.length;
  const playedMatches = fixturesRows.filter(f => f.played).length;
  const pendingMatches = totalMatches - playedMatches;
  const completion = totalMatches ? Math.round((playedMatches / totalMatches) * 100) : 0;
  const currentRound = computeCurrentRound(fixturesRows);

  // Leaders
  const bestAttack = [...leagueRows].sort((a,b)=> b.bf - a.bf)[0];
  const bestDefense = [...leagueRows].sort((a,b)=> a.ba - b.ba)[0];
  const bestBD = [...leagueRows].sort((a,b)=> b.bd - a.bd)[0];
  const bestWinRate = [...leagueRows]
    .map(x => ({ ...x, wr: x.p ? (x.w / x.p) : 0 }))
    .sort((a,b)=> b.wr - a.wr)[0];

  const mostBonus = [...rankingRows].sort((a,b)=> b.bonus - a.bonus)[0];
  const mostWins = [...rankingRows].sort((a,b)=> b.wins - a.wins)[0];
  const most7B = [...rankingRows].sort((a,b)=> b.zb - a.zb)[0];
  const topScore = [...rankingRows].sort((a,b)=> b.score - a.score)[0];

  // Hottest form & rivalry
  const hot = formFromFixtures(fixturesRows);
  const rivalry = biggestRivalry(fixturesRows);

  // --- Render Pulse
  $("#pulseMeta").innerHTML = `
    ${pill(`Current Round <b>${currentRound}</b>`)}
    ${pill(`Played <b>${playedMatches}</b> / <b>${totalMatches}</b>`)}
    ${pill(`Completion <b>${completion}%</b>`)}
  `;

  const pulseCards = [
    { label: "Matches Played", value: playedMatches, sub: `Out of ${totalMatches}` },
    { label: "Pending Matches", value: pendingMatches, sub: `To be played` },
    { label: "Current Round", value: currentRound, sub: `First round with pending matches` },
    { label: "Players", value: leagueRows.length, sub: `Active in league.csv` },
  ];

  $("#pulseCards").innerHTML = pulseCards.map(c => card(c)).join("");

  // --- Render Leaders
  const leaders = [
    {
      label: "Best Attack (BF)",
      value: `<a class="plink" href="${linkPlayer(bestAttack.player, season)}">${bestAttack.player}</a> • ${bestAttack.bf}`,
      sub: "Most balls for",
      accent: "accentGreen",
    },
    {
      label: "Best Defense (BA)",
      value: `<a class="plink" href="${linkPlayer(bestDefense.player, season)}">${bestDefense.player}</a> • ${bestDefense.ba}`,
      sub: "Lowest balls against",
      accent: "accentBlue",
    },
    {
      label: "Best Ball Diff (BD)",
      value: `<a class="plink" href="${linkPlayer(bestBD.player, season)}">${bestBD.player}</a> • ${bestBD.bd}`,
      sub: "Net dominance",
      accent: "accentTeal",
    },
    {
      label: "Best Win Rate",
      value: `<a class="plink" href="${linkPlayer(bestWinRate.player, season)}">${bestWinRate.player}</a> • ${Math.round(bestWinRate.wr*100)}%`,
      sub: `${bestWinRate.w} wins / ${bestWinRate.p} played`,
      accent: "accentGold",
    },
    {
      label: "#1 Ranking Score",
      value: `<a class="plink" href="${linkPlayer(topScore.player, season)}">${topScore.player}</a> • ${topScore.score}`,
      sub: "Top score in ranking.csv",
    },
    {
      label: "Most Wins",
      value: `<a class="plink" href="${linkPlayer(mostWins.player, season)}">${mostWins.player}</a> • ${mostWins.wins}`,
      sub: "Wins leader (ranking.csv)",
    },
    {
      label: "Most Bonus",
      value: `<a class="plink" href="${linkPlayer(mostBonus.player, season)}">${mostBonus.player}</a> • ${mostBonus.bonus}`,
      sub: "Bonus leader (ranking.csv)",
    },
    {
      label: "Most 7-Ballers",
      value: `<a class="plink" href="${linkPlayer(most7B.player, season)}">${most7B.player}</a> • ${most7B.zb}`,
      sub: "7B leader (ranking.csv)",
    },
  ];

  $("#leadersCards").innerHTML = leaders.map(c => card(c)).join("");

  // --- Render Form list
  $("#formList").innerHTML = hot.map(x => {
    const chips = x.arr.map(r => `<span class="chip ${r === "W" ? "chipW" : "chipL"}">${r}</span>`).join("");
    return `
      <div class="rowLine">
        <a class="plink" href="${linkPlayer(x.player, season)}">${x.player}</a>
        <div class="chips">${chips}</div>
      </div>
    `;
  }).join("");

  // --- Render Rivalry
  if (rivalry) {
    const [p1, p2] = rivalry.k.split(" | ");
    $("#rivalBox").innerHTML = `
      <div class="rivalTitle">
        <a class="plink" href="${linkPlayer(p1, season)}">${p1}</a>
        <span class="muted">vs</span>
        <a class="plink" href="${linkPlayer(p2, season)}">${p2}</a>
      </div>
      <div class="rivalCount">${rivalry.count} scheduled matches</div>
      <div class="muted">Across all rounds in fixtures.csv</div>
    `;
  } else {
    $("#rivalBox").innerHTML = `<div class="muted">No fixtures found.</div>`;
  }
}

(async function main() {
  try {
    const { league, ranking, fixtures } = await loadAll();

    // season from URL (?season=1), else lowest season found
    const seasons = seasonsFromLeague(league);
    const url = new URL(window.location.href);
    const season = url.searchParams.get("season") || seasons[0] || "1";

    setSeasonUI(seasons, season);

    const leagueS = filterBySeason(league, season);
    const rankingS = filterBySeason(ranking, season);
    const fixturesS = filterBySeason(fixtures, season);

    // add map for convenience
    leagueS.map = idxMap(leagueS.header);
    rankingS.map = idxMap(rankingS.header);
    fixturesS.map = idxMap(fixturesS.header);

    renderInsights({ leagueS, rankingS, fixturesS, season });
  } catch (e) {
    // If your style.css has an error banner class, use it; otherwise this still shows
    const wrap = document.querySelector(".wrap");
    const el = document.createElement("div");
    el.className = "errorBanner";
    el.innerHTML = `<b>Couldn't load insights</b><div class="muted">${e.message}</div>`;
    wrap.prepend(el);
    console.error(e);
  }
})();
