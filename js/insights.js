(() => {
  const FIXTURES_PATH = "data/fixtures.csv";
  const LEAGUE_PATH   = "data/league.csv";

  // UI (safe: only used if present in HTML)
  const seasonSelect = document.getElementById("seasonSelect");
  const seasonBadge  = document.getElementById("seasonBadge");
  const roundSelect  = document.getElementById("roundSelect");
  const roundBadge   = document.getElementById("roundBadge");
  const errBox       = document.getElementById("insightsError");

  const showError = (m) => { if (errBox) { errBox.style.display="block"; errBox.textContent=m; } };
  const hideError = () => { if (errBox) { errBox.style.display="none"; errBox.textContent=""; } };

  // Predictor UI
  const simSelect = document.getElementById("simSelect");
  const runBtn    = document.getElementById("runPredictorBtn");
  const predMeta  = document.getElementById("predMeta");
  const predBody  = document.getElementById("predictorBody");

  /* =========================
     CSV PARSER (quotes supported)
  ========================= */
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

      if (!inQuotes && ch === ",") { row.push(cur.trim()); cur = ""; continue; }

      if (!inQuotes && (ch === "\n" || ch === "\r")) {
        if (ch === "\r" && next === "\n") i++;
        row.push(cur.trim()); cur = "";
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

  const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
  function makeIndex(header) {
    const idx = {};
    header.forEach((h, i) => (idx[norm(h)] = i));
    return idx;
  }
  function requireCol(idx, name) {
    if (idx[norm(name)] === undefined) throw new Error(`Missing column: ${name}`);
  }
  const n = (x) => {
    const v = Number(String(x ?? "").trim());
    return Number.isFinite(v) ? v : 0;
  };

  function esc(s){
    return String(s ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  /* =========================
     SEASONS / ROUNDS HELPERS
  ========================= */
  function getSeasons(fixtures) {
    const set = new Set(fixtures.map(f => String(f.season)));
    return [...set].map(Number).sort((a,b)=>a-b).map(String);
  }

  function getRounds(fixtures, season) {
    const set = new Set(
      fixtures.filter(f => String(f.season) === String(season)).map(f => String(f.round))
    );
    return [...set].map(Number).sort((a,b)=>a-b).map(String);
  }

  function computeCurrentRound(fixtures, season, rounds) {
    let current = rounds[0] || "1";
    for (const r of rounds) {
      const hasPending = fixtures.some(
        f => String(f.season) === String(season) && String(f.round) === String(r) && !f.played
      );
      if (hasPending) { current = r; break; }
    }
    return current;
  }

  /* =========================
     LOAD LEAGUE TABLE (IMPORTANT FIX)
     returns: {pos, player, p, wins, pts, ...}
  ========================= */
  async function loadLeagueSeason(season){
    const txt = await fetch(LEAGUE_PATH, { cache:"no-store" }).then(r=>r.text());
    const parsed = parseCSV(txt.trim());
    if (parsed.length < 2) return [];

    const header = parsed[0];
    const idx = makeIndex(header);

    requireCol(idx, "Season");
    requireCol(idx, "Pos");
    requireCol(idx, "Player");
    requireCol(idx, "P");
    requireCol(idx, "W");
    requireCol(idx, "PTS");

    // optional but expected in your table
    // (don’t hard fail if someone renamed, but keep if present)
    const hasBD = idx[norm("BD")] !== undefined;
    const hasBF = idx[norm("BF")] !== undefined;
    const hasBA = idx[norm("BA")] !== undefined;
    const has7B = idx[norm("7B")] !== undefined;
    const hasBP = idx[norm("BP")] !== undefined;

    const rows = parsed.slice(1);
    const list = [];

    rows.forEach(r=>{
      if (String(r[idx[norm("Season")]]) !== String(season)) return;
      const player = r[idx[norm("Player")]];
      if (!player) return;

      list.push({
        pos: n(r[idx[norm("Pos")]]),
        player,
        p: n(r[idx[norm("P")]]),
        wins: n(r[idx[norm("W")]]),
        pts: n(r[idx[norm("PTS")]]),
        bd: hasBD ? n(r[idx[norm("BD")]]) : 0,
        bf: hasBF ? n(r[idx[norm("BF")]]) : 0,
        ba: hasBA ? n(r[idx[norm("BA")]]) : 0,
        zb: has7B ? n(r[idx[norm("7B")]]) : 0,
        bp: hasBP ? n(r[idx[norm("BP")]]) : 0
      });
    });

    list.sort((a,b)=> a.pos - b.pos);
    return list;
  }

  /* =========================
     MONTE CARLO PREDICTOR
  ========================= */
  function rand01() { return Math.random(); }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

  function strengthFromWL(wins, played) {
    return (wins + 1) / (played + 2); // Laplace smoothing
  }

  function winProb(aStr, bStr) {
    const p = aStr / (aStr + bStr);
    return clamp(p, 0.15, 0.85);
  }

  function sortStandings(arr) {
    arr.sort((x, y) => (y.pts - x.pts) || x.player.localeCompare(y.player));
  }

  function simulateSeason({ leagueRows, remainingFixtures, sims }) {
    const players = leagueRows.map(r => r.player);

    // base snapshot
    const base = new Map();
    leagueRows.forEach(r => {
      base.set(r.player, { pts: r.pts, wins: r.wins, played: r.p });
    });

    // accumulators
    const winTitle = new Map(players.map(p => [p, 0]));
    const top5     = new Map(players.map(p => [p, 0]));
    const bottom2  = new Map(players.map(p => [p, 0]));
    const sumPts   = new Map(players.map(p => [p, 0]));
    const sumPos   = new Map(players.map(p => [p, 0]));

    // base strengths
    const baseStrength = new Map();
    players.forEach(p => {
      const st = base.get(p);
      baseStrength.set(p, strengthFromWL(st.wins, st.played));
    });

    for (let s = 0; s < sims; s++) {
      // clone state
      const state = new Map();
      players.forEach(p => {
        const b = base.get(p);
        state.set(p, { pts: b.pts, wins: b.wins, played: b.played });
      });

      // play out remaining matches
      for (const m of remainingFixtures) {
        const a = m.a, b = m.b;
        if (!state.has(a) || !state.has(b)) continue;

        const aSt = state.get(a);
        const bSt = state.get(b);

        const aStrengthNow = strengthFromWL(aSt.wins, aSt.played);
        const bStrengthNow = strengthFromWL(bSt.wins, bSt.played);

        // blend with base strength
        const A = 0.6 * aStrengthNow + 0.4 * (baseStrength.get(a) ?? aStrengthNow);
        const B = 0.6 * bStrengthNow + 0.4 * (baseStrength.get(b) ?? bStrengthNow);

        const pA = winProb(A, B);
        const aWins = rand01() < pA;

        aSt.played += 1;
        bSt.played += 1;

        if (aWins) {
          aSt.wins += 1;
          aSt.pts += 3;
        } else {
          bSt.wins += 1;
          bSt.pts += 3;
        }
      }

      // final table
      const final = players.map(p => ({ player: p, pts: state.get(p).pts }));
      sortStandings(final);

      const posMap = new Map();
      final.forEach((row, i) => posMap.set(row.player, i + 1));

      // outcomes
      winTitle.set(final[0].player, winTitle.get(final[0].player) + 1);
      final.slice(0, 5).forEach(r => top5.set(r.player, top5.get(r.player) + 1));
      final.slice(-2).forEach(r => bottom2.set(r.player, bottom2.get(r.player) + 1));

      players.forEach(p => {
        sumPts.set(p, sumPts.get(p) + state.get(p).pts);
        sumPos.set(p, sumPos.get(p) + (posMap.get(p) || players.length));
      });
    }

    return { winTitle, top5, bottom2, sumPts, sumPos, sims };
  }

  function getRemainingFixtures(fixtures, season) {
    return fixtures
      .filter(f => String(f.season) === String(season))
      .filter(f => !f.played)
      .map(f => ({ a: f.a, b: f.b, round: f.round }));
  }

  function renderPredictorTable({ season, leagueRows, simResult }) {
    if (!predBody) return;

    const sims = simResult.sims;

    const rows = leagueRows.map(r => {
      const p = r.player;
      const titlePct  = (simResult.winTitle.get(p) / sims) * 100;
      const top5Pct   = (simResult.top5.get(p) / sims) * 100;
      const bottom2Pct= (simResult.bottom2.get(p) / sims) * 100;
      const expPts    = simResult.sumPts.get(p) / sims;
      const expPos    = simResult.sumPos.get(p) / sims;

      return { pos:r.pos, player:r.player, pts:r.pts, titlePct, top5Pct, bottom2Pct, expPts, expPos };
    });

    rows.sort((a,b) => (a.expPos - b.expPos) || (b.expPts - a.expPts));

    if (predMeta) predMeta.textContent = `Season ${season} • Sims: ${sims.toLocaleString()} • Remaining matches simulated`;

    predBody.innerHTML = "";
    rows.forEach(r => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="col-num">${r.pos}</td>
        <td class="col-player"><strong>${esc(r.player)}</strong></td>
        <td class="col-num"><strong>${r.pts}</strong></td>
        <td class="col-num">${r.titlePct.toFixed(1)}%</td>
        <td class="col-num">${r.top5Pct.toFixed(1)}%</td>
        <td class="col-num">${r.bottom2Pct.toFixed(1)}%</td>
        <td class="col-num">${r.expPts.toFixed(1)}</td>
        <td class="col-num">${r.expPos.toFixed(1)}</td>
      `;
      predBody.appendChild(tr);
    });
  }

  /* =========================
     INIT
  ========================= */
  async function init(){
    try {
      hideError();

      // Load fixtures CSV
      const ftxt = await fetch(FIXTURES_PATH, { cache:"no-store" }).then(r=>r.text());
      const fparsed = parseCSV(ftxt.trim());
      if (fparsed.length < 2) throw new Error("fixtures.csv has no data rows.");

      const fh = fparsed[0];
      const fidx = makeIndex(fh);

      requireCol(fidx, "Season");
      requireCol(fidx, "Round");
      requireCol(fidx, "Player A");
      requireCol(fidx, "Player B");
      requireCol(fidx, "Played?");
      requireCol(fidx, "Winner");

      const fixtures = fparsed.slice(1).map(cols=>{
        const season = cols[fidx[norm("Season")]] ?? "";
        const round  = cols[fidx[norm("Round")]] ?? "";
        const a      = cols[fidx[norm("Player A")]] ?? "";
        const b      = cols[fidx[norm("Player B")]] ?? "";
        const played = String(cols[fidx[norm("Played?")]] ?? "").trim().toUpperCase()==="YES";
        const winner = cols[fidx[norm("Winner")]] ?? "";
        return { season, round, a, b, played, winner };
      }).filter(x=>x.season && x.round && x.a && x.b);

      // Seasons
      const seasons = getSeasons(fixtures);
      if (!seasons.length) throw new Error("No seasons found in fixtures.csv");

      if (seasonSelect) {
        seasonSelect.innerHTML = "";
        seasons.forEach(s=>{
          const opt = document.createElement("option");
          opt.value = s;
          opt.textContent = `Season ${s}`;
          seasonSelect.appendChild(opt);
        });
      }

      const defaultSeason = seasons[seasons.length-1];
      if (seasonSelect) seasonSelect.value = defaultSeason;

      async function populateRounds(season){
        if (!roundSelect) return { rounds:[], current:"1" };
        const rounds = getRounds(fixtures, season);
        const current = computeCurrentRound(fixtures, season, rounds);

        roundSelect.innerHTML = "";
        rounds.forEach(r=>{
          const opt = document.createElement("option");
          opt.value = r;
          opt.textContent = `Round ${r}`;
          roundSelect.appendChild(opt);
        });

        roundSelect.value = current;
        return { rounds, current };
      }

      // Predictor runner (button + auto)
      async function runPredictor(season, leagueRows){
        if (!predBody) return; // predictor not on page
        if (!leagueRows.length) {
          predBody.innerHTML = `<tr><td colspan="8" style="opacity:.85;">No league data for Season ${esc(season)}.</td></tr>`;
          return;
        }

        const sims = Number(simSelect?.value || 5000);
        const remaining = getRemainingFixtures(fixtures, season);

        // If no remaining matches, still show 100% for current leader
        const simResult = remaining.length
          ? simulateSeason({ leagueRows, remainingFixtures: remaining, sims })
          : simulateSeason({ leagueRows, remainingFixtures: [], sims: 1 });

        renderPredictorTable({ season, leagueRows, simResult });
      }

      if (runBtn && !runBtn.dataset.bound) {
        runBtn.dataset.bound = "1";
        runBtn.addEventListener("click", async () => {
          const season = seasonSelect?.value || defaultSeason;
          const leagueRows = await loadLeagueSeason(season);
          await runPredictor(season, leagueRows);
        });
      }

      async function refresh(){
        const season = seasonSelect?.value || defaultSeason;
        if (seasonBadge) seasonBadge.textContent = `Season: ${season}`;

        // rounds and current round (optional)
        const rounds = getRounds(fixtures, season);
        const currentRound = computeCurrentRound(fixtures, season, rounds);
        const selectedRound = roundSelect?.value || currentRound;
        if (roundBadge) roundBadge.textContent = `Round: ${selectedRound}`;

        // load league and run predictor
        const leagueRows = await loadLeagueSeason(season);
        await runPredictor(season, leagueRows);

        // ✅ Your other insights/trends can stay in your file.
        // If you want, paste them back below this line.
      }

      // initial
      await populateRounds(defaultSeason);
      await refresh();

      // events
      seasonSelect?.addEventListener("change", async ()=> {
        const s = seasonSelect.value;
        await populateRounds(s);
        await refresh();
      });

      roundSelect?.addEventListener("change", async ()=> {
        await refresh();
      });

    } catch (e) {
      showError(`Couldn't load insights: ${e.message}`);
    }
  }

  init();
})();
