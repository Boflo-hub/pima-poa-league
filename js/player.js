/* Player Profiles — Pima Poa League
   Reads:
   - data/league.csv    header: Season,Pos,Player,P,W,L,BF,BA,BD,7B,BP,PTS
   - data/ranking.csv   header: Season,Position,Player,Wins,Bonus,7-Baller,Ranking Score
   - data/fixtures.csv  header: Season,Round,Player A,Player B,Played?,Winner
*/

const $ = (sel) => document.querySelector(sel);

const els = {
  seasonBadge: $("#seasonBadge"),
  seasonSelect: $("#seasonSelect"),
  playerSelect: $("#playerSelect"),
  playerTitle: $("#playerTitle"),
  playerMeta: $("#playerMeta"),
  errorBox: $("#errorBox"),

  statMatches: $("#statMatches"),
  statWins: $("#statWins"),
  statLosses: $("#statLosses"),
  statWinRate: $("#statWinRate"),

  pillPTS: $("#pillPTS"),
  pillBD: $("#pillBD"),
  pill7B: $("#pill7B"),
  pillBP: $("#pillBP"),
  pillScore: $("#pillScore"),

  formRow: $("#formRow"),
  recentBody: $("#recentBody"),

  h2hOpponent: $("#h2hOpponent"),
  h2hSwap: $("#h2hSwap"),
  h2hClear: $("#h2hClear"),
  h2hMatches: $("#h2hMatches"),
  h2hPlayed: $("#h2hPlayed"),
  h2hP1Wins: $("#h2hP1Wins"),
  h2hP2Wins: $("#h2hP2Wins"),
  h2hBody: $("#h2hBody"),
};

// ---------- CSV parsing (handles commas inside quotes) ----------
function parseCSV(text) {
  const lines = text.replace(/\r/g, "").trim().split("\n");
  if (!lines.length) return { header: [], rows: [] };

  const header = splitCSVLine(lines[0]).map(h => h.trim());
  const rows = lines.slice(1).map(splitCSVLine);
  return { header, rows };
}

function splitCSVLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"' ) {
      // double quotes inside quoted field
      if (inQ && line[i+1] === '"') { cur += '"'; i++; continue; }
      inQ = !inQ;
      continue;
    }

    if (ch === "," && !inQ) {
      out.push(cur);
      cur = "";
      continue;
    }

    cur += ch;
  }
  out.push(cur);
  return out.map(v => (v ?? "").trim());
}

function showError(msg) {
  els.errorBox.style.display = "block";
  els.errorBox.textContent = msg;
}

function clearError() {
  els.errorBox.style.display = "none";
  els.errorBox.textContent = "";
}

// ---------- Load all data ----------
async function loadAll() {
  const [leagueT, rankingT, fixturesT] = await Promise.all([
    fetch("./data/league.csv").then(r => r.text()),
    fetch("./data/ranking.csv").then(r => r.text()).catch(() => ""),   // ranking optional
    fetch("./data/fixtures.csv").then(r => r.text())
  ]);

  const league = parseCSV(leagueT);
  const ranking = rankingT ? parseCSV(rankingT) : { header: [], rows: [] };
  const fixtures = parseCSV(fixturesT);

  return { league, ranking, fixtures };
}

// ---------- Helpers ----------
function uniq(arr) {
  return [...new Set(arr)];
}

function toInt(v) {
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : 0;
}

function getQuery() {
  const u = new URL(location.href);
  return {
    season: u.searchParams.get("season"),
    player: u.searchParams.get("player"),
  };
}

function setQuery({ season, player }) {
  const u = new URL(location.href);
  if (season != null) u.searchParams.set("season", season);
  if (player != null) u.searchParams.set("player", player);
  history.replaceState({}, "", u.toString());
}

