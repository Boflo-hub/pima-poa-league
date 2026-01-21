fetch("data/league.csv")
  .then(res => {
    if (!res.ok) throw new Error("league.csv not found");
    return res.text();
  })
  .then(csv => {
    const lines = csv.trim().split("\n");
    const header = lines[0].split(",").map(h => h.trim());
    const rows = lines.slice(1);

    // REQUIRED columns
    const idx = {
      season: header.indexOf("Season"),
      pos: header.indexOf("Pos"),
      player: header.indexOf("Player"),
      p: header.indexOf("P"),
      w: header.indexOf("W"),
      l: header.indexOf("L"),
      bf: header.indexOf("BF"),
      ba: header.indexOf("BA"),
      bd: header.indexOf("BD"),
      seven: header.indexOf("7B"),
      bp: header.indexOf("BP"),
      pts: header.indexOf("PTS"),
    };

    // Basic safety checks
    for (const k in idx) {
      if (idx[k] === -1) throw new Error(`Missing column in league.csv: ${k}`);
    }

    const data = rows
      .map(line => line.split(",").map(x => (x ?? "").trim()))
      .filter(cols => cols[idx.player] && cols[idx.pos] && cols[idx.season]);

    const seasons = [...new Set(data.map(cols => cols[idx.season]))]
      .map(Number)
      .sort((a, b) => a - b)
      .map(String);

    const seasonSelect = document.getElementById("seasonSelect");
    if (!seasonSelect) throw new Error("seasonSelect element not found in index.html");

    // Build dropdown
    seasonSelect.innerHTML = "";
    seasons.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = `Season ${s}`;
      seasonSelect.appendChild(opt);
    });

    // Default: latest season
    const currentSeason = seasons[seasons.length - 1] || "1";
    seasonSelect.value = currentSeason;

    function render(season) {
      // Filter to selected season
      const seasonRows = data
        .filter(cols => cols[idx.season] === season)
        .sort((a, b) => Number(a[idx.pos]) - Number(b[idx.pos]));

      const tbody = document.querySelector("#leagueTable tbody");
      if (!tbody) throw new Error("leagueTable tbody not found");

      tbody.innerHTML = "";

      seasonRows.forEach(cols => {
        const pos = Number(cols[idx.pos]);
        const player = cols[idx.player];

        const tr = document.createElement("tr");

        // zone coloring example (top5 green, bottom2 red)
        let zoneClass = "";
        if (pos <= 5) zoneClass = "zone-top";
        if (pos >= (seasonRows.length - 1)) zoneClass = "zone-bottom"; // bottom 2

        tr.innerHTML = `
          <td class="pos ${zoneClass}">${cols[idx.pos]}</td>
          <td class="player">${player}</td>
          <td>${cols[idx.p]}</td>
          <td>${cols[idx.w]}</td>
          <td>${cols[idx.l]}</td>
          <td>${cols[idx.bf]}</td>
          <td>${cols[idx.ba]}</td>
          <td>${cols[idx.bd]}</td>
          <td>${cols[idx.seven]}</td>
          <td>${cols[idx.bp]}</td>
          <td class="pts">${cols[idx.pts]}</td>
        `;

        tbody.appendChild(tr);
      });

      // Optional label somewhere:
      const label = document.getElementById("seasonLabel");
      if (label) label.textContent = `Season ${season}`;
    }

    render(currentSeason);
    seasonSelect.addEventListener("change", e => render(e.target.value));
  })
  .catch(err => {
    console.error(err);
    const box = document.getElementById("errorBox");
    if (box) {
      box.style.display = "block";
      box.textContent = "Couldn't load league table: " + err.message;
    }
  });
