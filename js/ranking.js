// js/ranking.js — Season switcher for data/ranking.csv

fetch("data/ranking.csv", { cache: "no-store" })
  .then(res => {
    if (!res.ok) throw new Error(`HTTP ${res.status} while loading ranking.csv`);
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
  const header = lines[0].split(",").map(h => h.trim());
  const rows = lines.slice(1).map(line => line.split(",").map(x => (x ?? "").trim()));
  return { header, rows };
}

function init(csv) {
  const { header, rows } = parseCSV(csv);

  const idx = {
    season: header.indexOf("Season"),
    pos: header.indexOf("Position"),
    player: header.indexOf("Player"),
    wins: header.indexOf("Wins"),
    bonus: header.indexOf("Bonus"),
    seven: header.indexOf("7-Baller"),
    score: header.indexOf("Ranking Score")
  };

  for (const [k, v] of Object.entries(idx)) {
    if (v === -1) throw new Error(`Missing column in ranking.csv: ${k}`);
  }

  const tbody = document.getElementById("rankingBody");
  const seasonSelect = document.getElementById("seasonSelect");
  const seasonBadge = document.getElementById("seasonBadge");
  const meta = document.getElementById("meta");

  const all = [];
  const seasonsSet = new Set();

  rows.forEach(cols => {
    const season = cols[idx.season];
    const pos = cols[idx.pos];
    const player = cols[idx.player];
    if (!season || !pos || !player) return;

    seasonsSet.add(season);

    all.push({
      season,
      pos: Number(pos),
      player,
      wins: Number(cols[idx.wins] || 0),
      bonus: Number(cols[idx.bonus] || 0),
      seven: Number(cols[idx.seven] || 0),
      score: Number(cols[idx.score] || 0),
    });
  });

  const seasons = [...seasonsSet].map(Number).sort((a,b)=>a-b).map(String);
  seasonSelect.innerHTML = "";
  seasons.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = `Season ${s}`;
    seasonSelect.appendChild(opt);
  });

  // default = Season 1 if present
  const defaultSeason = seasons.includes("1") ? "1" : (seasons[0] || "1");
  seasonSelect.value = defaultSeason;

  function posBadgeClass(pos, total) {
    if (pos <= 3) return "pos topGlow";
    if (total >= 2 && pos >= total - 1) return "pos bottomDanger";
    return "pos neutral";
  }

  function render(season) {
    seasonBadge.textContent = `Season: ${season}`;
    tbody.innerHTML = "";

    const seasonRows = all
      .filter(r => r.season === season)
      .sort((a,b)=>a.pos-b.pos);

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
  seasonSelect.addEventListener("change", e => render(e.target.value));
}
