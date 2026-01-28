(() => {
  const FIXTURES_PATH = "data/fixtures.csv";
  const LEAGUE_PATH   = "data/league.csv";

  // UI
  const seasonSelect = document.getElementById("seasonSelect");
  const seasonBadge  = document.getElementById("seasonBadge");
  const roundSelect  = document.getElementById("roundSelect");
  const roundBadge   = document.getElementById("roundBadge");
  const tbody        = document.getElementById("powerBody");
  const errorBox     = document.getElementById("powerError");
  const metaTag      = document.getElementById("metaTag");

  const showError = (msg) => {
    if (!errorBox) return;
    errorBox.style.display = "block";
    errorBox.textContent = msg;
  };
  const hideError = () => {
    if (!errorBox) return;
    errorBox.style.display = "none";
    errorBox.textContent = "";
  };

  // CSV parser (handles quotes)
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

  const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
  function makeIndex(header) {
    const idx = {};
    header.forEach((h, i) => (idx[norm(h)] = i));
    return idx;
  }
  function requireCol(idx, name) {
    if (idx[norm(name)] === undefined) throw new Error(`Missing column: ${name}`);
  }

  const esc = (s) =>
    String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const n = (x) => {
    const v = Number(String(x ?? "").trim());
    return Number.isFinite(v) ? v : 0;
  };

  function playerLink(season, player) {
    return `player.html?season=${encodeURIComponent(season)}&player=${encodeURIComponent(player)}`;
  }

  function chipForm(lastN) {
    // lastN is array of 'W' | 'L'
    // Use your existing "pill/tag" styling if present; otherwise plain.
    return lastN.map(r => {
      const cls = r === "W" ? "tag tag-ok" : "tag tag-bad";
      const label = r;
      return `<span class="${cls}" style="margin-right:6px;">${label}</span>`;
    }).join("");
  }

  function getSeasons(fixtures) {
    const set = new Set(fixtures.map(f => String(f.season)));
    return [...set].map(Number).sort((a, b) => a - b).map(String);
  }

  function getRounds(fixtures, season) {
    const set = new Set(
      fixtures.filter(f => String(f.season) === String(season)).map(f => String(f.round))
    );
    return [...set].map(Number).sort((a, b) => a - b).map(String);
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

  // Builds chronological match list per player
  function buildPlayerMatches(fixtures, season, uptoRoundInclusive = null) {
    // Keep only played matches, order by (round asc, then file order)
    const list = fixtures
      .filter(f => String(f.season) === String(season))
      .filter(f => f.played)
      .filter(f => uptoRoundInclusive == null ? true : Number(f.round) <= Number(uptoRoundInclusive))
      .sort((a, b) => Number(a.round) - Number(b.round));

    const map = new Map(); // player -> matches[]
    const add = (player, obj) => {
      if (!map.has(player)) map.set(player, []);
      map.get(player).push(obj);
    };

    list.forEach(f => {
      const winner = f.winner || "";
      const aWin = winner && winner === f.a;
      const bWin = winner && winner === f.b;

      add(f.a, { round: f.round, opp: f.b, result: aWin ? "W" : (bWin ? "L" : "W") }); // fallback if winner missing
      add(f.b, { round: f.round, opp: f.a, result: bWin ? "W" : (aWin ? "L" : "L") });
    });

    return map;
  }

  function currentStreak(matches) {
    // returns like "W3" or "L2" or "—"
    if (!matches || !matches.length) return "—";
    let i = matches.length - 1;
    const last = matches[i].result;
    let cnt = 0;
    while (i >= 0 && matches[i].result === last) { cnt++; i--; }
    return `${last}${cnt}`;
  }

  function roundRecord(fixtures, season, round, player) {
    const list = fixtures.filter(f => String(f.season) === String(season) && String(f.round) === String(round));
    let w = 0, l = 0, p = 0;
    list.forEach(f => {
      if (f.a !== player && f.b !== player) return;
      p++;
      if (!f.played) return;
      if (f.winner === player) w++; else l++;
    });
    return { w, l, p };
  }

  function computePower({ matchesMap, fixtures, season, round, leagueMap }) {
    // leagueMap: player -> { pts, bd }
    const players = new Set();

    // from fixtures
    fixtures
      .filter(f => String(f.season) === String(season))
      .forEach(f => { players.add(f.a); players.add(f.b); });

    // from league.csv (if present)
    for (const p of leagueMap.keys()) players.add(p);

    const out = [];

    for (const player of players) {
      const matches = matchesMap.get(player) || [];
      const last5 = matches.slice(-5).map(m => m.result);

      // Recent form points
      // last5: W=3, L=0
      const formScore = last5.reduce((acc, r) => acc + (r === "W" ? 3 : 0), 0);

      // Streak bonus: W streak adds more, L streak subtracts a little
      const streak = currentStreak(matches);
      let streakBonus = 0;
      if (streak !== "—") {
        const typ = streak[0];
        const len = n(streak.slice(1));
        streakBonus = typ === "W" ? Math.min(6, len * 1.5) : -Math.min(4, len * 1.0);
      }

      // Round performance (played matches in selected round)
      const rr = roundRecord(fixtures, season, round, player);
      const roundScore = (rr.w * 2) + (rr.l * -1); // mild weight

      // Season strength (from league table)
      const lg = leagueMap.get(player) || { pts: 0, bd: 0 };
      const seasonScore = (lg.pts * 0.4) + (lg.bd * 0.15);

      const power = formScore + streakBonus + roundScore + seasonScore;

      // “Why” line
      const why = [
        `Form ${formScore.toFixed(0)}`,
        `Streak ${streakBonus >= 0 ? "+" : ""}${streakBonus.toFixed(1)}`,
        `Round ${rr.w}-${rr.l}`,
        `Season ${lg.pts}pts / BD ${lg.bd}`
      ].join(" • ");

      out.push({
        player,
        power,
        last5,
        streak,
        rr,
        why
      });
    }

    // Sort by power desc
    out.sort((a, b) => b.power - a.power);

    return out;
  }

  function computeMovement(prevList, curList) {
    // returns map player -> {moveSymbol, delta}
    // delta = prevRank - curRank (positive means up)
    const prevRank = new Map();
    prevList.forEach((x, i) => prevRank.set(x.player, i + 1));

    const moveMap = new Map();
    curList.forEach((x, i) => {
      const curRank = i + 1;
      const pr = prevRank.get(x.player);
      if (!pr) {
        moveMap.set(x.player, { symbol: "★", delta: 0 });
        return;
      }
      const delta = pr - curRank;
      const symbol = delta > 0 ? "↑" : delta < 0 ? "↓" : "→";
      moveMap.set(x.player, { symbol, delta });
    });
    return moveMap;
  }

  async function loadLeagueMap(season) {
    // Optional: if league.csv missing, just return empty map
    try {
      const txt = await fetch(LEAGUE_PATH, { cache: "no-store" }).then(r => r.text());
      const parsed = parseCSV(txt.trim());
      if (parsed.length < 2) return new Map();

      const header = parsed[0];
      const idx = makeIndex(header);

      // Accept either your normalized header names
      requireCol(idx, "Season");
      requireCol(idx, "Player");

      // PTS/BD names must match your league.csv header
      // You said header is: Season,Pos,Player,P,W,L,BF,BA,BD,7B,BP,PTS
      requireCol(idx, "PTS");
      requireCol(idx, "BD");

      const rows = parsed.slice(1);
      const map = new Map();
      rows.forEach(r => {
        if (String(r[idx[norm("Season")]]) !== String(season)) return;
        const p = r[idx[norm("Player")]];
        if (!p) return;
        map.set(p, {
          pts: n(r[idx[norm("PTS")]]),
          bd: n(r[idx[norm("BD")]])
        });
      });
      return map;
    } catch {
      return new Map();
    }
  }

  function renderTable(season, round, powerList, moveMap) {
    tbody.innerHTML = "";

    powerList.forEach((x, i) => {
      const rank = i + 1;
      const mv = moveMap.get(x.player) || { symbol: "→", delta: 0 };

      // Make move text a little descriptive
      const moveText =
        mv.symbol === "★" ? "NEW" :
        mv.delta === 0 ? "→ 0" :
        `${mv.symbol} ${Math.abs(mv.delta)}`;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="col-num"><strong>${rank}</strong></td>
        <td class="col-player">
          <a class="plink" href="${playerLink(season, x.player)}"><strong>${esc(x.player)}</strong></a>
        </td>
        <td class="col-num">${esc(moveText)}</td>
        <td class="col-num"><strong>${x.power.toFixed(1)}</strong></td>
        <td class="col-num">${chipForm(x.last5)}</td>
        <td class="col-num">${esc(x.streak)}</td>
        <td class="col-num">${esc(`${x.rr.w}-${x.rr.l}`)}</td>
        <td class="col-num" style="text-align:left; opacity:.9;">${esc(x.why)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  async function init() {
    try {
      hideError();
      const txt = await fetch(FIXTURES_PATH, { cache: "no-store" }).then(r => r.text());
      const parsed = parseCSV(txt.trim());
      if (parsed.length < 2) throw new Error("fixtures.csv has no data rows.");

      const header = parsed[0];
      const idx = makeIndex(header);

      // Your fixtures.csv header: Season,Round,Player A,Player B,Played?,Winner
      requireCol(idx, "Season");
      requireCol(idx, "Round");
      requireCol(idx, "Player A");
      requireCol(idx, "Player B");
      requireCol(idx, "Played?");
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

      const seasons = getSeasons(fixtures);
      if (!seasons.length) throw new Error("No seasons found in fixtures.csv");

      seasonSelect.innerHTML = "";
      seasons.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s;
        opt.textContent = `Season ${s}`;
        seasonSelect.appendChild(opt);
      });

      const defaultSeason = seasons[seasons.length - 1];
      seasonSelect.value = defaultSeason;

      async function populateRounds(season) {
        const rounds = getRounds(fixtures, season);
        roundSelect.innerHTML = "";
        rounds.forEach(r => {
          const opt = document.createElement("option");
          opt.value = r;
          opt.textContent = `Round ${r}`;
          roundSelect.appendChild(opt);
        });
        return rounds;
      }

      async function refresh() {
        const season = seasonSelect.value;
        seasonBadge.textContent = `Season: ${season}`;

        const rounds = getRounds(fixtures, season);
        const currentRound = computeCurrentRound(fixtures, season, rounds);

        // default if no selection yet
        if (!roundSelect.value) {
          roundSelect.value = currentRound;
        }

        const round = roundSelect.value || currentRound;
        roundBadge.textContent = `Round: ${round}`;
        metaTag.textContent = `Based on R${round} • Season ${season}`;

        // current and previous ranking lists (for movement)
        const leagueMap = await loadLeagueMap(season);

        const curMatchesMap = buildPlayerMatches(fixtures, season, round);
        const curList = computePower({
          matchesMap: curMatchesMap,
          fixtures,
          season,
          round,
          leagueMap
        });

        const prevRoundNum = Math.max(1, Number(round) - 1);
        const prevMatchesMap = buildPlayerMatches(fixtures, season, String(prevRoundNum));
        const prevList = computePower({
          matchesMap: prevMatchesMap,
          fixtures,
          season,
          round: String(prevRoundNum),
          leagueMap
        });

        const moveMap = computeMovement(prevList, curList);
        renderTable(season, round, curList, moveMap);
      }

      // init rounds, default to currentRound
      const rounds = await populateRounds(defaultSeason);
      const cr = computeCurrentRound(fixtures, defaultSeason, rounds);
      roundSelect.value = cr;
      await refresh();

      seasonSelect.addEventListener("change", async () => {
        const s = seasonSelect.value;
        const rounds2 = await populateRounds(s);
        const cr2 = computeCurrentRound(fixtures, s, rounds2);
        roundSelect.value = cr2;
        await refresh();
      });

      roundSelect.addEventListener("change", () => refresh());

    } catch (e) {
      showError(`Couldn't load power rankings: ${e.message}`);
      tbody.innerHTML = "";
      seasonBadge.textContent = "Season: —";
      roundBadge.textContent = "Round: —";
      if (metaTag) metaTag.textContent = "—";
    }
  }

  init();
})();
