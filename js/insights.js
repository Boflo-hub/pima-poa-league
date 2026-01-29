(() => {
  const FIXTURES_PATH = "data/fixtures.csv";
  const LEAGUE_PATH   = "data/league.csv";

  // UI
  const seasonSelect = document.getElementById("seasonSelect");
  const seasonBadge  = document.getElementById("seasonBadge");
  const roundSelect  = document.getElementById("roundSelect");
  const roundBadge   = document.getElementById("roundBadge");
  const errBox       = document.getElementById("insightsError");

  const pulseTag = document.getElementById("pulseTag");

  const kpiCompletion = document.getElementById("kpiCompletion");
  const kpiCompletionSub = document.getElementById("kpiCompletionSub");
  const kpiCurrentRound = document.getElementById("kpiCurrentRound");
  const kpiCurrentRoundSub = document.getElementById("kpiCurrentRoundSub");
  const kpiHot = document.getElementById("kpiHot");
  const kpiHotSub = document.getElementById("kpiHotSub");
  const kpiCold = document.getElementById("kpiCold");
  const kpiColdSub = document.getElementById("kpiColdSub");

  const gapTitle = document.getElementById("gapTitle");
  const gapTitleSub = document.getElementById("gapTitleSub"); // ✅ FIX
  const gapMid = document.getElementById("gapMid");
  const gapBottom = document.getElementById("gapBottom");
  const bonusActivity = document.getElementById("bonusActivity");
  const bonusActivitySub = document.getElementById("bonusActivitySub");

  const roundProgressList = document.getElementById("roundProgressList");
  const upsetsBody = document.getElementById("upsetsBody");

  const roundTag = document.getElementById("roundTag");
  const roundMvp = document.getElementById("roundMvp");
  const roundMvpSub = document.getElementById("roundMvpSub");
  const roundRecord = document.getElementById("roundRecord");
  const roundRecordSub = document.getElementById("roundRecordSub");
  const roundPending = document.getElementById("roundPending");
  const roundPendingSub = document.getElementById("roundPendingSub");
  const roundSurprise = document.getElementById("roundSurprise");
  const roundSurpriseSub = document.getElementById("roundSurpriseSub");

  // Predictor UI (optional: script won’t break if missing)
  const simSelect = document.getElementById("simSelect");
  const runBtn    = document.getElementById("runPredictorBtn");
  const predMeta  = document.getElementById("predMeta");
  const predBody  = document.getElementById("predictorBody");

  const showError = (m) => { if (errBox) { errBox.style.display="block"; errBox.textContent=m; } };
  const hideError = () => { if (errBox) { errBox.style.display="none"; errBox.textContent=""; } };

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

  function playerLink(season, player){
    return `player.html?season=${encodeURIComponent(season)}&player=${encodeURIComponent(player)}`;
  }

  function esc(s){
    return String(s ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

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

  function buildPlayedMatches(fixtures, season, uptoRound = null){
    return fixtures
      .filter(f => String(f.season) === String(season))
      .filter(f => f.played)
      .filter(f => uptoRound == null ? true : Number(f.round) <= Number(uptoRound))
      .sort((a,b)=> Number(a.round) - Number(b.round));
  }

  function lastNForm(fixtures, season, N=5){
    const played = buildPlayedMatches(fixtures, season, null);
    const map = new Map(); // player -> array of W/L chronological
    const push = (p, r) => {
      if (!map.has(p)) map.set(p, []);
      map.get(p).push(r);
    };
    played.forEach(f=>{
      const w = f.winner;
      if (!w) return;
      push(f.a, w === f.a ? "W" : "L");
      push(f.b, w === f.b ? "W" : "L");
    });
    const out = [];
    for (const [p, arr] of map.entries()){
      const last = arr.slice(-N);
      const wins = last.filter(x=>x==="W").length;
      out.push({ player:p, wins, sample:last.length });
    }
    out.sort((a,b)=> b.wins - a.wins || b.sample - a.sample || a.player.localeCompare(b.player));
    return out;
  }

  async function loadLeagueSeason(season){
    // league.csv header: Season,Pos,Player,P,W,L,BF,BA,BD,7B,BP,PTS
    const txt = await fetch(LEAGUE_PATH, { cache:"no-store" }).then(r=>r.text());
    const parsed = parseCSV(txt.trim());
    if (parsed.length < 2) return [];

    const header = parsed[0];
    const idx = makeIndex(header);

    requireCol(idx, "Season");
    requireCol(idx, "Pos");
    requireCol(idx, "Player");
    requireCol(idx, "P");     // ✅ FIX (needed for predictor)
    requireCol(idx, "W");     // ✅ FIX (needed for predictor)
    requireCol(idx, "PTS");
    requireCol(idx, "BD");
    requireCol(idx, "BF");
    requireCol(idx, "BA");
    requireCol(idx, "7B");
    requireCol(idx, "BP");

    const rows = parsed.slice(1);
    const list = [];

    rows.forEach(r=>{
      if (String(r[idx[norm("Season")]]) !== String(season)) return;
      const player = r[idx[norm("Player")]];
      if (!player) return;

      list.push({
        pos: n(r[idx[norm("Pos")]]),
        player,
        p: n(r[idx[norm("P")]]),       // ✅ FIX
        wins: n(r[idx[norm("W")]]),    // ✅ FIX
        pts: n(r[idx[norm("PTS")]]),
        bd: n(r[idx[norm("BD")]]),
        bf: n(r[idx[norm("BF")]]),
        ba: n(r[idx[norm("BA")]]),
        zb: n(r[idx[norm("7B")]]),
        bp: n(r[idx[norm("BP")]])
      });
    });

    list.sort((a,b)=> a.pos - b.pos);
    return list;
  }

  function roundProgress(fixtures, season){
    const rounds = getRounds(fixtures, season);
    return rounds.map(r=>{
      const list = fixtures.filter(f => String(f.season)===String(season) && String(f.round)===String(r));
      const total = list.length;
      const played = list.filter(f=>f.played).length;
      return { round:r, played, total, pct: total ? Math.round((played/total)*100) : 0 };
    });
  }

  function renderRoundProgress(items){
    if (!roundProgressList) return;
    roundProgressList.innerHTML = "";

    const maxTotal = Math.max(...items.map(x=>x.total), 1);

    items.forEach(x=>{
      const barPct = Math.round((x.played / maxTotal) * 100);

      const row = document.createElement("div");
      row.style.display = "grid";
      row.style.gridTemplateColumns = "90px 1fr 110px";
      row.style.gap = "12px";
      row.style.alignItems = "center";
      row.style.padding = "10px 0";
      row.style.borderTop = "1px solid rgba(255,255,255,0.06)";

      row.innerHTML = `
        <div style="font-weight:700; letter-spacing:.08em; opacity:.9;">ROUND ${esc(x.round)}</div>
        <div style="height:10px; border-radius:999px; background:rgba(255,255,255,0.08); overflow:hidden;">
          <div style="height:100%; width:${barPct}%; background:rgba(0, 220, 180, 0.65);"></div>
        </div>
        <div style="text-align:right; opacity:.9;"><b>${x.played}</b> / ${x.total} • ${x.pct}%</div>
      `;
      roundProgressList.appendChild(row);
    });
  }

  function computeUpsets(fixtures, season, leagueRows){
    const posMap = new Map(leagueRows.map(x=>[x.player, x.pos]));
    const played = fixtures.filter(f => String(f.season)===String(season) && f.played && f.winner);

    const upsets = [];
    played.forEach(f=>{
      const loser = f.winner === f.a ? f.b : f.a;
      const wPos = posMap.get(f.winner);
      const lPos = posMap.get(loser);
      if (!wPos || !lPos) return;

      if (wPos > lPos) {
        upsets.push({ round: f.round, winner: f.winner, loser, delta: wPos - lPos });
      }
    });

    upsets.sort((a,b)=> b.delta - a.delta || Number(b.round)-Number(a.round));
    return upsets.slice(0, 12);
  }

  function renderUpsets(upsets, season){
    if (!upsetsBody) return;
    upsetsBody.innerHTML = "";

    if (!upsets.length){
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="5" style="opacity:.8;">No upsets detected yet (needs winner + league positions).</td>`;
      upsetsBody.appendChild(tr);
      return;
    }

    upsets.forEach(u=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="col-num">R${esc(u.round)}</td>
        <td class="col-player"><a class="plink" href="${playerLink(season, u.winner)}"><strong>${esc(u.winner)}</strong></a></td>
        <td class="col-player"><a class="plink" href="${playerLink(season, u.loser)}"><strong>${esc(u.loser)}</strong></a></td>
        <td class="col-num"><strong>${esc(u.delta)}</strong></td>
        <td class="col-num"><span class="tag tag-warn">Upset</span></td>
      `;
      upsetsBody.appendChild(tr);
    });
  }

  function setText(el, v){ if (el) el.textContent = v; }
  function setHTML(el, v){ if (el) el.innerHTML = v; }

  /* =========================
     MONTE CARLO PREDICTOR
  ========================= */
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function rand01(){ return Math.random(); }

  function strengthFromWL(wins, played) { return (wins + 1) / (played + 2); }
  function winProb(aStr, bStr) {
    const p = aStr / (aStr + bStr);
    return clamp(p, 0.15, 0.85);
  }
  function sortStandings(arr) {
    arr.sort((x, y) => (y.pts - x.pts) || x.player.localeCompare(y.player));
  }

  function getRemainingFixtures(fixtures, season) {
    return fixtures
      .filter(f => String(f.season) === String(season))
      .filter(f => !f.played)
      .map(f => ({ a: f.a, b: f.b }));
  }

  function simulateSeason({ leagueRows, remainingFixtures, sims }) {
    const players = leagueRows.map(r => r.player);

    const base = new Map();
    leagueRows.forEach(r => {
      base.set(r.player, { pts: r.pts, wins: r.wins, played: r.p });
    });

    const winTitle = new Map(players.map(p => [p, 0]));
    const top5     = new Map(players.map(p => [p, 0]));
    const bottom2  = new Map(players.map(p => [p, 0]));
    const sumPts   = new Map(players.map(p => [p, 0]));
    const sumPos   = new Map(players.map(p => [p, 0]));

    const baseStrength = new Map();
    players.forEach(p => {
      const st = base.get(p);
      baseStrength.set(p, strengthFromWL(st.wins, st.played));
    });

    for (let s = 0; s < sims; s++) {
      const state = new Map();
      players.forEach(p => {
        const b = base.get(p);
        state.set(p, { pts: b.pts, wins: b.wins, played: b.played });
      });

      for (const m of remainingFixtures) {
        const a = m.a, b = m.b;
        if (!state.has(a) || !state.has(b)) continue;

        const aSt = state.get(a);
        const bSt = state.get(b);

        const aStrengthNow = strengthFromWL(aSt.wins, aSt.played);
        const bStrengthNow = strengthFromWL(bSt.wins, bSt.played);

        const A = 0.6 * aStrengthNow + 0.4 * (baseStrength.get(a) ?? aStrengthNow);
        const B = 0.6 * bStrengthNow + 0.4 * (baseStrength.get(b) ?? bStrengthNow);

        const pA = winProb(A, B);
        const aWins = rand01() < pA;

        aSt.played += 1;
        bSt.played += 1;

        if (aWins) { aSt.wins += 1; aSt.pts += 3; }
        else       { bSt.wins += 1; bSt.pts += 3; }
      }

      const final = players.map(p => ({ player: p, pts: state.get(p).pts }));
      sortStandings(final);

      const posMap = new Map();
      final.forEach((row, i) => posMap.set(row.player, i + 1));

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

  function renderPredictorTable({ season, leagueRows, simResult }) {
    if (!predBody) return;

    const sims = simResult.sims;
    const rows = leagueRows.map(r => {
      const p = r.player;
      return {
        pos: r.pos,
        player: r.player,
        pts: r.pts,
        titlePct: (simResult.winTitle.get(p) / sims) * 100,
        top5Pct: (simResult.top5.get(p) / sims) * 100,
        bottom2Pct: (simResult.bottom2.get(p) / sims) * 100,
        expPts: simResult.sumPts.get(p) / sims,
        expPos: simResult.sumPos.get(p) / sims
      };
    });

    rows.sort((a,b) => (a.expPos - b.expPos) || (b.expPts - a.expPts));

    if (predMeta) predMeta.textContent = `Season ${season} • Sims: ${sims.toLocaleString()} • Remaining matches simulated`;

    predBody.innerHTML = "";
    rows.forEach(r => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="col-num">${r.pos}</td>
        <td class="col-player"><a class="plink" href="${playerLink(season, r.player)}"><strong>${esc(r.player)}</strong></a></td>
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

  function runPredictor({ season, fixtures, leagueRows }) {
    if (!predBody || !leagueRows?.length) return;

    const sims = Number(simSelect?.value || 5000);
    const remaining = getRemainingFixtures(fixtures, season);
    if (!remaining.length) {
      if (predMeta) predMeta.textContent = `Season ${season} • No remaining matches to simulate`;
      predBody.innerHTML = "";
      return;
    }

    const simResult = simulateSeason({ leagueRows, remainingFixtures: remaining, sims });
    renderPredictorTable({ season, leagueRows, simResult });
  }

  async function init(){
    try {
      hideError();

      // Load fixtures
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
        const rounds = getRounds(fixtures, season);
        const current = computeCurrentRound(fixtures, season, rounds);

        if (roundSelect) {
          roundSelect.innerHTML = "";
          rounds.forEach(r=>{
            const opt = document.createElement("option");
            opt.value = r;
            opt.textContent = `Round ${r}`;
            roundSelect.appendChild(opt);
          });
          roundSelect.value = current;
        }

        return { rounds, current };
      }

      async function refresh(){
        const season = seasonSelect?.value || defaultSeason;
        if (seasonBadge) seasonBadge.textContent = `Season: ${season}`;

        // league data
        let leagueRows = [];
        try { leagueRows = await loadLeagueSeason(season); } catch { leagueRows = []; }

        const rounds = getRounds(fixtures, season);
        const currentRound = computeCurrentRound(fixtures, season, rounds);

        const selectedRound = (roundSelect?.value || currentRound);

        if (roundBadge) roundBadge.textContent = `Round: ${selectedRound}`;
        if (pulseTag) pulseTag.textContent = `Season ${season} • Round ${selectedRound}`;

        // Season completion
        const seasonFix = fixtures.filter(f=> String(f.season)===String(season));
        const played = seasonFix.filter(f=>f.played).length;
        const total = seasonFix.length;
        const pct = total ? Math.round((played/total)*100) : 0;

        setText(kpiCompletion, `${pct}%`);
        setText(kpiCompletionSub, `${played} played / ${total} total`);
        setText(kpiCurrentRound, `Round ${currentRound}`);
        setText(kpiCurrentRoundSub, `First round with pending matches`);

        // Hottest / Coldest (last 5)
        const form = lastNForm(fixtures, season, 5);
        const hot = form[0];
        const cold = [...form].sort((a,b)=> a.wins - b.wins)[0];

        if (hot){
          setHTML(kpiHot, `<a class="plink" href="${playerLink(season, hot.player)}"><strong>${esc(hot.player)}</strong></a>`);
          setText(kpiHotSub, `${hot.wins}/${hot.sample} wins (last 5)`);
        } else {
          setText(kpiHot, "—"); setText(kpiHotSub, "No played games yet");
        }

        if (cold){
          setHTML(kpiCold, `<a class="plink" href="${playerLink(season, cold.player)}"><strong>${esc(cold.player)}</strong></a>`);
          setText(kpiColdSub, `${cold.wins}/${cold.sample} wins (last 5)`);
        } else {
          setText(kpiCold, "—"); setText(kpiColdSub, "No played games yet");
        }

        // Competitiveness (from league table)
        if (leagueRows.length >= 2){
          const first = leagueRows[0], second = leagueRows[1];
          setText(gapTitle, `${Math.abs(first.pts - second.pts)} pts`);
          if (gapTitleSub) gapTitleSub.textContent = `${first.player} vs ${second.player}`;

          const mid = leagueRows.filter(x=> x.pos>=3 && x.pos<=6);
          if (mid.length>=2){
            const spread = Math.max(...mid.map(x=>x.pts)) - Math.min(...mid.map(x=>x.pts));
            setText(gapMid, `${spread} pts`);
          } else setText(gapMid, "—");

          const p7 = leagueRows.find(x=>x.pos===7);
          const p8 = leagueRows.find(x=>x.pos===8);
          if (p7 && p8) setText(gapBottom, `${Math.abs(p7.pts - p8.pts)} pts`);
          else setText(gapBottom, "—");

          const total7b = leagueRows.reduce((a,x)=>a+x.zb,0);
          const totalbp = leagueRows.reduce((a,x)=>a+x.bp,0);
          setText(bonusActivity, `${total7b + totalbp}`);
          setText(bonusActivitySub, `${total7b} (7B) + ${totalbp} (BP)`);
        } else {
          setText(gapTitle, "—");
          if (gapTitleSub) gapTitleSub.textContent = "";
          setText(gapMid, "—");
          setText(gapBottom, "—");
          setText(bonusActivity, "—");
          setText(bonusActivitySub, "league.csv needed");
        }

        // Round progress list
        renderRoundProgress(roundProgress(fixtures, season));

        // Upsets
        if (leagueRows.length){
          const upsets = computeUpsets(fixtures, season, leagueRows);
          renderUpsets(upsets, season);
        } else {
          renderUpsets([], season);
        }

        // ===== Selected round analytics =====
        if (roundTag) roundTag.textContent = `Round ${selectedRound} • Season ${season}`;

        const roundFix = fixtures.filter(f => String(f.season)===String(season) && String(f.round)===String(selectedRound));
        const rPlayed = roundFix.filter(f=>f.played).length;
        const rTotal  = roundFix.length;
        const rPending= rTotal - rPlayed;

        setText(roundRecord, `${rPlayed}/${rTotal}`);
        setText(roundRecordSub, rPending ? `${rPending} pending` : `Round complete`);

        // MVP
        const winCount = new Map();
        roundFix.filter(f=>f.played && f.winner).forEach(f=>{
          winCount.set(f.winner, (winCount.get(f.winner)||0)+1);
        });

        const sevenMap = new Map(leagueRows.map(x=>[x.player, x.zb]));
        let mvp = null;
        for (const [p,wc] of winCount.entries()){
          const s7 = sevenMap.get(p) ?? 0;
          const cand = { p, wc, s7 };
          if (!mvp || cand.wc > mvp.wc || (cand.wc===mvp.wc && cand.s7>mvp.s7)) mvp = cand;
        }

        if (mvp){
          setHTML(roundMvp, `<a class="plink" href="${playerLink(season, mvp.p)}"><strong>${esc(mvp.p)}</strong></a>`);
          setText(roundMvpSub, `${mvp.wc} win(s) • ${mvp.s7} season 7B`);
        } else {
          setText(roundMvp, "—");
          setText(roundMvpSub, "No played games");
        }

        // Most pending players this round
        const pendingPlayers = new Map();
        roundFix.filter(f=>!f.played).forEach(f=>{
          pendingPlayers.set(f.a, (pendingPlayers.get(f.a)||0)+1);
          pendingPlayers.set(f.b, (pendingPlayers.get(f.b)||0)+1);
        });
        const pendingTop = [...pendingPlayers.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3);

        if (pendingTop.length){
          setText(roundPending, pendingTop.map(x=>`${x[0]} (${x[1]})`).join(", "));
          setText(roundPendingSub, "count of pending games");
        } else {
          setText(roundPending, "—");
          setText(roundPendingSub, "No pending matches");
        }

        // Surprise = biggest upset in this round
        if (leagueRows.length){
          const posMap = new Map(leagueRows.map(x=>[x.player, x.pos]));
          let best = null;
          roundFix.filter(f=>f.played && f.winner).forEach(f=>{
            const loser = f.winner===f.a ? f.b : f.a;
            const wPos = posMap.get(f.winner);
            const lPos = posMap.get(loser);
            if (!wPos || !lPos) return;
            if (wPos > lPos){
              const delta = wPos - lPos;
              if (!best || delta > best.delta) best = { winner:f.winner, loser, delta };
            }
          });

          if (best){
            setHTML(roundSurprise, `<a class="plink" href="${playerLink(season, best.winner)}"><strong>${esc(best.winner)}</strong></a> over ${esc(best.loser)}`);
            setText(roundSurpriseSub, `Pos Δ ${best.delta}`);
          } else {
            setText(roundSurprise, "—");
            setText(roundSurpriseSub, "No upsets this round");
          }
        } else {
          setText(roundSurprise, "—");
          setText(roundSurpriseSub, "league.csv needed");
        }

        // ✅ Predictor runs safely if the table exists
        runPredictor({ season, fixtures, leagueRows });
      }

      // initial
      const { current } = await populateRounds(defaultSeason);
      if (roundBadge) roundBadge.textContent = `Round: ${current}`;
      await refresh();

      // events
      if (seasonSelect) {
        seasonSelect.addEventListener("change", async ()=>{
          const s = seasonSelect.value;
          await populateRounds(s);
          await refresh();
        });
      }
      if (roundSelect) roundSelect.addEventListener("change", ()=> refresh());

      // predictor button wiring (optional)
      if (runBtn && !runBtn.dataset.bound) {
        runBtn.dataset.bound = "1";
        runBtn.addEventListener("click", () => refresh());
      }
      if (simSelect) simSelect.addEventListener("change", () => refresh());

    } catch (e) {
      showError(`Couldn't load insights: ${e.message}`);
      console.error(e);
    }
  }

  init();
})();
