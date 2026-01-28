/* =========================
   ROUND SPOTLIGHT HELPERS
========================= */

function n(x){
  const v = Number(String(x ?? "").trim());
  return Number.isFinite(v) ? v : 0;
}

function pill(html){
  return `<span class="pill">${html}</span>`;
}

function playerLink(season, player){
  return `player.html?season=${encodeURIComponent(season)}&player=${encodeURIComponent(player)}`;
}

// Robust CSV parser (same approach as your IIFE parser)
function parseCSVRows(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && next === '"') { cur += '"'; i++; continue; }
    if (ch === '"') { inQuotes = !inQuotes; continue; }

    if (!inQuotes && ch === ",") {
      row.push(cur.trim());
      cur = "";
      continue;
    }

    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cur.trim());
      cur = "";
      if (row.some(v => v !== "")) rows.push(row);
      row = [];
      continue;
    }

    cur += ch;
  }

  row.push(cur.trim());
  if (row.some(v => v !== "")) rows.push(row);
  return rows;
}

const normSpot = (s) =>
  String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

function makeIndexSpot(header) {
  const idx = {};
  header.forEach((h, i) => (idx[normSpot(h)] = i));
  return idx;
}

async function loadLeague7BBySeason(season){
  const txt = await fetch("data/league.csv", { cache: "no-store" }).then(r => r.text());
  const parsed = parseCSVRows(txt.trim());
  if (parsed.length < 2) return new Map();

  const header = parsed[0];
  const idx = makeIndexSpot(header);

  const iSeason = idx[normSpot("Season")];
  const iPlayer = idx[normSpot("Player")];
  const i7B = idx[normSpot("7B")];

  // if any missing, return empty map safely
  if (iSeason === undefined || iPlayer === undefined || i7B === undefined) {
    console.warn("league.csv missing Season/Player/7B columns for spotlight.");
    return new Map();
  }

  const map = new Map();
  parsed.slice(1).forEach(r => {
    if (String(r[iSeason]) !== String(season)) return;
    const p = r[iPlayer];
    if (!p) return;
    map.set(p, n(r[i7B]));
  });

  return map;
}

async function renderSpotlight({ season, round, fixturesForRound, winnersForRound, league7BMap }){
  const title = document.getElementById("spotlightTitle");
  const meta = document.getElementById("spotlightMeta");

  const mvpValue = document.getElementById("mvpValue");
  const mvpSub = document.getElementById("mvpSub");
  const bestWinValue = document.getElementById("bestWinValue");
  const bestWinSub = document.getElementById("bestWinSub");
  const sevenValue = document.getElementById("sevenValue");
  const summaryValue = document.getElementById("summaryValue");
  const summarySub = document.getElementById("summarySub");

  if (!title || !meta) return;

  title.textContent = `Round ${round}`;

  const total = fixturesForRound.length;
  const played = fixturesForRound.filter(f => f.played).length;
  const pending = total - played;

  meta.innerHTML = [
    pill(`Played <b>${played}</b> / <b>${total}</b>`),
    pill(`Pending <b>${pending}</b>`),
    pill(`Season <b>${season}</b>`)
  ].join("");

  // MVP = most wins this round, tie-break by season 7B
  const winCount = new Map();
  winnersForRound.forEach(w => {
    if (!w) return;
    winCount.set(w, (winCount.get(w) || 0) + 1);
  });

  let mvp = null;
  for (const [p, wc] of winCount.entries()){
    const seven = league7BMap.get(p) ?? 0;
    const cand = { p, wc, seven };
    if (!mvp ||
        cand.wc > mvp.wc ||
        (cand.wc === mvp.wc && cand.seven > mvp.seven) ||
        (cand.wc === mvp.wc && cand.seven === mvp.seven && cand.p.localeCompare(mvp.p) < 0)) {
      mvp = cand;
    }
  }

  if (mvp){
    mvpValue.innerHTML = `<a class="plink" href="${playerLink(season, mvp.p)}">${mvp.p}</a>`;
    mvpSub.textContent = `${mvp.wc} win(s) • ${mvp.seven} season 7B`;
  } else {
    mvpValue.textContent = "—";
    mvpSub.textContent = "No played games this round";
  }

  // Best win (for now) = latest played match
  const latest = fixturesForRound.filter(f => f.played).slice(-1)[0];
  if (latest && latest.winner){
    const opp = latest.winner === latest.a ? latest.b : latest.a;
    bestWinValue.innerHTML = `<a class="plink" href="${playerLink(season, latest.winner)}">${latest.winner}</a> over ${opp}`;
    bestWinSub.textContent = "Latest completed match";
  } else {
    bestWinValue.textContent = "—";
    bestWinSub.textContent = "No played games this round";
  }

  // Top season 7B leader
  let top7 = { p: null, v: -1 };
  for (const [p, v] of league7BMap.entries()){
    if (v > top7.v) top7 = { p, v };
  }
  sevenValue.textContent = top7.p ? `${top7.p} • ${top7.v}` : "—";

  summaryValue.textContent = `${played}/${total}`;
  summarySub.textContent = pending ? `${pending} match(es) pending` : `Round ${round} complete`;
}

