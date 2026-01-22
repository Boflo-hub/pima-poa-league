(async function () {
  const errorBox = document.getElementById("errorBox");
  const seasonSelect = document.getElementById("seasonSelect");
  const tbody = document.getElementById("leagueBody");

  function showError(msg){
    errorBox.style.display = "block";
    errorBox.textContent = msg;
  }

  function parseCSV(text){
    const lines = text.trim().split(/\r?\n/);
    const header = lines[0].split(",").map(s => s.trim());
    const rows = lines.slice(1).map(line => line.split(",").map(s => (s ?? "").trim()));
    return { header, rows };
  }

  function idxMap(header){
    const must = ["Season","Pos","Player","P","W","L","BF","BA","BD","7B","BP","PTS"];
    const map = {};
    for (const k of must){
      const i = header.indexOf(k);
      if (i === -1) throw new Error(`Missing column in league.csv: ${k}`);
      map[k] = i;
    }
    return map;
  }

  function render(rows, map){
    tbody.innerHTML = "";
    const total = rows.length;

    rows.forEach((r, i) => {
      const pos = r[map.Pos];
      const player = r[map.Player];

      // top 5 green, bottom 2 red
      const posClass =
        i < 5 ? "posPill posTop"
        : i >= total - 2 ? "posPill posBottom"
        : "posPill posMid";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><span class="${posClass}">${pos}</span></td>
        <td class="playerCell">${player}</td>
        <td>${r[map.P]}</td>
        <td>${r[map.W]}</td>
        <td>${r[map.L]}</td>
        <td>${r[map.BF]}</td>
        <td>${r[map.BA]}</td>
        <td>${r[map.BD]}</td>
        <td>${r[map["7B"]]}</td>
        <td>${r[map.BP]}</td>
        <td><strong>${r[map.PTS]}</strong></td>
      `;
      tbody.appendChild(tr);
    });
  }

  try {
    const res = await fetch("data/league.csv", { cache: "no-store" });
    if (!res.ok) throw new Error(`Fetch failed (${res.status}) for data/league.csv`);
    const text = await res.text();

    const { header, rows } = parseCSV(text);
    const map = idxMap(header);

    // seasons dropdown
    const seasons = [...new Set(rows.map(r => r[map.Season]).filter(Boolean))].sort((a,b)=>Number(a)-Number(b));
    seasons.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = `Season ${s}`;
      seasonSelect.appendChild(opt);
    });

    function applySeason(season){
      const filtered = (season === "all")
        ? rows
        : rows.filter(r => r[map.Season] === season);

      // keep current CSV order (already sorted by your sheet)
      render(filtered, map);
    }

    seasonSelect.addEventListener("change", e => applySeason(e.target.value));
    applySeason(seasonSelect.value);

  } catch (e) {
    showError(`Couldn't load league table: ${e.message}`);
    console.error(e);
  }
})();