// ---------- Build indexes ----------
function indexLeague(league) {
  const H = league.header;
  const idx = {
    season: H.indexOf("Season"),
    pos: H.indexOf("Pos"),
    player: H.indexOf("Player"),
    P: H.indexOf("P"),
    W: H.indexOf("W"),
    L: H.indexOf("L"),
    BF: H.indexOf("BF"),
    BA: H.indexOf("BA"),
    BD: H.indexOf("BD"),
    "7B": H.indexOf("7B"),
    BP: H.indexOf("BP"),
    PTS: H.indexOf("PTS"),
  };
  const missing = Object.entries(idx).filter(([,v]) => v === -1).map(([k]) => k);
  if (missing.length) throw new Error(`league.csv missing columns: ${missing.join(", ")}`);

  const map = new Map(); // key = season|player
  league.rows.forEach(r => {
    const season = r[idx.season];
    const player = r[idx.player];
    if (!season || !player) return;
    map.set(`${season}|${player}`, {
      season, player,
      pos: r[idx.pos],
      P: toInt(r[idx.P]),
      W: toInt(r[idx.W]),
      L: toInt(r[idx.L]),
      BF: toInt(r[idx.BF]),
      BA: toInt(r[idx.BA]),
      BD: toInt(r[idx.BD]),
      s7B: toInt(r[idx["7B"]]),
      BP: toInt(r[idx.BP]),
      PTS: toInt(r[idx.PTS]),
    });
  });

  const seasons = uniq(league.rows.map(r => r[idx.season]).filter(Boolean)).sort((a,b)=>toInt(a)-toInt(b));
  const playersBySeason = new Map();
  seasons.forEach(s => {
    const ps = league.rows
      .filter(r => r[idx.season] === s)
      .map(r => r[idx.player])
      .filter(Boolean);
    playersBySeason.set(s, uniq(ps).sort((a,b)=>a.localeCompare(b)));
  });

  return { idx, map, seasons, playersBySeason };
}

function indexRanking(ranking) {
  if (!ranking.header.length) return { ok:false, map:new Map() };

  const H = ranking.header;
  const idx = {
    season: H.indexOf("Season"),
    player: H.indexOf("Player"),
    score: H.indexOf("Ranking Score"),
  };

  // be tolerant: allow missing / slightly different headers
  if (idx.season === -1 || idx.player === -1 || idx.score === -1) return { ok:false, map:new Map() };

  const map = new Map(); // season|player -> score
  ranking.rows.forEach(r => {
    const season = r[idx.season];
    const player = r[idx.player];
    if (!season || !player) return;
    map.set(`${season}|${player}`, toInt(r[idx.score]));
  });

  return { ok:true, map };
}

function indexFixtures(fixtures) {
  const H = fixtures.header;
  const idx = {
    season: H.indexOf("Season"),
    round: H.indexOf("Round"),
    a: H.indexOf("Player A"),
    b: H.indexOf("Player B"),
    played: H.indexOf("Played?"),
    winner: H.indexOf("Winner"),
  };
  const missing = Object.entries(idx).filter(([,v]) => v === -1).map(([k]) => k);
  if (missing.length) throw new Error(`fixtures.csv missing columns: ${missing.join(", ")}`);

  const all = fixtures.rows
    .map(r => ({
      season: r[idx.season],
      round: toInt(r[idx.round]),
      a: r[idx.a],
      b: r[idx.b],
      played: String(r[idx.played] || "").toUpperCase() === "YES",
      winner: r[idx.winner] || "",
    }))
    .filter(x => x.season && x.round && x.a && x.b);

  return { all };
}

// ---------- UI ----------
function fillSelect(select, options, value, fmt = (v)=>v) {
  select.innerHTML = "";
  options.forEach(v => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = fmt(v);
    select.appendChild(opt);
  });
  if (value && options.includes(value)) select.value = value;
}

function badgeSeason(season) {
  els.seasonBadge.textContent = `Season: ${season}`;
}

// ---------- Stats ----------
function getPlayerFixtures(fixturesAll, season, player) {
  return fixturesAll
    .filter(m => m.season === season && (m.a === player || m.b === player))
    .sort((x,y)=> y.round - x.round); // newest first
}

