(() => {
  const LEAGUE_PATH   = "data/league.csv";
  const FIXTURES_PATH = "data/fixtures.csv";
  const RANKING_PATH  = "data/ranking.csv";

  // UI
  const seasonSelect = document.getElementById("seasonSelect");
  const seasonBadge  = document.getElementById("seasonBadge");
  const runBtn       = document.getElementById("runBtn");
  const copyBtn      = document.getElementById("copyBtn");

  const errBox       = document.getElementById("validateError");
  const runMeta      = document.getElementById("runMeta");

  const kpiErrors    = document.getElementById("kpiErrors");
  const kpiWarnings  = document.getElementById("kpiWarnings");
  const kpiPlayers   = document.getElementById("kpiPlayers");
  const kpiFixtures  = document.getElementById("kpiFixtures");

  const errorsBody   = document.getElementById("errorsBody");
  const warningsBody = document.getElementById("warningsBody");
  const quickBody    = document.getElementById("quickBody");

  // helpers
  const showError = (m) => { if (errBox){ errBox.style.display="block"; errBox.textContent=m; } };
  const hideError = () => { if (errBox){ errBox.style.display="none"; errBox.textContent=""; } };

  const esc = (s) => String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");

  const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

  // CSV parser (quotes supported)
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

  function makeIndex(header){
    const idx = {};
    header.forEach((h,i)=> idx[norm(h)] = i);
    return idx;
  }

  function requireCols(file, idx, cols){
    cols.forEach(c => {
      if (idx[norm(c)] === undefined) {
        throw new Error(`${file}: Missing column "${c}"`);
      }
    });
  }

  const num = (x) => {
    const v = Number(String(x ?? "").trim());
    return Number.isFinite(v) ? v : null;
  };

  function addRow(tbody, { type, detail, row, file }){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="col-num"><span class="tag">${esc(type)}</span></td>
      <td>${esc(detail)}</td>
      <td class="col-num">${row ?? "—"}</td>
      <td class="col-num"><code>${esc(file)}</code></td>
    `;
    tbody.appendChild(tr);
  }

  function addQuick(check, result, notes){
    if (!quickBody) return;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${esc(check)}</strong></td>
      <td class="col-num">${esc(result)}</td>
      <td style="opacity:.9;">${esc(notes || "")}</td>
    `;
    quickBody.appendChild(tr);
  }

  function clearUI(){
    if (errorsBody) errorsBody.innerHTML = "";
    if (warningsBody) warningsBody.innerHTML = "";
    if (quickBody) quickBody.innerHTML = "";
    if (kpiErrors) kpiErrors.textContent = "—";
    if (kpiWarnings) kpiWarnings.textContent = "—";
    if (kpiPlayers) kpiPlayers.textContent = "—";
    if (kpiFixtures) kpiFixtures.textContent = "—";
    if (runMeta) runMeta.textContent = "—";
  }

  async function loadFile(path){
    const t = await fetch(path, { cache:"no-store" }).then(r => r.text());
    const parsed = parseCSV(t.trim());
    if (parsed.length < 1) throw new Error(`${path} is empty`);
    return parsed;
  }

  function seasonsFromFixtures(fixtures){
    const s = new Set(fixtures.map(f => String(f.season)));
    return [...s].map(Number).sort((a,b)=>a-b).map(String);
  }

  function buildFixtures(parsed){
    const header = parsed[0];
    const idx = makeIndex(header);

    requireCols("fixtures.csv", idx, ["Season","Round","Player A","Player B","Played?","Winner"]);
    const rows = parsed.slice(1);

    const list = rows.map((r, i) => {
      const season = r[idx[norm("Season")]] ?? "";
      const round  = r[idx[norm("Round")]] ?? "";
      const a      = r[idx[norm("Player A")]] ?? "";
      const b      = r[idx[norm("Player B")]] ?? "";
      const playedRaw = r[idx[norm("Played?")]] ?? "";
      const winner = r[idx[norm("Winner")]] ?? "";

      const played = String(playedRaw).trim().toUpperCase() === "YES";
      return { season, round, a, b, played, winner, __row: i + 2 }; // +2 for header + 1-index
    }).filter(x => x.season && x.round && x.a && x.b);

    return list;
  }

  function buildLeague(parsed){
    const header = parsed[0];
    const idx = makeIndex(header);

    requireCols("league.csv", idx, ["Season","Pos","Player","P","W","L","BF","BA","BD","7B","BP","PTS"]);
    const rows = parsed.slice(1);

    const list = rows.map((r, i) => ({
      season: r[idx[norm("Season")]] ?? "",
      pos: r[idx[norm("Pos")]] ?? "",
      player: r[idx[norm("Player")]] ?? "",
      p: r[idx[norm("P")]] ?? "",
      w: r[idx[norm("W")]] ?? "",
      l: r[idx[norm("L")]] ?? "",
      bf: r[idx[norm("BF")]] ?? "",
      ba: r[idx[norm("BA")]] ?? "",
      bd: r[idx[norm("BD")]] ?? "",
      zb: r[idx[norm("7B")]] ?? "",
      bp: r[idx[norm("BP")]] ?? "",
      pts: r[idx[norm("PTS")]] ?? "",
      __row: i + 2
    })).filter(x => x.season && x.player);

    return list;
  }

  function buildRanking(parsed){
    const header = parsed[0];
    const idx = makeIndex(header);

    // Support either "Position" or "Pos" for ranking
    const hasPosition = idx[norm("Position")] !== undefined;
    const posCol = hasPosition ? "Position" : "Pos";

    requireCols("ranking.csv", idx, ["Season", posCol, "Player"]);
    // optional but expected:
    // Wins, Bonus, 7-Baller, Ranking Score

    const rows = parsed.slice(1);

    const list = rows.map((r,i)=>({
      season: r[idx[norm("Season")]] ?? "",
      pos: r[idx[norm(posCol)]] ?? "",
      player: r[idx[norm("Player")]] ?? "",
      wins: idx[norm("Wins")] !== undefined ? (r[idx[norm("Wins")]] ?? "") : "",
      bonus: idx[norm("Bonus")] !== undefined ? (r[idx[norm("Bonus")]] ?? "") : "",
      zb: idx[norm("7-Baller")] !== undefined ? (r[idx[norm("7-Baller")]] ?? "") : (idx[norm("7B")] !== undefined ? (r[idx[norm("7B")]] ?? "") : ""),
      score: idx[norm("Ranking Score")] !== undefined ? (r[idx[norm("Ranking Score")]] ?? "") : "",
      __row: i + 2
    })).filter(x => x.season && x.player);

    return list;
  }

  function runChecks({ season, fixtures, league, ranking }){
    const errors = [];
    const warnings = [];
    const quick = [];

    const fx = fixtures.filter(f => String(f.season) === String(season));
    const lg = league.filter(r => String(r.season) === String(season));
    const rk = ranking.filter(r => String(r.season) === String(season));

    const leaguePlayers = new Set(lg.map(x => x.player));
    const fixturePlayers = new Set(fx.flatMap(f => [f.a, f.b]));
    const rankingPlayers = new Set(rk.map(x => x.player));

    // Quick counts
    quick.push({ check:"League rows", result:String(lg.length), notes:"Rows in league.csv for this season" });
    quick.push({ check:"Fixtures rows", result:String(fx.length), notes:"Matches in fixtures.csv for this season" });
    quick.push({ check:"Ranking rows", result:String(rk.length), notes:"Rows in ranking.csv for this season" });

    // ---- FIXTURES sanity ----
    // invalid Played?
    fx.forEach(f => {
      const raw = f.played ? "YES" : "NO"; // already normalized
      if (raw !== "YES" && raw !== "NO") {
        errors.push({ type:"Bad Played?", detail:`Played? must be YES/NO`, row:f.__row, file:"fixtures.csv" });
      }
    });

    // winner rules
    fx.forEach(f => {
      if (f.played && !String(f.winner || "").trim()){
        errors.push({ type:"Winner missing", detail:`Played=YES but Winner blank (${f.a} vs ${f.b}, R${f.round})`, row:f.__row, file:"fixtures.csv" });
      }
      if (!f.played && String(f.winner || "").trim()){
        warnings.push({ type:"Winner present", detail:`Played=NO but Winner filled (${f.a} vs ${f.b}, R${f.round})`, row:f.__row, file:"fixtures.csv" });
      }
      if (f.played && f.winner && f.winner !== f.a && f.winner !== f.b){
        errors.push({ type:"Winner invalid", detail:`Winner "${f.winner}" not in match players (${f.a} vs ${f.b}, R${f.round})`, row:f.__row, file:"fixtures.csv" });
      }
      if (f.a === f.b){
        errors.push({ type:"Self match", detail:`Player A equals Player B (${f.a}) in R${f.round}`, row:f.__row, file:"fixtures.csv" });
      }
    });

    // duplicate fixtures (same season+round+pair) irrespective of order
    const seen = new Map();
    fx.forEach(f => {
      const pair = [f.a, f.b].map(String).sort((a,b)=>a.localeCompare(b)).join(" vs ");
      const key = `${season}|${String(f.round)}|${pair}`;
      if (seen.has(key)){
        warnings.push({ type:"Duplicate fixture", detail:`Duplicate pair in same round: ${pair} (R${f.round})`, row:f.__row, file:"fixtures.csv" });
      } else {
        seen.set(key, f.__row);
      }
    });

    // fixtures players not in league table
    fx.forEach(f => {
      if (lg.length){
        if (!leaguePlayers.has(f.a)){
          errors.push({ type:"Unknown player", detail:`"${f.a}" in fixtures but missing from league.csv (Season ${season})`, row:f.__row, file:"fixtures.csv" });
        }
        if (!leaguePlayers.has(f.b)){
          errors.push({ type:"Unknown player", detail:`"${f.b}" in fixtures but missing from league.csv (Season ${season})`, row:f.__row, file:"fixtures.csv" });
        }
      }
    });

    // ---- LEAGUE sanity ----
    if (!lg.length){
      errors.push({ type:"Missing season", detail:`No league.csv rows found for Season ${season}`, row:null, file:"league.csv" });
    } else {
      // pos uniqueness
      const posSeen = new Set();
      lg.forEach(r => {
        const p = String(r.pos).trim();
        if (!p){
          errors.push({ type:"Pos missing", detail:`Missing Pos for player "${r.player}"`, row:r.__row, file:"league.csv" });
          return;
        }
        if (posSeen.has(p)){
          errors.push({ type:"Pos duplicate", detail:`Duplicate Pos "${p}" in league.csv`, row:r.__row, file:"league.csv" });
        } else posSeen.add(p);
      });

      // numeric checks + basic consistency
      lg.forEach(r => {
        const P = num(r.p), W = num(r.w), L = num(r.l);
        const BF = num(r.bf), BA = num(r.ba), BD = num(r.bd);
        const PTS = num(r.pts);

        if (P === null || W === null || L === null || BF === null || BA === null || BD === null || PTS === null){
          warnings.push({ type:"Non-numeric", detail:`Some numeric fields not numeric for "${r.player}"`, row:r.__row, file:"league.csv" });
          return;
        }

        if (W + L !== P){
          warnings.push({ type:"P mismatch", detail:`"${r.player}": W+L (${W+L}) != P (${P})`, row:r.__row, file:"league.csv" });
        }

        if (BF - BA !== BD){
          warnings.push({ type:"BD mismatch", detail:`"${r.player}": BF-BA (${BF-BA}) != BD (${BD})`, row:r.__row, file:"league.csv" });
        }

        // points check (wins*3 should be <= pts; because BP/7B could exist)
        const minPts = W * 3;
        if (PTS < minPts){
          errors.push({ type:"PTS too low", detail:`"${r.player}": PTS (${PTS}) < Wins*3 (${minPts})`, row:r.__row, file:"league.csv" });
        }
      });
    }

    // ---- CROSS CHECK (fixtures vs league played counts) ----
    if (lg.length && fx.length){
      const playedByPlayer = new Map(); // player -> played matches count from fixtures
      const winsByPlayer = new Map();   // player -> wins count from fixtures

      fx.filter(m => m.played).forEach(m => {
        playedByPlayer.set(m.a, (playedByPlayer.get(m.a)||0) + 1);
        playedByPlayer.set(m.b, (playedByPlayer.get(m.b)||0) + 1);

        if (m.winner){
          winsByPlayer.set(m.winner, (winsByPlayer.get(m.winner)||0) + 1);
        }
      });

      lg.forEach(r => {
        const P = num(r.p);
        const W = num(r.w);
        if (P === null || W === null) return;

        const fxP = playedByPlayer.get(r.player) || 0;
        const fxW = winsByPlayer.get(r.player) || 0;

        // only flag when fixtures data exists for them
        if (fxP && P !== fxP){
          warnings.push({ type:"Played mismatch", detail:`"${r.player}": league P=${P} but fixtures played=${fxP}`, row:r.__row, file:"league.csv" });
        }
        if (fxW && W !== fxW){
          warnings.push({ type:"Wins mismatch", detail:`"${r.player}": league W=${W} but fixtures wins=${fxW}`, row:r.__row, file:"league.csv" });
        }
      });

      quick.push({
        check:"Fixtures ↔ League",
        result: "Compared",
        notes: "Checked played & wins totals against fixtures.csv"
      });
    } else {
      quick.push({
        check:"Fixtures ↔ League",
        result: "Skipped",
        notes: "Need both league + fixtures rows for this season"
      });
    }

    // ---- RANKING sanity ----
    if (!rk.length){
      warnings.push({ type:"Missing season", detail:`No ranking.csv rows found for Season ${season}`, row:null, file:"ranking.csv" });
    } else {
      // ranking players not in league
      rk.forEach(r => {
        if (lg.length && !leaguePlayers.has(r.player)){
          warnings.push({ type:"Ranking extra", detail:`"${r.player}" in ranking.csv but missing from league.csv`, row:r.__row, file:"ranking.csv" });
        }
      });

      // duplicates
      const pSeen = new Set();
      rk.forEach(r => {
        if (pSeen.has(r.player)){
          warnings.push({ type:"Duplicate player", detail:`Duplicate player "${r.player}" in ranking.csv`, row:r.__row, file:"ranking.csv" });
        } else pSeen.add(r.player);
      });
    }

    // ---- Player set mismatch quick check ----
    const inLeagueNotFixtures = [...leaguePlayers].filter(p => !fixturePlayers.has(p));
    const inFixturesNotLeague = [...fixturePlayers].filter(p => !leaguePlayers.has(p));
    const inRankingNotLeague  = [...rankingPlayers].filter(p => !leaguePlayers.has(p));

    quick.push({
      check:"Players in league but not in fixtures",
      result: String(inLeagueNotFixtures.length),
      notes: inLeagueNotFixtures.slice(0,6).join(", ") + (inLeagueNotFixtures.length > 6 ? "…" : "")
    });

    quick.push({
      check:"Players in fixtures but not in league",
      result: String(inFixturesNotLeague.length),
      notes: inFixturesNotLeague.slice(0,6).join(", ") + (inFixturesNotLeague.length > 6 ? "…" : "")
    });

    quick.push({
      check:"Players in ranking but not in league",
      result: String(inRankingNotLeague.length),
      notes: inRankingNotLeague.slice(0,6).join(", ") + (inRankingNotLeague.length > 6 ? "…" : "")
    });

    return {
      season,
      counts: {
        players: leaguePlayers.size || fixturePlayers.size || 0,
        fixtures: fx.length
      },
      errors,
      warnings,
      quick
    };
  }

  function renderReport(report){
    // KPIs
    if (kpiErrors) kpiErrors.textContent = String(report.errors.length);
    if (kpiWarnings) kpiWarnings.textContent = String(report.warnings.length);
    if (kpiPlayers) kpiPlayers.textContent = String(report.counts.players);
    if (kpiFixtures) kpiFixtures.textContent = String(report.counts.fixtures);

    // meta
    if (runMeta){
      const now = new Date();
      runMeta.textContent = `Season ${report.season} • ${now.toLocaleString()}`;
    }

    // lists
    if (errorsBody) errorsBody.innerHTML = "";
    if (warningsBody) warningsBody.innerHTML = "";
    if (quickBody) quickBody.innerHTML = "";

    if (!report.errors.length){
      addRow(errorsBody, { type:"OK", detail:"No errors found.", row:"—", file:"—" });
    } else {
      report.errors.forEach(x => addRow(errorsBody, x));
    }

    if (!report.warnings.length){
      addRow(warningsBody, { type:"OK", detail:"No warnings found.", row:"—", file:"—" });
    } else {
      report.warnings.forEach(x => addRow(warningsBody, x));
    }

    report.quick.forEach(q => addQuick(q.check, q.result, q.notes));
  }

  let lastReport = null;

  async function init(){
    try {
      hideError();
      clearUI();

      const [fxParsed, lgParsed, rkParsed] = await Promise.all([
        loadFile(FIXTURES_PATH),
        loadFile(LEAGUE_PATH),
        loadFile(RANKING_PATH).catch(() => [["Season"]]) // ranking is optional; don't hard-fail
      ]);

      const fixtures = buildFixtures(fxParsed);
      const league   = buildLeague(lgParsed);
      const ranking  = rkParsed && rkParsed.length > 1 ? buildRanking(rkParsed) : [];

      const seasons = seasonsFromFixtures(fixtures);
      if (!seasons.length) throw new Error("No seasons found in fixtures.csv");

      seasonSelect.innerHTML = "";
      seasons.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s;
        opt.textContent = `Season ${s}`;
        seasonSelect.appendChild(opt);
      });

      // default = latest season
      seasonSelect.value = seasons[seasons.length - 1];
      seasonBadge.textContent = `Season: ${seasonSelect.value}`;

      const run = () => {
        const season = seasonSelect.value;
        seasonBadge.textContent = `Season: ${season}`;
        const report = runChecks({ season, fixtures, league, ranking });
        lastReport = report;
        renderReport(report);
      };

      run();

      seasonSelect.addEventListener("change", run);
      if (runBtn) runBtn.addEventListener("click", run);

      if (copyBtn) {
        copyBtn.addEventListener("click", async () => {
          if (!lastReport) return;
          const payload = JSON.stringify(lastReport, null, 2);
          try {
            await navigator.clipboard.writeText(payload);
            copyBtn.textContent = "Copied ✓";
            setTimeout(() => (copyBtn.textContent = "Copy report"), 1200);
          } catch {
            showError("Copy failed (browser blocked clipboard).");
          }
        });
      }

    } catch (e) {
      showError(`Couldn't run validation: ${e.message}`);
    }
  }

  init();
})();
