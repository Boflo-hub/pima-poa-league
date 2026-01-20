(() => {
  const CSV_PATH = "data/fixtures.csv";

  const $ = (id) => document.getElementById(id);

  const roundSelect = $("roundFilter");
  const badge = $("currentRoundBadge");
  const summaryBadge = $("roundSummaryBadge");
  const pendingBtn = $("pendingToggle");
  const currentBtn = $("currentRoundToggle");

  const pendingBody = $("pendingBody");
  const playedBody = $("playedBody");

  const errorBox = $("errorBox");
  const errorMsg = $("errorMsg");

  function showError(message) {
    console.error(message);
    if (errorMsg) errorMsg.textContent = message;
    if (errorBox) errorBox.style.display = "block";
  }

  // Guard: required elements
  const required = [
    ["roundFilter", roundSelect],
    ["currentRoundBadge", badge],
    ["roundSummaryBadge", summaryBadge],
    ["pendingToggle", pendingBtn],
    ["currentRoundToggle", currentBtn],
    ["pendingBody", pendingBody],
    ["playedBody", playedBody],
    ["errorBox", errorBox],
    ["errorMsg", errorMsg]
  ];
  const missing = required.filter(([, el]) => !el).map(([id]) => id);
  if (missing.length) {
    showError("Missing element(s) in fixtures.html: " + missing.join(", "));
    return;
  }

  function parseCSVLine(line) {
    const out = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];

      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; continue; }
      if (ch === '"') { inQuotes = !inQuotes; continue; }

      if (ch === "," && !inQuotes) {
        out.push(cur.trim());
        cur = "";
        continue;
      }
      cur += ch;
    }
    out.push(cur.trim());
    return out;
  }

  function normalizeHeader(h) {
    return (h || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
  }

  function statusPill(played) {
    return played
      ? `<span class="status played"><span class="dot"></span>Played</span>`
      : `<span class="status pending"><span class="dot"></span>Pending</span>`;
  }

  fetch(CSV_PATH, { cache: "no-store" })
    .then((res) => {
      if (!res.ok) throw new Error(`CSV fetch failed (${res.status}). Check: ${CSV_PATH}`);
      return res.text();
    })
    .then((csvText) => {
      const clean = csvText.replace(/\r/g, "").trim();
      if (!clean) throw new Error("fixtures.csv is empty.");

      const lines = clean.split("\n").filter(Boolean);
      if (lines.length < 2) throw new Error("fixtures.csv has no data rows.");

      const headerRaw = parseCSVLine(lines[0]);
      const header = headerRaw.map(normalizeHeader);

      const colIndex = (names) => {
        for (const n of names) {
          const idx = header.indexOf(normalizeHeader(n));
          if (idx !== -1) return idx;
        }
        return -1;
      };

      const idx = {
        round: colIndex(["Round"]),
        a: colIndex(["PlayerA", "PlayerA", "PlayerA", "PlayerA", "PlayerA", "PlayerA", "PlayerA", "PlayerA", "PlayerA", "Player A"]),
        b: colIndex(["PlayerB", "Player B"]),
        played: colIndex(["Played?", "Played"]),
        winner: colIndex(["Winner"])
      };

      const missingCols = Object.entries(idx).filter(([, v]) => v === -1).map(([k]) => k);
      if (missingCols.length) {
        throw new Error(
          `CSV is missing column(s): ${missingCols.join(", ")}. Expected: Round, Player A, Player B, Played?, Winner`
        );
      }

      const fixtures = [];
      const roundsSet = new Set();

      for (const line of lines.slice(1)) {
        const cols = parseCSVLine(line);

        const round = (cols[idx.round] || "").trim();
        const a = (cols[idx.a] || "").trim();
        const b = (cols[idx.b] || "").trim();
        const playedVal = (cols[idx.played] || "").trim().toUpperCase();
        const winner = (cols[idx.winner] || "").trim();

        if (!round || !a || !b) continue;

        const played = ["YES", "Y", "TRUE", "1"].includes(playedVal);
        roundsSet.add(round);

        fixtures.push({ round, a, b, played, winner });
      }

      if (!fixtures.length) throw new Error("No valid fixtures rows found in fixtures.csv.");

      const rounds = Array.from(roundsSet).sort((x, y) => Number(x) - Number(y));

      // Current round = first round that still has any pending
      let currentRound = rounds[0] || "1";
      for (const r of rounds) {
        const hasPending = fixtures.some((f) => f.round === r && !f.played);
        if (hasPending) { currentRound = r; break; }
      }

      badge.textContent = `Current Round:${currentRound}`;

      // Populate dropdown
      while (roundSelect.options.length > 1) roundSelect.remove(1);
      rounds.forEach((r) => {
        const opt = document.createElement("option");
        opt.value = r;
        opt.textContent = `Round ${r}`;
        roundSelect.appendChild(opt);
      });

      let pendingOnly = false;
      let currentOnly = true;

      // default: current round
      roundSelect.value = currentRound;
      roundSelect.disabled = currentOnly;

      function roundStats(round) {
        const list = fixtures.filter(f => round === "all" || f.round === round);
        const total = list.length;
        const played = list.filter(f => f.played).length;
        return { total, played };
      }

      function render() {
        const chosenRound = roundSelect.value || "all";
        const activeRound = currentOnly ? currentRound : chosenRound;

        const stats = roundStats(activeRound);
        summaryBadge.textContent = `Played: ${stats.played} / ${stats.total}`;

        pendingBody.innerHTML = "";
        playedBody.innerHTML = "";

        const filtered = fixtures
          .filter(f => activeRound === "all" || f.round === activeRound)
          .filter(f => !pendingOnly || !f.played);

        const pending = filtered.filter(f => !f.played);
        const played = filtered.filter(f => f.played);

        pending.forEach(f => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>Round ${f.round}</td>
            <td><strong>${f.a}</strong></td>
            <td>vs</td>
            <td><strong>${f.b}</strong></td>
            <td>${statusPill(false)}</td>
          `;
          pendingBody.appendChild(tr);
        });

        played.forEach(f => {
          const tr = document.createElement("tr");
          const result = f.winner ? `WIN: ${f.winner}` : "Played";
          tr.innerHTML = `
            <td>Round ${f.round}</td>
            <td><strong>${f.a}</strong></td>
            <td>${result}</td>
            <td><strong>${f.b}</strong></td>
            <td>${statusPill(true)}</td>
          `;
          playedBody.appendChild(tr);
        });
      }

      render();

      roundSelect.addEventListener("change", render);

      pendingBtn.addEventListener("click", () => {
        pendingOnly = !pendingOnly;
        pendingBtn.classList.toggle("active", pendingOnly);
        pendingBtn.textContent = pendingOnly ? "Showing Pending Only" : "Show Pending Only";
        render();
      });

      currentBtn.addEventListener("click", () => {
        currentOnly = !currentOnly;
        currentBtn.classList.toggle("active", currentOnly);
        currentBtn.textContent = currentOnly ? "Current Round Only" : "All Rounds Mode";

        roundSelect.disabled = currentOnly;
        if (currentOnly) roundSelect.value = currentRound;

        render();
      });
    })
    .catch((err) => showError(err.message));
})();
