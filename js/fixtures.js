// js/fixtures.js — Season switcher + fixtures + H2H
// Expected columns in data/fixtures.csv:
// Season,Round,Player A,Player B,Played?,Winner
// If Season column is missing, script treats everything as Season "1".

const CSV_PATH = "data/fixtures.csv";

fetch(CSV_PATH, { cache: "no-store" })
  .then(res => {
    if (!res.ok) throw new Error(`HTTP ${res.status} while loading fixtures.csv`);
    return res.text();
  })
  .then(csv => init(csv))
  .catch(err => showError(err));

function showError(err) {
  const box = document.getElementById("errBox");
  const msg = document.getElementById("errMsg");
  if (box && msg) {
    box.style.display = "block";
    msg.textContent = err.message || String(err);
  } else {
    console.error(err);
  }
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(",").map(s => s.trim());
  const rows = lines.slice(1).map(line => line.split(",").map(v => (v ?? "").trim()));
  return { header, rows };
}

function idxOf(header, nameOptions) {
  for (const n of nameOptions) {
    const i = header.indexOf(n);
    if (i !== -1) return i;
  }
  return -1;
}

function init(csv) {
  const { header, rows } = parseCSV(csv);

  const idx = {
    season: idxOf(header, ["Season"]),
    round: idxOf(header, ["Round"]),
    a: idxOf(header, ["Player A", "PlayerA"]),
    b: idxOf(header, ["Player B", "PlayerB"]),
    played: idxOf(header, ["Played?", "Played"]),
    winner: idxOf(header, ["Winner"])
  };

  if (idx.round === -1 || idx.a === -1 || idx.b === -1 || idx.played === -1 || idx.winner === -1) {
    throw new Error("fixtures.csv is missing required columns. Need at least: Round, Player A, Player B, Played?, Winner");
  }

  // DOM
  const seasonSelect = document.getElementById("seasonSelect");
  const seasonBadge = document.getElementById("seasonBadge");

  const pendingBody = document.getElementById("pendingBody");
  const playedBody = document.getElementById("playedBody");

  const roundSelect = document.getElementById("roundFilter");
  const currentRoundBadge = document.getElementById("currentRoundBadge");
  const playedBadge = document.getElementById("playedBadge");

  const pendingOnlyBtn = document.getElementById("pendingOnlyBtn");
  const currentRoundOnlyBtn = document.getElementById("currentRoundOnlyBtn");

  const h2hA = document.getElementById("h2hA");
  const h2hB = document.getElementById("h2hB");
  const h2hSwap = document.getElementById("h2hSwap");
  const h2hClear = document.getElementById("h2hClear");
  const h2hBody = document.getElementById("h2hBody");

  const h2hMatches = document.getElementById("h2hMatches");
  const h2hPlayed = document.getElementById("h2hPlayed");
  const h2hPending = document.getElementById("h2hPending");
  const h2hAWins = document.getElementById("h2hAWins");
  const h2hBWins = document.getElementById("h2hBWins");
  const h2hAName = document.getElementById("h2hAName");
  const h2hBName = document.getElementById("h2hBName");

  // Parse rows into objects
  const all = [];
  const seasonsSet = new Set();

  rows.forEach(cols => {
    const season = (idx.season === -1 ? "1" : (cols[idx.season] || "1"));
    const round = cols[idx.round];
    const a = cols[idx.a];
    const b = cols[idx.b];
    const playedRaw = cols[idx.played];
    const winner = cols[idx.winner] || "";

    if (!round || !a || !b) return;

    const played = String(playedRaw).toUpperCase() === "YES";

    seasonsSet.add(season);
    all.push({ season, round: String(round), a, b, played, winner });
  });

  // Build season dropdown
  const seasons = [...seasonsSet].map(Number).sort((x,y)=>x-y).map(String);
  seasonSelect.innerHTML = "";
  seasons.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = `Season ${s}`;
    seasonSelect.appendChild(opt);
  });

  // Default Season = 1 if present
  const defaultSeason = seasons.includes("1") ? "1" : (seasons[0] || "1");
  seasonSelect.value = defaultSeason;
  seasonBadge.textContent = `Season: ${defaultSeason}`;

  // State
  let filterRound = "all";
  let pendingOnly = false;
  let currentOnly = false;

  function pill(played) {
    return played
      ? `<span class="pill playedPill"><span class="dot"></span>Played</span>`
      : `<span class="pill pendingPill"><span class="dot"></span>Pending</span>`;
  }

  function resetRoundDropdown(fixturesSeason) {
    // rebuild rounds based on season
    const roundsSet = new Set(fixturesSeason.map(f => f.round));
    const rounds = [...roundsSet].map(Number).sort((a,b)=>a-b).map(String);

    // compute current round
    let currentRound = rounds[0] || "1";
    for (const r of rounds) {
      const hasPending = fixturesSeason.some(f => f.round === r && !f.played);
      if (hasPending) { currentRound = r; break; }
    }
    currentRoundBadge.textContent = `Current Round: ${currentRound}`;

    // Played badge
    const playedCount = fixturesSeason.filter(f => f.played).length;
    playedBadge.textContent = `Played: ${playedCount} / ${fixturesSeason.length}`;

    // Round select
    roundSelect.innerHTML = `<option value="all">All Rounds</option>`;
    rounds.forEach(r => {
      const opt = document.createElement("option");
      opt.value = r;
      opt.textContent = `Round ${r}`;
      roundSelect.appendChild(opt);
    });

    // default view = current round (nice for live use)
    filterRound = currentRound;
    currentOnly = true;
    roundSelect.value = currentRound;
    currentRoundOnlyBtn.classList.add("active");

    return { rounds, currentRound };
  }

  function populatePlayers(fixturesSeason) {
    const playersSet = new Set();
    fixturesSeason.forEach(f => { playersSet.add(f.a); playersSet.add(f.b); });
    const players = [...playersSet].sort((x,y)=>x.localeCompare(y));

    h2hA.innerHTML = `<option value="" selected disabled>Player 1</option>`;
    h2hB.innerHTML = `<option value="" selected disabled>Player 2</option>`;

    players.forEach(p => {
      const oa = document.createElement("option");
      oa.value = p; oa.textContent = p;
      h2hA.appendChild(oa);

      const ob = document.createElement("option");
      ob.value = p; ob.textContent = p;
      h2hB.appendChild(ob);
    });
  }

  function samePair(f, p1, p2) {
    if (!p1 || !p2) return false;
    return (f.a === p1 && f.b === p2) || (f.a === p2 && f.b === p1);
  }

  function renderH2H(fixturesSeason) {
    const p1 = h2hA.value || "";
    const p2 = h2hB.value || "";

    if (!p1 || !p2 || p1 === p2) {
      h2hBody.innerHTML = `<tr><td colspan="6" class="mutedCenter">Select two different players to view matches.</td></tr>`;
      h2hMatches.textContent = "—";
      h2hPlayed.textContent = "—";
      h2hPending.textContent = "—";
      h2hAWins.textContent = "—";
      h2hBWins.textContent = "—";
      h2hAName.textContent = "P1 Wins";
      h2hBName.textContent = "P2 Wins";
      return;
    }

    h2hAName.textContent = `${p1} Wins`;
    h2hBName.textContent = `${p2} Wins`;

    const h2h = fixturesSeason
      .filter(f => samePair(f, p1, p2))
      .sort((x,y)=>Number(x.round)-Number(y.round));

    const played = h2h.filter(f => f.played);
    const pending = h2h.filter(f => !f.played);

    const p1Wins = played.filter(f => f.winner === p1).length;
    const p2Wins = played.filter(f => f.winner === p2).length;

    h2hMatches.textContent = String(h2h.length);
    h2hPlayed.textContent = String(played.length);
    h2hPending.textContent = String(pending.length);
    h2hAWins.textContent = String(p1Wins);
    h2hBWins.textContent = String(p2Wins);

    if (!h2h.length) {
      h2hBody.innerHTML = `<tr><td colspan="6" class="mutedCenter">No fixtures found for ${p1} vs ${p2}.</td></tr>`;
      return;
    }

    h2hBody.innerHTML = "";
    h2h.forEach(f => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>Round ${f.round}</td>
        <td class="left"><span class="name">${f.a}</span></td>
        <td class="mutedCenter">vs</td>
        <td class="left"><span class="name">${f.b}</span></td>
        <td class="mutedCenter">${f.played ? (f.winner || "—") : "—"}</td>
        <td>${pill(f.played)}</td>
      `;
      h2hBody.appendChild(tr);
    });
  }

  function renderMain(fixturesSeason, currentRound) {
    pendingBody.innerHTML = "";
    playedBody.innerHTML = "";

    let list = fixturesSeason.slice();

    if (currentOnly) list = list.filter(f => f.round === currentRound);
    else if (filterRound !== "all") list = list.filter(f => f.round === filterRound);

    if (pendingOnly) list = list.filter(f => !f.played);

    const pending = list.filter(f => !f.played);
    const played = list.filter(f => f.played);

    pending.forEach(f => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>Round ${f.round}</td>
        <td class="left"><span class="name">${f.a}</span></td>
        <td class="mutedCenter">vs</td>
        <td class="left"><span class="name">${f.b}</span></td>
        <td>${pill(false)}</td>
      `;
      pendingBody.appendChild(tr);
    });

    played.forEach(f => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>Round ${f.round}</td>
        <td class="left"><span class="name">${f.a}</span></td>
        <td class="mutedCenter">—</td>
        <td class="left"><span class="name">${f.b}</span></td>
        <td class="mutedCenter">${f.winner || "—"}</td>
        <td>${pill(true)}</td>
      `;
      playedBody.appendChild(tr);
    });

    if (!pending.length) pendingBody.innerHTML = `<tr><td colspan="5" class="mutedCenter">No pending matches for this view.</td></tr>`;
    if (!played.length) playedBody.innerHTML = `<tr><td colspan="6" class="mutedCenter">No played matches for this view.</td></tr>`;
  }

  function applySeason() {
    const season = seasonSelect.value;
    seasonBadge.textContent = `Season: ${season}`;

    const fixturesSeason = all.filter(f => f.season === season);

    const { currentRound } = resetRoundDropdown(fixturesSeason);
    populatePlayers(fixturesSeason);

    // reset H2H
    h2hA.value = "";
    h2hB.value = "";
    renderH2H(fixturesSeason);

    renderMain(fixturesSeason, currentRound);

    // wiring events (depend on season)
    roundSelect.onchange = (e) => {
      filterRound = e.target.value;
      currentOnly = false;
      currentRoundOnlyBtn.classList.remove("active");
      renderMain(fixturesSeason, currentRound);
    };

    pendingOnlyBtn.onclick = () => {
      pendingOnly = !pendingOnly;
      pendingOnlyBtn.classList.toggle("active", pendingOnly);
      renderMain(fixturesSeason, currentRound);
    };

    currentRoundOnlyBtn.onclick = () => {
      currentOnly = !currentOnly;
      currentRoundOnlyBtn.classList.toggle("active", currentOnly);
      if (currentOnly) {
        filterRound = currentRound;
        roundSelect.value = currentRound;
      }
      renderMain(fixturesSeason, currentRound);
    };

    h2hA.onchange = () => renderH2H(fixturesSeason);
    h2hB.onchange = () => renderH2H(fixturesSeason);

    h2hSwap.onclick = () => {
      const a = h2hA.value;
      const b = h2hB.value;
      if (!a && !b) return;
      h2hA.value = b || "";
      h2hB.value = a || "";
      renderH2H(fixturesSeason);
    };

    h2hClear.onclick = () => {
      h2hA.value = "";
      h2hB.value = "";
      renderH2H(fixturesSeason);
    };
  }

  seasonSelect.onchange = applySeason;
  applySeason();
}
