// fixtures.js — reads data/fixtures.csv
// Expected header: Round,Player A,Player B,Played?,Winner
// Also works if you add Season later.

fetch("data/fixtures.csv", { cache: "no-store" })
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
  // Simple CSV parser (assumes no quoted commas)
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(",").map(s => s.trim());
  const rows = lines.slice(1).map(line => line.split(",").map(v => (v ?? "").trim()));
  return { header, rows };
}

function idxOf(header, nameOptions) {
  // nameOptions = ["Player A","PlayerA",...]
  for (const n of nameOptions) {
    const i = header.indexOf(n);
    if (i !== -1) return i;
  }
  return -1;
}

function init(csv) {
  const { header, rows } = parseCSV(csv);

  const idx = {
    round: idxOf(header, ["Round"]),
    a: idxOf(header, ["Player A", "PlayerA"]),
    b: idxOf(header, ["Player B", "PlayerB"]),
    played: idxOf(header, ["Played?", "Played"]),
    winner: idxOf(header, ["Winner"])
  };

  for (const [k, v] of Object.entries(idx)) {
    if (v === -1) throw new Error(`Missing column in fixtures.csv: ${k}`);
  }

  const pendingBody = document.getElementById("pendingBody");
  const playedBody = document.getElementById("playedBody");

  const roundSelect = document.getElementById("roundFilter");
  const badge = document.getElementById("currentRoundBadge");
  const playedBadge = document.getElementById("playedBadge");

  const pendingOnlyBtn = document.getElementById("pendingOnlyBtn");
  const currentRoundOnlyBtn = document.getElementById("currentRoundOnlyBtn");

  // H2H
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

  const fixtures = [];
  const roundsSet = new Set();
  const playersSet = new Set();

  rows.forEach(cols => {
    const round = cols[idx.round];
    const a = cols[idx.a];
    const b = cols[idx.b];
    const playedRaw = cols[idx.played];
    const winner = cols[idx.winner] || "";

    if (!round || !a || !b) return;

    const played = String(playedRaw).toUpperCase() === "YES";

    roundsSet.add(round);
    playersSet.add(a);
    playersSet.add(b);

    fixtures.push({ round: String(round), a, b, played, winner });
  });

  // Sort rounds numeric
  const rounds = [...roundsSet].map(Number).sort((x, y) => x - y).map(String);

  // Determine current round = first round that has any pending match
  let currentRound = rounds[0] || "1";
  for (const r of rounds) {
    const hasPending = fixtures.some(f => f.round === r && !f.played);
    if (hasPending) { currentRound = r; break; }
  }
  badge.textContent = `Current Round: ${currentRound}`;

  // Populate round dropdown
  rounds.forEach(r => {
    const opt = document.createElement("option");
    opt.value = r;
    opt.textContent = `Round ${r}`;
    roundSelect.appendChild(opt);
  });

  // Played totals badge
  const playedCount = fixtures.filter(f => f.played).length;
  playedBadge.textContent = `Played: ${playedCount} / ${fixtures.length}`;

  // Populate players (H2H)
  const players = [...playersSet].sort((x, y) => x.localeCompare(y));
  players.forEach(p => {
    const oa = document.createElement("option");
    oa.value = p;
    oa.textContent = p;
    h2hA.appendChild(oa);

    const ob = document.createElement("option");
    ob.value = p;
    ob.textContent = p;
    h2hB.appendChild(ob);
  });

  // Filters state
  let filterRound = currentRound;      // default = current round
  let pendingOnly = false;
  let currentOnly = true;

  roundSelect.value = currentRound;

  function pill(played) {
    return played
      ? `<span class="pill playedPill"><span class="dot"></span>Played</span>`
      : `<span class="pill pendingPill"><span class="dot"></span>Pending</span>`;
  }

  function renderMain() {
    pendingBody.innerHTML = "";
    playedBody.innerHTML = "";

    let list = fixtures.slice();

    if (currentOnly) {
      list = list.filter(f => f.round === currentRound);
    } else if (filterRound !== "all") {
      list = list.filter(f => f.round === filterRound);
    }

    if (pendingOnly) {
      list = list.filter(f => !f.played);
    }

    const pending = list.filter(f => !f.played);
    const played = list.filter(f => f.played);

    // Pending table
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

    // Played table
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

    // Empty states
    if (pending.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="5" class="mutedCenter">No pending matches for this view.</td>`;
      pendingBody.appendChild(tr);
    }
    if (played.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="6" class="mutedCenter">No played matches for this view.</td>`;
      playedBody.appendChild(tr);
    }
  }

  // -------- Head-to-Head ----------
  function samePair(f, p1, p2) {
    if (!p1 || !p2) return false;
    return (f.a === p1 && f.b === p2) || (f.a === p2 && f.b === p1);
  }

  function renderH2H() {
    const p1 = h2hA.value || "";
    const p2 = h2hB.value || "";

    // not selected
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

    const h2h = fixtures
      .filter(f => samePair(f, p1, p2))
      .sort((x, y) => Number(x.round) - Number(y.round));

    const played = h2h.filter(f => f.played);
    const pending = h2h.filter(f => !f.played);

    const p1Wins = played.filter(f => f.winner === p1).length;
    const p2Wins = played.filter(f => f.winner === p2).length;

    h2hMatches.textContent = String(h2h.length);
    h2hPlayed.textContent = String(played.length);
    h2hPending.textContent = String(pending.length);
    h2hAWins.textContent = String(p1Wins);
    h2hBWins.textContent = String(p2Wins);

    if (h2h.length === 0) {
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

  // Initial render
  renderMain();
  renderH2H();

  // Events
  roundSelect.addEventListener("change", e => {
    filterRound = e.target.value;
    currentOnly = false;
    currentRoundOnlyBtn.classList.add("ghost");
    renderMain();
  });

  pendingOnlyBtn.addEventListener("click", () => {
    pendingOnly = !pendingOnly;
    pendingOnlyBtn.classList.toggle("active", pendingOnly);
    renderMain();
  });

  currentRoundOnlyBtn.addEventListener("click", () => {
    currentOnly = !currentOnly;
    currentRoundOnlyBtn.classList.toggle("active", currentOnly);
    if (currentOnly) {
      roundSelect.value = currentRound;
      filterRound = currentRound;
    }
    renderMain();
  });

  h2hA.addEventListener("change", renderH2H);
  h2hB.addEventListener("change", renderH2H);

  h2hSwap.addEventListener("click", () => {
    const a = h2hA.value;
    const b = h2hB.value;
    if (!a && !b) return;
    h2hA.value = b || "";
    h2hB.value = a || "";
    renderH2H();
  });

  h2hClear.addEventListener("click", () => {
    h2hA.value = "";
    h2hB.value = "";
    renderH2H();
  });
}