function summarizeMatches(matches, player) {
  const played = matches.filter(m => m.played);
  const wins = played.filter(m => m.winner === player).length;
  const losses = played.length - wins;

  const winRate = played.length ? Math.round((wins / played.length) * 100) : 0;

  return { total: matches.length, played: played.length, wins, losses, winRate };
}

function renderForm(matches, player) {
  els.formRow.innerHTML = "";
  const last10 = matches.slice(0, 10).reverse(); // oldest -> newest visually
  last10.forEach(m => {
    const chip = document.createElement("div");
    chip.className = "chip";

    if (!m.played) { chip.classList.add("p"); chip.textContent = "P"; }
    else if (m.winner === player) { chip.classList.add("w"); chip.textContent = "W"; }
    else { chip.classList.add("l"); chip.textContent = "L"; }

    chip.title = `Round ${m.round}: ${m.a} vs ${m.b}`;
    els.formRow.appendChild(chip);
  });

  if (!last10.length) {
    const t = document.createElement("div");
    t.style.opacity = ".75";
    t.textContent = "No fixtures found for this player/season.";
    els.formRow.appendChild(t);
  }
}

function renderRecent(matches, player) {
  els.recentBody.innerHTML = "";
  const take = matches.slice(0, 12);

  take.forEach(m => {
    const opp = (m.a === player) ? m.b : m.a;
    const status = m.played ? "Played" : "Pending";

    let resultText = "—";
    let dotClass = "amber";
    if (m.played) {
      if (m.winner === player) { resultText = "Win"; dotClass = ""; }
      else { resultText = "Loss"; dotClass = "red"; }
    } else {
      resultText = "—";
      dotClass = "amber";
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>R${m.round}</td>
      <td>${opp}</td>
      <td><span class="pill"><span class="dot ${dotClass}"></span>${resultText}</span></td>
      <td class="right">${status}</td>
    `;
    els.recentBody.appendChild(tr);
  });

  if (!take.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="4" style="opacity:.75;">No matches yet.</td>`;
    els.recentBody.appendChild(tr);
  }
}

function renderTotals(leagueRow, rankingScore) {
  els.pillPTS.textContent = leagueRow ? leagueRow.PTS : "—";
  els.pillBD.textContent  = leagueRow ? leagueRow.BD  : "—";
  els.pill7B.textContent  = leagueRow ? leagueRow.s7B : "—";
  els.pillBP.textContent  = leagueRow ? leagueRow.BP  : "—";
  els.pillScore.textContent = (rankingScore != null) ? rankingScore : "—";
}

// ---------- Head to Head ----------
function buildOpponentList(players, currentPlayer) {
  return players.filter(p => p !== currentPlayer);
}

function h2hMatchesFor(fixturesAll, season, p1, p2) {
  return fixturesAll
    .filter(m => m.season === season && (
      (m.a === p1 && m.b === p2) || (m.a === p2 && m.b === p1)
    ))
    .sort((x,y)=> y.round - x.round);
}

function renderH2H(fixturesAll, season, p1, p2) {
  if (!p2) {
    els.h2hMatches.textContent = "—";
    els.h2hPlayed.textContent = "—";
    els.h2hP1Wins.textContent = "—";
    els.h2hP2Wins.textContent = "—";
    els.h2hBody.innerHTML = `<tr><td colspan="3" style="opacity:.75;">Pick an opponent to compare.</td></tr>`;
    return;
  }

  const ms = h2hMatchesFor(fixturesAll, season, p1, p2);
  const played = ms.filter(m => m.played);
  const p1Wins = played.filter(m => m.winner === p1).length;
  const p2Wins = played.filter(m => m.winner === p2).length;

  els.h2hMatches.textContent = String(ms.length);
  els.h2hPlayed.textContent = String(played.length);
  els.h2hP1Wins.textContent = String(p1Wins);
  els.h2hP2Wins.textContent = String(p2Wins);

  els.h2hBody.innerHTML = "";
  const show = ms.slice(0, 14);
  show.forEach(m => {
    const status = m.played ? "Played" : "Pending";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>R${m.round}</td>
      <td>${m.a} vs ${m.b}</td>
      <td class="right">${status}</td>
    `;
    els.h2hBody.appendChild(tr);
  });

  if (!show.length) {
    els.h2hBody.innerHTML = `<tr><td colspan="3" style="opacity:.75;">No fixtures between these two yet.</td></tr>`;
  }
}

// ---------- Main ----------
(async function init(){
  try {
    clearError();

    const data = await loadAll();
    const leagueIdx = indexLeague(data.league);
    const rankingIdx = indexRanking(data.ranking);
    const fixturesIdx = indexFixtures(data.fixtures);

    // pick season + player
    const q = getQuery();
    const season = (q.season && leagueIdx.seasons.includes(q.season)) ? q.season : (leagueIdx.seasons[0] || "1");
    const players = leagueIdx.playersBySeason.get(season) || [];
    const player = (q.player && players.includes(q.player)) ? q.player : (players[0] || "");

    // fill selectors
    fillSelect(els.seasonSelect, leagueIdx.seasons, season, s => `Season ${s}`);
    fillSelect(els.playerSelect, players, player, p => p);

    badgeSeason(season);
    setQuery({ season, player });

    function renderAll() {
      badgeSeason(els.seasonSelect.value);

      const s = els.seasonSelect.value;
      const ps = leagueIdx.playersBySeason.get(s) || [];
      const currentPlayer = els.playerSelect.value;

      const leagueRow = leagueIdx.map.get(`${s}|${currentPlayer}`) || null;
      const rankingScore = rankingIdx.ok ? (rankingIdx.map.get(`${s}|${currentPlayer}`) ?? null) : null;

      els.playerTitle.textContent = currentPlayer || "Player";
      els.playerMeta.textContent = leagueRow
        ? `Season ${s} • Pos ${leagueRow.pos} • PTS ${leagueRow.PTS}`
        : `Season ${s}`;

      const matches = getPlayerFixtures(fixturesIdx.all, s, currentPlayer);
      const sum = summarizeMatches(matches, currentPlayer);

      els.statMatches.textContent = String(sum.played);
      els.statWins.textContent = String(sum.wins);
      els.statLosses.textContent = String(sum.losses);
      els.statWinRate.textContent = `${sum.winRate}%`;

      renderTotals(leagueRow, rankingScore);
      renderForm(matches, currentPlayer);
      renderRecent(matches, currentPlayer);

      // H2H list
      const opps = buildOpponentList(ps, currentPlayer);
      const currentOpp = els.h2hOpponent.value && opps.includes(els.h2hOpponent.value)
        ? els.h2hOpponent.value
        : (opps[0] || "");

      fillSelect(els.h2hOpponent, ["", ...opps], currentOpp, v => v ? v : "Pick opponent…");
      renderH2H(fixturesIdx.all, s, currentPlayer, currentOpp || "");
    }

    // events
    els.seasonSelect.addEventListener("change", () => {
      const s = els.seasonSelect.value;
      const ps = leagueIdx.playersBySeason.get(s) || [];
      fillSelect(els.playerSelect, ps, ps[0] || "", p => p);
      setQuery({ season: s, player: els.playerSelect.value });
      renderAll();
    });

    els.playerSelect.addEventListener("change", () => {
      setQuery({ season: els.seasonSelect.value, player: els.playerSelect.value });
      renderAll();
    });

    els.h2hOpponent.addEventListener("change", () => {
      renderAll();
    });

    els.h2hSwap.addEventListener("click", () => {
      const p1 = els.playerSelect.value;
      const p2 = els.h2hOpponent.value;
      if (!p2) return;
      els.playerSelect.value = p2;
      renderAll();
      els.h2hOpponent.value = p1;
      renderAll();
      setQuery({ season: els.seasonSelect.value, player: els.playerSelect.value });
    });

    els.h2hClear.addEventListener("click", () => {
      els.h2hOpponent.value = "";
      renderAll();
    });

    renderAll();

  } catch (e) {
    console.error(e);
    showError(`Couldn't load player profile: ${e.message || e}`);
  }
})();
