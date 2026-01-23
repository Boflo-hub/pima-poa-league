(() => {
  const CSV_PATH = "data/league.csv";

  const seasonSelect = document.getElementById("seasonSelect");
  const seasonBadge = document.getElementById("seasonBadge");
  const leagueBody = document.getElementById("leagueBody");
  const leagueMeta = document.getElementById("leagueMeta");
  const leagueError = document.getElementById("leagueError");

  function showError(msg) {
    leagueError.style.display = "block";
    leagueError.textContent = msg;
  }

  function hideError() {
    leagueError.style.display = "none";
    leagueError.textContent = "";
  }

  // Simple CSV parser that handles quoted commas
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

      if (!inQuotes && (ch === ",")) {
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

  function getSeasons(data) {
    const set = new Set();
    data.forEach(r => set.add(String(r.Season)));
    return [...set].map(Number).sort((a, b) => a - b).map(String);
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

    // Accept common header variants
    return {
      Season: get("season"),
      Pos: get("pos") || get("position"),
      Player: get("player"),
      P: get("p") || get("played") || get("games played"),
      W: get("w") || get("wins"),
      L: get("l") || get("losses"),
      BF: get("bf") || get("balls for"),
      BA: get("ba") || get("balls against"),
      BD: get("bd") || get("ball difference"),
      "7B": get("7b") || get("7-ballers") || get("7-ballers") || get("7 ballers"),
      BP: get("bp") || get("bonus points") || get("bonus"),
      PTS: get("pts") || get("league points (3 per win)") || get("league points") || get("points")
    };
  }

  function pillClass(pos, total) {
    const p = Number(pos);
    if (!Number.isFinite(p)) return "pill";
    if (p <= 5) return "pill pill-top";
    if (p >= total - 1) return "pill pill-bot"; // bottom 2
    return "pill";
  }

  function render(season, allRows) {
    const rows = allRows
      .filter(r => String(r.Season) === String(season))
      .filter(r => r.Player && r.Pos)
      .sort((a, b) => Number(a.Pos) - Number(b.Pos));

    leagueBody.innerHTML = "";
    leagueMeta.textContent = rows.length ? `Players: ${rows.length}` : "—";

    seasonBadge.textContent = `Season: ${season}`;

    rows.forEach((r) => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td class="col-pos"><span class="${pillClass(r.Pos, rows.length)}">${r.Pos}</span></td>
        <td class="col-player"><strong>${r.Player}</strong></td>
        <td class="col-num">${r.P}</td>
        <td class="col-num">${r.W}</td>
        <td class="col-num">${r.L}</td>
        <td class="col-num">${r.BF}</td>
        <td class="col-num">${r.BA}</td>
        <td class="col-num">${r.BD}</td>
        <td class="col-num">${r["7B"]}</td>
        <td class="col-num">${r.BP}</td>
        <td class="col-num"><strong>${r.PTS}</strong></td>
      `;
      leagueBody.appendChild(tr);
    });
  }

  function init() {
    fetch(CSV_PATH, { cache: "no-store" })
      .then(r => r.text())
      .then(text => {
        hideError();
        const parsed = parseCSV(text.trim());
        if (parsed.length < 2) throw new Error("league.csv has no data rows.");

        const header = parsed[0];
        const idx = makeIndex(header);

        // hard requirement: Season must exist
        if (idx["season"] === undefined) {
          throw new Error("Missing column in league.csv: Season");
        }

        const allRows = parsed.slice(1).map(cols => rowToObj(cols, idx));

        const seasons = getSeasons(allRows);
        if (!seasons.length) throw new Error("No Season values found in league.csv.");

        seasonSelect.innerHTML = "";
        seasons.forEach(s => {
          const opt = document.createElement("option");
          opt.value = s;
          opt.textContent = `Season ${s}`;
          seasonSelect.appendChild(opt);
        });

        // default season = latest
        const defaultSeason = seasons[seasons.length - 1];
        seasonSelect.value = defaultSeason;
        render(defaultSeason, allRows);

        seasonSelect.addEventListener("change", (e) => {
          render(e.target.value, allRows);
        });
      })
      .catch(err => {
        showError(`Couldn't load league table: ${err.message}`);
      });
  }

  init();
})();