(() => {
  const CSV_PATH = "data/fixtures.csv";

  // Controls
  const seasonSelect = document.getElementById("seasonSelect");
  const seasonBadge  = document.getElementById("seasonBadge");
  const currentRoundBadge = document.getElementById("currentRoundBadge");
  const playedBadge = document.getElementById("playedBadge");
  const roundFilter = document.getElementById("roundFilter");

  const pendingOnlyBtn = document.getElementById("pendingOnlyBtn");
  const currentRoundOnlyBtn = document.getElementById("currentRoundOnlyBtn");

  // Tables
  const pendingBody = document.getElementById("pendingBody");
  const playedBody  = document.getElementById("playedBody");

  // Error box (optional)
  const fixturesError = document.getElementById("fixturesError");

  function showError(msg) {
    if (!fixturesError) return;
    fixturesError.style.display = "block";
    fixturesError.textContent = msg;
  }
  function hideError() {
    if (!fixturesError) return;
    fixturesError.style.display = "none";
    fixturesError.textContent = "";
  }

  // CSV parser (handles quotes + commas)
  function parseCSV(text) {
    const rows = [];
    let row = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];

      if (ch === '"' && next === '"') { cur += '"'; i++; continue; }
      if (ch === '"') { inQuotes = !inQuotes; continue; }

      if (!inQuotes && ch === ",") {
        row.push(cur.trim());
        cur = "";
        continue;
      }

      if (!inQuotes && (ch === "\n" || ch === "\r")) {
        if (ch === "\r" && next === "\n") i++;
        row.push(cur.trim());
        cur = "";
        if (row.some(v => v !== "")) rows.push(row);
        row = [];
        continue;
      }

      cur += ch;
    }

    row.push(cur.trim());
    if (row.some(v => v !== "")) rows.push(row);
    return rows;
  }

  // normalize header keys so "Player A" works
  const norm = (s) =>
    String(s || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

  function makeIndex(header) {
    const idx = {};
    header.forEach((h, i) => (idx[norm(h)] = i));
    return idx;
  }

  function requireCol(idx, name) {
    if (idx[norm(name)] === undefined) {
      throw new Error(`Missing column in fixtures.csv: ${name}`);
    }
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function statusPill(played) {
    // Uses your CSS classes if you already have them;
    // otherwise it still displays readable text.
    return played
      ? `<span class="status played"><span class="dot"></span>Played</span>`
      : `<span class="status pending"><span class="dot"></span>Pending</span>`;
  }

  function getSeasons(fixtures) {
    const set = new Set(fixtures.map(f => String(f.season)));
    return [...set].map(Number).sort((a, b) => a - b).map(String);
  }

  function getRounds(fixtures, season) {
    const set = new Set(
      fixtures
        .filter(f => String(f.season) === String(season))
        .map(f => String(f.round))
    );
    return [...set].map(Number).sort((a, b) => a - b).map(String);
  }

  function computeCurrentRound(fixtures, season, rounds) {
    // first round that has ANY pending match
    let currentRound = rounds[0] || "1";
    for (const r of rounds) {
      const hasPending = fixtures.some(
        f => String(f.season) === String(season) && String(f.round) === String(r) && !f.played
      );
      if (hasPending) { currentRound = r; break; }
    }
    return currentRound;
  }

  function setPlayedBadge(fixtures, season) {
    const seasonFixtures = fixtures.filter(f => String(f.season) === String(season));
    const playedCount = seasonFixtures.filter(f => f.played).length;
    const totalCount = seasonFixtures.length;
    if (playedBadge) playedBadge.textContent = `Played: ${playedCount} / ${totalCount}`;
  }

  function clearTables() {
    if (pendingBody) pendingBody.innerHTML = "";
    if (playedBody) playedBody.innerHTML = "";
  }

  function render(fixtures, season, round = "all", pendingOnly = false, currentRoundOnly = false, currentRound = "1") {
    clearTables();

    const list = fixtures.filter(f => String(f.season) === String(season));

    const filtered = list.filter(f => {
      const roundOk =
        round === "all" ? true : String(f.round) === String(round);

      const crOk =
        currentRoundOnly ? String(f.round) === String(currentRound) : true;

      const pendingOk =
        pendingOnly ? !f.played : true;

      return roundOk && crOk && pendingOk;
    });

    const pending = filtered.filter(f => !f.played);
    const played  = filtered.filter(f => f.played);

    // Pending table
    pending.forEach(f => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="col-num">Round ${escapeHtml(f.round)}</td>
        <td class="col-player"><strong>${escapeHtml(f.a)}</strong></td>
        <td class="col-num">vs</td>
        <td class="col-player"><strong>${escapeHtml(f.b)}</strong></td>
        <td class="col-num">${statusPill(false)}</td>
      `;
      pendingBody.appendChild(tr);
    });

    // Played table
    played.forEach(f => {
      const tr = document.createElement("tr");
      const resultText = f.winner ? `Winner: ${f.winner}` : "Played";
      tr.innerHTML = `
        <td class="col-num">Round ${escapeHtml(f.round)}</td>
        <td class="col-player"><strong>${escapeHtml(f.a)}</strong></td>
        <td class="col-num">${escapeHtml(resultText)}</td>
        <td class="col-player"><strong>${escapeHtml(f.b)}</strong></td>
        <td class="col-num">${statusPill(true)}</td>
      `;
      playedBody.appendChild(tr);
    });
  }

  function init() {
    fetch(CSV_PATH, { cache: "no-store" })
      .then(r => r.text())
      .then(text => {
        hideError();

        const parsed = parseCSV(text.trim());
        if (parsed.length < 2) throw new Error("fixtures.csv has no data rows.");

        const header = parsed[0];
        const idx = makeIndex(header);

        // These must exist based on your CSV
        requireCol(idx, "Season");
        requireCol(idx, "Round");
        requireCol(idx, "Player A");
        requireCol(idx, "Player B");
        requireCol(idx, "Played?");
        // Winner can be blank on NO rows, but header should exist:
        requireCol(idx, "Winner");

        const rows = parsed.slice(1);

        const fixtures = [];
        rows.forEach(cols => {
          const season = cols[idx[norm("Season")]] ?? "";
          const round  = cols[idx[norm("Round")]] ?? "";
          const a      = cols[idx[norm("Player A")]] ?? "";
          const b      = cols[idx[norm("Player B")]] ?? "";
          const playedRaw = cols[idx[norm("Played?")]] ?? "";
          const winner = cols[idx[norm("Winner")]] ?? "";

          if (!season || !round || !a || !b) return;

          const played = String(playedRaw).trim().toUpperCase() === "YES";

          fixtures.push({ season, round, a, b, played, winner });
        });

        // seasons dropdown
        const seasons = getSeasons(fixtures);
        if (!seasons.length) throw new Error("No Season values found in fixtures.csv");

        seasonSelect.innerHTML = "";
        seasons.forEach(s => {
          const opt = document.createElement("option");
          opt.value = s;
          opt.textContent = `Season ${s}`;
          seasonSelect.appendChild(opt);
        });

        // default = latest season
        const defaultSeason = seasons[seasons.length - 1];
        seasonSelect.value = defaultSeason;

        // rounds dropdown depends on season
        function populateRounds(season) {
          const rounds = getRounds(fixtures, season);

          // reset filter
          roundFilter.innerHTML = `<option value="all">All Rounds</option>`;
          rounds.forEach(r => {
            const opt = document.createElement("option");
            opt.value = r;
            opt.textContent = `Round ${r}`;
            roundFilter.appendChild(opt);
          });

          return rounds;
        }

        let pendingOnly = false;
        let currentRoundOnly = false;

        function refresh() {
          const season = seasonSelect.value;
          seasonBadge.textContent = `Season: ${season}`;

          const rounds = getRounds(fixtures, season);
          const currentRound = computeCurrentRound(fixtures, season, rounds);

          if (currentRoundBadge) currentRoundBadge.textContent = `Current Round: ${currentRound}`;
          setPlayedBadge(fixtures, season);

          // ===== Round Spotlight (SAFE INSERT) =====
          (async () => {
            try {
              const league7BMap = await loadLeague7BBySeason(season);
          
              const fixturesForRound = fixtures.filter(
                f => String(f.season) === String(season) && String(f.round) === String(currentRound)
              );
          
              const winnersForRound = fixturesForRound
                .filter(f => f.played)
                .map(f => f.winner)
                .filter(Boolean);
          
              await renderSpotlight({
                season,
                round: currentRound,
                fixturesForRound,
                winnersForRound,
                league7BMap
              });
            } catch (e) {
              console.warn("Spotlight failed:", e);
            }
          })();
          
          const roundVal = roundFilter.value || "all";
          render(fixtures, season, roundVal, pendingOnly, currentRoundOnly, currentRound);
        }

        // initial rounds + set default to current round
        const initialRounds = populateRounds(defaultSeason);
        const initialCurrentRound = computeCurrentRound(fixtures, defaultSeason, initialRounds);
        if (currentRoundBadge) currentRoundBadge.textContent = `Current Round: ${initialCurrentRound}`;
        seasonBadge.textContent = `Season: ${defaultSeason}`;
        setPlayedBadge(fixtures, defaultSeason);

        // Default: show current round
        roundFilter.value = initialCurrentRound;
        render(fixtures, defaultSeason, initialCurrentRound, false, false, initialCurrentRound);

        // ===== Round Spotlight (initial load) =====
        (async () => {
          try {
            const league7BMap = await loadLeague7BBySeason(defaultSeason);
        
            const fixturesForRound = fixtures.filter(
              f => String(f.season) === String(defaultSeason) && String(f.round) === String(initialCurrentRound)
            );
        
            const winnersForRound = fixturesForRound
              .filter(f => f.played)
              .map(f => f.winner)
              .filter(Boolean);
        
            await renderSpotlight({
              season: defaultSeason,
              round: initialCurrentRound,
              fixturesForRound,
              winnersForRound,
              league7BMap
            });
          } catch (e) {
            console.warn("Spotlight failed:", e);
          }
        })();
        
        // events
        seasonSelect.addEventListener("change", () => {
          const s = seasonSelect.value;
          const rounds = populateRounds(s);
          const cr = computeCurrentRound(fixtures, s, rounds);
          if (currentRoundBadge) currentRoundBadge.textContent = `Current Round: ${cr}`;

          // default view = current round
          roundFilter.value = cr;
          pendingOnly = false;
          currentRoundOnly = false;
          refresh();
        });

        roundFilter.addEventListener("change", () => refresh());

        if (pendingOnlyBtn) {
          pendingOnlyBtn.addEventListener("click", () => {
            pendingOnly = !pendingOnly;
            pendingOnlyBtn.classList.toggle("active", pendingOnly);
            refresh();
          });
        }

        if (currentRoundOnlyBtn) {
          currentRoundOnlyBtn.addEventListener("click", () => {
            currentRoundOnly = !currentRoundOnly;
            currentRoundOnlyBtn.classList.toggle("active", currentRoundOnly);
            refresh();
          });
        }
      })
      .catch(err => {
        showError(`Couldn't load fixtures: ${err.message}`);
        clearTables();
        if (seasonBadge) seasonBadge.textContent = "Season: —";
        if (currentRoundBadge) currentRoundBadge.textContent = "Current Round: —";
        if (playedBadge) playedBadge.textContent = "Played: —";
      });
  }

  init();
})();
