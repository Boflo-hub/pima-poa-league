(() => {
  const CSV_PATH = "data/ranking.csv";

  const seasonSelect = document.getElementById("seasonSelect");
  const seasonBadge = document.getElementById("seasonBadge");
  const rankingBody = document.getElementById("rankingBody");
  const rankingError = document.getElementById("rankingError");
  const rankMeta = document.getElementById("rankMeta");

  const insightsMeta = document.getElementById("insightsMeta");
  const statTop = document.getElementById("statTop");
  const statTopSub = document.getElementById("statTopSub");
  const statWins = document.getElementById("statWins");
  const statWinsSub = document.getElementById("statWinsSub");
  const statBonus = document.getElementById("statBonus");
  const statBonusSub = document.getElementById("statBonusSub");
  const stat7b = document.getElementById("stat7b");
  const stat7bSub = document.getElementById("stat7bSub");

  function showError(msg) {
    rankingError.style.display = "block";
    rankingError.textContent = msg;
  }
  function hideError() {
    rankingError.style.display = "none";
    rankingError.textContent = "";
  }

  function parseCSV(text) {
    const rows = [];
    let row = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];

      if (ch === '"' && next === '"') { cur += '"'; i++; continue; }
      if (ch === '"') { inQuotes = !inQuotes; continue; }

      if (!inQuotes && ch === ",") {
        row.push(cur.trim());
        cur = "";
        continue;
      }

      if (!inQuotes && (ch === "\n" || ch === "\r")) {
        if (ch === "\r" && next === "\n") i++;
        row.push(cur.trim());
        cur = "";
        if (row.some(v => v !== "")) rows.push(row);
        row = [];
        continue;
      }

      cur += ch;
    }

    row.push(cur.trim());
    if (row.some(v => v !== "")) rows.push(row);
    return rows;
  }

  function makeIndex(header) {
    const norm = (s) => String(s || "").trim().toLowerCase();
    const idx = {};
    header.forEach((h, i) => { idx[norm(h)] = i; });
    return idx;
  }

  function rowToObj(cols, idx) {
    const get = (k) => {
      const i = idx[k];
      return i === undefined ? "" : (cols[i] ?? "");
    };

    return {
      Season: get("season"),
      Position: get("position") || get("pos"),
      Player: get("player"),
      Wins: get("wins") || get("w"),
      Bonus: get("bonus"),
      SevenB: get("7-baller") || get("7-baller ") || get("7b") || get("7-ballers"),
      Score: get("ranking score") || get("score")
    };
  }

  function getSeasons(rows) {
    const set = new Set(rows.map(r => String(r.Season)));
    return [...set].map(Number).sort((a, b) => a - b).map(String);
  }

  function pillClass(pos, total) {
    const p = Number(pos);
    if (!Number.isFinite(p)) return "pill";
    if (p <= 3) return "pill pill-top";      // top 3 highlight
    if (p >= total) return "pill pill-bot";  // last highlight (optional)
    return "pill";
  }

  function maxBy(rows, key) {
    let best = null;
    let bestVal = -Infinity;
    rows.forEach(r => {
      const v = Number(r[key]);
      if (Number.isFinite(v) && v > bestVal) {
        bestVal = v;
        best = r;
      }
    });
    return best;
  }

  function render(season, allRows) {
    const rows = allRows
      .filter(r => String(r.Season) === String(season))
      .filter(r => r.Player && r.Position)
      .sort((a, b) => Number(a.Position) - Number(b.Position));

    seasonBadge.textContent = `Season: ${season}`;
    rankMeta.textContent = rows.length ? `Players: ${rows.length}` : "—";
    insightsMeta.textContent = rows.length ? `Based on Season ${season}` : "—";

    rankingBody.innerHTML = "";
    rows.forEach(r => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="col-pos"><span class="${pillClass(r.Position, rows.length)}">${r.Position}</span></td>
        <td class="col-player"><strong>${r.Player}</strong></td>
        <td class="col-num">${r.Wins}</td>
        <td class="col-num">${r.Bonus}</td>
        <td class="col-num">${r.SevenB}</td>
        <td class="col-num"><strong>${r.Score}</strong></td>
      `;
      rankingBody.appendChild(tr);
    });

    // Insights
    const top = rows[0] || null;
    if (top) {
      statTop.textContent = top.Player;
      statTopSub.textContent = `Score: ${top.Score} • Wins: ${top.Wins}`;
    } else {
      statTop.textContent = "—";
      statTopSub.textContent = "—";
    }

    const mw = maxBy(rows, "Wins");
    statWins.textContent = mw ? mw.Player : "—";
    statWinsSub.textContent = mw ? `Wins: ${mw.Wins}` : "—";

    const mb = maxBy(rows, "Bonus");
    statBonus.textContent = mb ? mb.Player : "—";
    statBonusSub.textContent = mb ? `Bonus: ${mb.Bonus}` : "—";

    const m7 = maxBy(rows, "SevenB");
    stat7b.textContent = m7 ? m7.Player : "—";
    stat7bSub.textContent = m7 ? `7-Ballers: ${m7.SevenB}` : "—";
  }

  function init() {
    fetch(CSV_PATH, { cache: "no-store" })
      .then(r => r.text())
      .then(text => {
        hideError();
        const parsed = parseCSV(text.trim());
        if (parsed.length < 2) throw new Error("ranking.csv has no data rows.");

        const header = parsed[0];
        const idx = makeIndex(header);
        if (idx["season"] === undefined) throw new Error("Missing column: Season");

        const allRows = parsed.slice(1).map(cols => rowToObj(cols, idx));
        const seasons = getSeasons(allRows);
        if (!seasons.length) throw new Error("No Season values found in ranking.csv");

        seasonSelect.innerHTML = "";
        seasons.forEach(s => {
          const opt = document.createElement("option");
          opt.value = s;
          opt.textContent = `Season ${s}`;
          seasonSelect.appendChild(opt);
        });

        const defaultSeason = seasons[seasons.length - 1];
        seasonSelect.value = defaultSeason;
        render(defaultSeason, allRows);

        seasonSelect.addEventListener("change", (e) => {
          render(e.target.value, allRows);
        });
      })
      .catch(err => showError(`Couldn't load ranking table: ${err.message}`));
  }

  init();
})();
