// js/ranking.js
(() => {
  const CSV_URL = "data/ranking.csv";

  function $(id) { return document.getElementById(id); }

  // CSV parser that supports quoted commas
  function parseCSV(text) {
    const rows = [];
    let row = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];

      if (ch === '"' && inQuotes && next === '"') { cur += '"'; i++; continue; }
      if (ch === '"') { inQuotes = !inQuotes; continue; }

      if (!inQuotes && (ch === "\n" || ch === "\r")) {
        if (cur.length || row.length) {
          row.push(cur);
          rows.push(row.map(v => (v ?? "").trim()));
          row = [];
          cur = "";
        }
        continue;
      }

      if (!inQuotes && ch === ",") {
        row.push(cur);
        cur = "";
        continue;
      }

      cur += ch;
    }

    if (cur.length || row.length) {
      row.push(cur);
      rows.push(row.map(v => (v ?? "").trim()));
    }

    return rows.filter(r => r.some(c => String(c).trim() !== ""));
  }

  function normHeader(h) {
    // "Ranking Score" -> "rankingscore", "7-Baller" -> "7baller"
    return String(h || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  function showError(msg, detail = "") {
    const box = $("errorBox");
    if (!box) return;
    box.style.display = "block";
    box.innerHTML = `
      <div style="font-weight:800;margin-bottom:4px;">Couldn't load ranking</div>
      <div style="opacity:.9">${msg}</div>
      ${detail ? `<div style="opacity:.7;margin-top:6px;font-size:12px;white-space:pre-wrap">${detail}</div>` : ""}
    `;
  }

  function classForPos(pos, total) {
    // neon for top 3, red for bottom 2, else neutral
    if (pos <= 3) return "pos topGlow";
    if (pos >= total - 1) return "pos bottomDanger";
    return "pos neutral";
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const tbody = $("rankingBody");
    const seasonSelect = $("seasonSelect");
    const seasonBadge = $("seasonBadge");
    const rowCountBadge = $("rowCountBadge");

    if (!tbody || !seasonSelect || !seasonBadge || !rowCountBadge) {
      showError("Missing required elements in ranking.html (check IDs).");
      return;
    }

    try {
      const res = await fetch(`${CSV_URL}?v=${Date.now()}`);
      if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);

      const text = await res.text();
      const grid = parseCSV(text);
      if (grid.length < 2) throw new Error("CSV has no data rows.");

      const rawHeader = grid[0];
      const header = rawHeader.map(normHeader);

      // expected headers from your CSV:
      // Season,Position,Player,Wins,Bonus,7-Baller,Ranking Score
      const idx = {
        season: header.indexOf("season"),
        pos: header.indexOf("position"),
        player: header.indexOf("player"),
        wins: header.indexOf("wins"),
        bonus: header.indexOf("bonus"),
        sevenb: header.indexOf("7baller"),
        score: header.indexOf("rankingscore"),
      };

      if (idx.pos === -1 || idx.player === -1 || idx.wins === -1 || idx.bonus === -1 || idx.score === -1) {
        throw new Error(
          "CSV headers not recognized.\n" +
          "Need: Season, Position, Player, Wins, Bonus, 7-Baller, Ranking Score\n" +
          `Found: ${rawHeader.join(" | ")}`
        );
      }

      const data = [];
      const seasons = new Set();

      for (let i = 1; i < grid.length; i++) {
        const r = grid[i];

        const season = idx.season !== -1 ? String(r[idx.season] ?? "").trim() : "1";
        const pos = Number(String(r[idx.pos] ?? "").trim());
        const player = String(r[idx.player] ?? "").trim();

        if (!player || !pos) continue;

        const wins = String(r[idx.wins] ?? "").trim();
        const bonus = String(r[idx.bonus] ?? "").trim();
        const sevenb = idx.sevenb !== -1 ? String(r[idx.sevenb] ?? "").trim() : "0";
        const score = String(r[idx.score] ?? "").trim();

        seasons.add(season);
        data.push({ season, pos, player, wins, bonus, sevenb, score });
      }

      // populate seasons
      const seasonList = [...seasons].map(Number).sort((a, b) => a - b).map(String);
      // clear existing except "All Seasons"
      while (seasonSelect.options.length > 1) seasonSelect.remove(1);
      seasonList.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s;
        opt.textContent = `Season ${s}`;
        seasonSelect.appendChild(opt);
      });

      // default = latest season if available
      const defaultSeason = seasonList.length ? seasonList[seasonList.length - 1] : "all";
      seasonSelect.value = defaultSeason;

      function render() {
        const selected = seasonSelect.value;
        const filtered = data
          .filter(d => selected === "all" || d.season === selected)
          .sort((a, b) => a.pos - b.pos);

        tbody.innerHTML = "";
        seasonBadge.textContent = selected === "all" ? "Season: All" : `Season: ${selected}`;
        rowCountBadge.textContent = `Players: ${filtered.length}`;

        filtered.forEach((d, i) => {
          const tr = document.createElement("tr");
          const cls = classForPos(d.pos, filtered.length);

          tr.innerHTML = `
            <td><span class="${cls}">${d.pos}</span></td>
            <td style="text-align:left;"><strong>${d.player}</strong></td>
            <td>${d.wins}</td>
            <td>${d.bonus}</td>
            <td>${d.sevenb}</td>
            <td><strong>${d.score}</strong></td>
          `;
          tbody.appendChild(tr);
        });
      }

      render();
      seasonSelect.addEventListener("change", render);

    } catch (err) {
      console.error(err);
      showError(err.message || "Unknown error", String(err.stack || ""));
    }
  });
})();
