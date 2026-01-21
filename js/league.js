fetch("data/league.csv")
  .then(res => {
    if (!res.ok) throw new Error("data/league.csv not found");
    return res.text();
  })
  .then(csv => {
    const lines = csv.trim().split("\n");
    if (lines.length < 2) throw new Error("league.csv is empty");

    const header = lines[0].split(",").map(h => h.trim());
    const rows = lines.slice(1);

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

    // Validate required columns
    for (const k in idx) {
      if (idx[k] === -1) throw new Error(`Missing column in league.csv: ${k}`);
    }

    // Parse rows
    const data = rows
      .map(line => line.split(",").map(x => (x ?? "").trim()))
      .filter(c => c[idx.season] && c[idx.pos] && c[idx.player]);

    const seasons = [...new Set(data.map(c => c[idx.season]))]
      .map(Number)
      .sort((a, b) => a - b)
      .map(String);

    const seasonSelect = document.getElementById("seasonSelect");
    if (!seasonSelect) throw new Error("seasonSelect not found in HTML");

    seasonSelect.innerHTML = "";
    seasons.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = `Season ${s}`;
      seasonSelect.appendChild(opt);
    });

    const tbody = document.querySelector("#league tbody");
    if (!tbody) throw new Error("League table tbody not found");

    function render(season) {
      tbody.innerHTML = "";

      const seasonRows = data
        .filter(c => c[idx.season] === season)
        .sort((a, b) => Number(a[idx.pos]) - Number(b[idx.pos]));

      const n = seasonRows.length;

      seasonRows.forEach(c => {
        const posNum = Number(c[idx.pos]);
        const posClass =
          posNum <= 5 ? "top5" :
          posNum >= (n - 1) ? "bottom2" : ""; // bottom 2

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><span class="posBadge ${posClass}">${c[idx.pos]}</span></td>
          <td class="player">${c[idx.player]}</td>
          <td>${c[idx.p]}</td>
          <td>${c[idx.w]}</td>
          <td>${c[idx.l]}</td>
          <td>${c[idx.bf]}</td>
          <td>${c[idx.ba]}</td>
          <td>${c[idx.bd]}</td>
          <td>${c[idx.seven]}</td>
          <td>${c[idx.bp]}</td>
          <td><strong>${c[idx.pts]}</strong></td>
        `;
        tbody.appendChild(tr);
      });
    }

    // Default to latest season
    const currentSeason = seasons[seasons.length - 1] || "1";
    seasonSelect.value = currentSeason;
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
