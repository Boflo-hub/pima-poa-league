// js/fixtures.js

(function () {
  const CSV_PATH = "data/fixtures.csv"; // must exist in /data/fixtures.csv

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

  // A safer CSV row parser (handles quoted fields + commas inside quotes)
  function parseCSVLine(line) {
    const out = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];

      if (ch === '"' && line[i + 1] === '"') {
        // escaped quote
        cur += '"';
        i++;
        continue;
      }

      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }

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
    return (h || "").trim().replace(/\s+/g, "");
  }

  function statusPill(played) {
    return played
      ? `<span class="status played"><span class="dot"></span>Played</span>`
      : `<span class="status pending"><span class="dot"></span>Pending</span>`;
  }

  function clearOptionsKeepAllRounds() {
    // Keep the first option (All Rounds) and remove the rest
    while (roundSelect.options.length > 1) roundSelect.remove(1);
  }

  fetch(CSV_PATH, { cache: "no-store" })
    .then((res) => {
      if (!res.ok) throw new Error(`CSV fetch failed (${res.status})`);
      return res.text();
    })
    .then((csvText) => {
      const clean = csvText.replace(/\r/g, "").trim(); // handle CRLF
      if (!clean) throw new Error("fixtures.csv is empty.");

      const lines = clean.split("\n").filter(Boolean);
      if (lines.length < 2) throw new Error("fixtures.csv has no data rows.");

      const header = parseCSVLine(lines[0]).map(normalizeHeader);
      const rows = lines.slice(1);

      // Accept a few header variants (just in case)
      const colIndex = (nameOptions) => {
        for (const n of nameOptions) {
          const idx = header.indexOf(normalizeHeader(n));
          if (idx !== -1) return idx;
        }
        return -1;
      };

      // Required columns:
      // Round, PlayerA, PlayerB, ScoreA, ScoreB
      const idx = {
        round: colIndex(["Round"]),
        a: colIndex(["PlayerA", "Player A"]),
        b: colIndex(["PlayerB", "Player B"]),
        sa: colIndex(["ScoreA", "Score A"]),
        sb: colIndex(["ScoreB", "Score B"])
      };

      const missing = Object.entries(idx)
        .filter(([, v]) => v === -1)
        .map(([k]) => k);

      if (missing.length) {
        throw new Error(
          `Missing required column(s): ${missing.join(", ")}. ` +
          `Expected headers like: Round, PlayerA, PlayerB, ScoreA, ScoreB`
        );
      }

      const fixtures = [];
      const roundsSet = new Set();

      for (const line of rows) {
        const cols = parseCSVLine(line);

        const round = (cols[idx.round] || "").trim();
        const a = (cols[idx.a] || "").trim();
        const b = (cols[idx.b] || "").trim();
        const sa = (cols[idx.sa] || "").trim();
        const sb = (cols[idx.sb] || "").trim();

        if (!round || !a || !b) continue;

        const played = sa !== "" && sb !== "";
        roundsSet.add(round);
        fixtures.push({ round, a, b, sa, sb, played });
      }

      if (!fixtures.length) throw new Error("No valid fixtures rows found in fixtures.csv.");

      // Sort rounds numerically (1,2,3...)
      const rounds = Array.from(roundsSet)
        .map((r) => String(r).trim())
        .filter(Boolean)
        .sort((x, y) => Number(x) - Number(y));

      // Determine current round = first round with ANY pending match
      let currentRound = rounds[0] || "1";
      for (const r of rounds) {
        const hasPending = fixtures.some((f) => f.round === r && !f.played);
        if (hasPending) {
          currentRound = r;
          break;
        }
      }

      badge.textContent = `Current Round: ${currentRound}`;

      // Build dropdown
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
            const scoreText = f.played ? `${f.sa} - ${f.sb}` : "vs";

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

      // Default: show current round (unless user chooses All)
      roundSelect.value = currentRound;
      render(currentRound);

      roundSelect.addEventListener("change", (e) => {
        render(e.target.value);
      });
    })
    .catch((err) => {
      showError(
        `${err.message}\n\nQuick checks:\n` +
        `1) Confirm this opens: /data/fixtures.csv\n` +
        `2) Confirm headers: Round, PlayerA, PlayerB, ScoreA, ScoreB\n` +
        `3) Confirm this page loads from GitHub Pages (not file://)`
      );
    });
})();
