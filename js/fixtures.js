fetch("data/fixtures.csv")
  .then(res => res.text())
  .then(csv => {
    const lines = csv.trim().split("\n");
    const header = lines[0].split(",").map(x => x.trim());
    const rows = lines.slice(1);

    const tbody = document.getElementById("fixturesBody");
    const roundSelect = document.getElementById("roundFilter");
    const badge = document.getElementById("currentRoundBadge");

    // Expected columns: Round,PlayerA,PlayerB,ScoreA,ScoreB
    const idx = {
      round: header.indexOf("Round"),
      a: header.indexOf("PlayerA"),
      b: header.indexOf("PlayerB"),
      sa: header.indexOf("ScoreA"),
      sb: header.indexOf("ScoreB")
    };

    const fixtures = [];
    const roundsSet = new Set();

    rows.forEach(line => {
      const cols = line.split(",").map(x => (x ?? "").trim());
      if (!cols[idx.a] || !cols[idx.b] || !cols[idx.round]) return;

      const round = cols[idx.round];
      const a = cols[idx.a];
      const b = cols[idx.b];
      const sa = cols[idx.sa] ?? "";
      const sb = cols[idx.sb] ?? "";

      const played = sa !== "" && sb !== "";

      roundsSet.add(round);
      fixtures.push({ round, a, b, sa, sb, played });
    });

    const rounds = [...roundsSet].map(Number).sort((x, y) => x - y).map(String);

    // Current round logic:
    // first round that still has ANY pending match
    let currentRound = rounds[0] || "1";
    for (const r of rounds) {
      const hasPending = fixtures.some(f => f.round === r && !f.played);
      if (hasPending) { currentRound = r; break; }
    }

    badge.textContent = `Current Round: ${currentRound}`;

    // Populate dropdown
    rounds.forEach(r => {
      const opt = document.createElement("option");
      opt.value = r;
      opt.textContent = `Round ${r}`;
      roundSelect.appendChild(opt);
    });

    function statusPill(played) {
      return played
        ? `<span class="status played"><span class="dot"></span>Played</span>`
        : `<span class="status pending"><span class="dot"></span>Pending</span>`;
    }

    function render(filter = "all") {
      tbody.innerHTML = "";

      fixtures
        .filter(f => filter === "all" || f.round === filter)
        .forEach(f => {
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

    // Default view = current round
    roundSelect.value = currentRound;
    render(currentRound);

    roundSelect.addEventListener("change", e => render(e.target.value));
  });
