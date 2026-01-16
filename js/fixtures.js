// js/fixtures.js  (for CSV headers: Round, Player A, Player B, Played?, Winner)

(function () {
  const CSV_PATH = "data/fixtures.csv";

  const tbody = document.getElementById("fixturesBody");
  const roundSelect = document.getElementById("roundFilter");
  const badge = document.getElementById("currentRoundBadge");
  const errorBox = document.getElementById("errorBox");
  const errorMsg = document.getElementById("errorMsg");

  function showError(message) {
    console.error(message);
    if (errorMsg) errorMsg.textContent = message;
    if (errorBox) errorBox.style.display = "block";
  }

  // Handles commas inside quotes too (safer than split(","))
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
    // normalize: remove spaces, lowercase, remove punctuation like ?
    return (h || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[?]/g, "");
  }

  function statusPill(played) {
    return played
      ? `<span class="status played"><span class="dot"></span>Played</span>`
      : `<span class="status pending"><span class="dot"></span>Pending</span>`;
  }

  function clearOptionsKeepAllRounds() {
    while (roundSelect.options.length > 1) roundSelect.remove(1);
  }

  fetch(CSV_PATH, { cache: "no-store" })
    .then((res) => {
      if (!res.ok) throw new Error(`CSV fetch failed (${res.status})`);
      return res.text();
    })
    .then((csvText) => {
      const clean = csvText.replace(/\r/g, "").trim();
      if (!clean) throw new Error("fixtures.csv is empty.");

      const lines = clean.split("\n").filter(Boolean);
      if (lines.length < 2) throw new Error("fixtures.csv has no data rows.");

      const headerRaw = parseCSVLine(lines[0]);
      const header = headerRaw.map(normalizeHeader);

      // helper: find column by multiple possible names
      const colIndex = (names) => {
        for (const n of names) {
          const idx = header.indexOf(normalizeHeader(n));
          if (idx !== -1) return idx;
        }
        return -1;
      };

      // Your CSV columns
      const idx = {
        round: colIndex(["Round"]),
        a: colIndex(["PlayerA", "Player A"]),
        b: colIndex(["PlayerB", "Player B"]),
        played: colIndex(["Played", "Played?"]),
        winner: colIndex(["Winner"])
      };

      const missing = Object.entries(idx)
        .filter(([, v]) => v === -1)
        .map(([k]) => k);

      if (missing.length) {
        throw new Error(
          `Missing column(s): ${missing.join(", ")}.\n` +
          `Your header must include: Round, Player A, Player B, Played?, Winner`
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

        const played = playedVal === "YES" || playedVal === "Y" || playedVal === "TRUE" || playedVal === "1";
        roundsSet.add(round);

        fixtures.push({ round, a, b, played, winner });
      }

      if (!fixtures.length) throw new Error("No valid fixtures rows found.");

      const rounds = Array.from(roundsSet)
        .map((r) => String(r).trim())
        .filter(Boolean)
        .sort((x, y) => Number(x) - Number(y));

      // Current round = first round with ANY pending match
      let currentRound = rounds[0] || "1";
      for (const r of rounds) {
        const hasPending = fixtures.some((f) => f.round === r && !f.played);
        if (hasPending) { currentRound = r; break; }
      }
      badge.textContent = `Current Round: ${currentRound}`;

      // Dropdown
      clearOptionsKeepAllRounds();
      rounds.forEach((r) => {
        const opt = document.createElement("option");
        opt.value = r;
        opt.textContent = `Round ${r}`;
        roundSelect.appendChild(opt);
      });

      function render(filter) {
        tbody.innerHTML = "";

        fixtures
          .filter((f) => filter === "all" || f.round === filter)
          .forEach((f) => {
            const tr = document.createElement("tr");

            // Score column: show winner if played, otherwise "vs"
            const scoreText = f.played
              ? (f.winner ? `WIN: ${f.winner}` : "Played")
              : "vs";

            tr.innerHTML = `
              <td>Round ${f.round}</td>
              <td><strong>${f.a}</strong></td>
              <td>${scoreText}</td>
              <td><strong>${f.b}</strong></td>
              <td>${statusPill(f.played)}</td>
            `;

            tbody.appendChild(tr);
          });
      }

      // Default = current round
      roundSelect.value = currentRound;
      render(currentRound);

      roundSelect.addEventListener("change", (e) => render(e.target.value));
    })
    .catch((err) => {
      showError(
        `${err.message}\n\nQuick checks:\n` +
        `1) Confirm this opens: /data/fixtures.csv\n` +
        `2) Confirm header matches: Round, Player A, Player B, Played?, Winner\n`
      );
    });
})();
