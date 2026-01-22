// ranking.js — reads data/ranking.csv and renders a compact stats table

fetch("data/ranking.csv", { cache: "no-store" })
  .then(res => {
    if (!res.ok) throw new Error(`HTTP ${res.status} while loading ranking.csv`);
    return res.text();
  })
  .then(csv => {
    const lines = csv.trim().split("\n");
    if (lines.length < 2) throw new Error("ranking.csv has no data rows.");

    const header = lines[0].split(",").map(h => h.trim());
    const rows = lines.slice(1);

    // DOM
    const tbody = document.getElementById("rankingBody");
    const seasonSelect = document.getElementById("seasonSelect");
    const seasonBadge = document.getElementById("seasonBadge");
    const meta = document.getElementById("meta");

    // Expected columns (your CSV)
    // Season,Position,Player,Wins,Bonus,7-Baller,Ranking Score
    const idx = {
      season: header.indexOf("Season"),
      pos: header.indexOf("Position"),
      player: header.indexOf("Player"),
      wins: header.indexOf("Wins"),
      bonus: header.indexOf("Bonus"),
      seven: header.indexOf("7-Baller"),
      score: header.indexOf("Ranking Score")
    };

    // Validate columns
    for (const [k, v] of Object.entries(idx)) {
      if (v === -1) throw new Error(`Missing column in ranking.csv: ${k}`);
    }

    // Parse
    const data = [];
    const seasonsSet = new Set();

    rows.forEach(line => {
      const cols = line.split(",").map(x => (x ?? "").trim());
      const season = cols[idx.season];
      const pos = cols[idx.pos];
      const player = cols[idx.player];

      if (!season || !pos || !player) return;

      seasonsSet.add(season);

      data.push({
        season,
        pos: Number(pos),
        player,
        wins: Number(cols[idx.wins] || 0),
        bonus: Number(cols[idx.bonus] || 0),
        seven: Number(cols[idx.seven] || 0),
        score: Number(cols[idx.score] || 0)
      });
    });

    const seasons = [...seasonsSet].map(Number).sort((a, b) => a - b).map(String);
    if (seasons.length === 0) throw new Error("No seasons found in ranking.csv.");

    // Populate season dropdown
    seasonSelect.innerHTML = "";
    seasons.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = `Season ${s}`;
      seasonSelect.appendChild(opt);
    });

    // Default season = latest
    const defaultSeason = seasons[seasons.length - 1];
    seasonSelect.value = defaultSeason;

    function posBadgeClass(pos, total) {
      if (pos <= 3) return "pos topGlow";          // top 3 glow
      if (pos >= total - 1) return "pos bottomDanger"; // bottom 2 red (if total>=2)
      return "pos neutral";                         // rest muted
    }

    function render(season) {
      tbody.innerHTML = "";

      const seasonRows = data
        .filter(r => r.season === season)
        .sort((a, b) => a.pos - b.pos);

      seasonBadge.textContent = `Season: ${season}`;
      meta.textContent = `Players: ${seasonRows.length}`;

      const total = seasonRows.length;

      seasonRows.forEach(r => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
          <td><span class="${posBadgeClass(r.pos, total)}">${r.pos}</span></td>
          <td class="left"><span class="name">${r.player}</span></td>
          <td>${r.wins}</td>
          <td>${r.bonus}</td>
          <td>${r.seven}</td>
          <td><span class="score">${r.score}</span></td>
        `;

        tbody.appendChild(tr);
      });
    }

    render(defaultSeason);

    seasonSelect.addEventListener("change", e => {
      render(e.target.value);
    });
  })
  .catch(err => {
    const box = document.getElementById("errBox");
    const msg = document.getElementById("errMsg");
    if (box && msg) {
      box.style.display = "block";
      msg.textContent = err.message || String(err);
    } else {
      console.error(err);
    }
  });
