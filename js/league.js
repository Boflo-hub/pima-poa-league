// js/league.js — Season switcher for data/league.csv
// Expected header: Season,Pos,Player,P,W,L,BF,BA,BD,7B,BP,PTS

const CSV_PATH = "data/league.csv";

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(",").map(s => s.trim());
  const rows = lines.slice(1).map(line => line.split(",").map(s => (s ?? "").trim()));
  return { header, rows };
}

function idxMap(header) {
  const must = ["Season","Pos","Player","P","W","L","BF","BA","BD","7B","BP","PTS"];
  const map = {};
  for (const k of must) {
    const i = header.indexOf(k);
    if (i === -1) throw new Error(`Missing column in league.csv header: ${k}`);
    map[k] = i;
  }
  return map;
}

function num(x){
  const n = Number(String(x).replace(/[^\d\-\.]/g,""));
  return Number.isFinite(n) ? n : 0;
}

function showError(msg){
  const box = document.getElementById("errBox");
  if (!box) return;
  box.textContent = msg;
  box.style.display = "block";
}
function hideError(){
  const box = document.getElementById("errBox");
  if (!box) return;
  box.style.display = "none";
}

function setSeasonBadge(season){
  const badge = document.getElementById("seasonBadge");
  if (badge) badge.textContent = `Season: ${season}`;
}

function renderTable(data){
  const tbody = document.querySelector("#league tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  // sort by position
  data.sort((a,b) => a.Pos - b.Pos);

  const total = data.length;

  data.forEach(r => {
    const tr = document.createElement("tr");

    const posClass =
      r.Pos <= 5 ? "top5" :
      (total >= 2 && r.Pos >= total - 1) ? "bottom2" : "";

    tr.innerHTML = `
      <td class="pos ${posClass}">${r.Pos}</td>
      <td class="player">${r.Player}</td>
      <td>${r.P}</td>
      <td>${r.W}</td>
      <td>${r.L}</td>
      <td>${r.BF}</td>
      <td>${r.BA}</td>
      <td>${r.BD}</td>
      <td>${r["7B"]}</td>
      <td>${r.BP}</td>
      <td><strong>${r.PTS}</strong></td>
    `;
    tbody.appendChild(tr);
  });
}

async function boot(){
  const res = await fetch(CSV_PATH, { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not fetch ${CSV_PATH} (HTTP ${res.status})`);

  const text = await res.text();
  const { header, rows } = parseCSV(text);
  const idx = idxMap(header);

  // build full dataset
  const all = rows
    .map(cols => ({
      Season: cols[idx.Season],
      Pos: num(cols[idx.Pos]),
      Player: cols[idx.Player],
      P: num(cols[idx.P]),
      W: num(cols[idx.W]),
      L: num(cols[idx.L]),
      BF: num(cols[idx.BF]),
      BA: num(cols[idx.BA]),
      BD: num(cols[idx.BD]),
      "7B": num(cols[idx["7B"]]),
      BP: num(cols[idx.BP]),
      PTS: num(cols[idx.PTS]),
    }))
    .filter(r => r.Season && r.Player);

  const seasons = [...new Set(all.map(r => r.Season))]
    .sort((a,b) => num(a) - num(b));

  const sel = document.getElementById("seasonSelect");
  if (!sel) throw new Error("Missing #seasonSelect element in index.html");

  // populate dropdown
  sel.innerHTML = "";
  seasons.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = `Season ${s}`;
    sel.appendChild(opt);
  });

  // ✅ Default = Season 1 if present (since Season 1 is ongoing)
  const defaultSeason = seasons.includes("1") ? "1" : (seasons[0] || "1");
  sel.value = defaultSeason;

  function apply(){
    hideError();
    const season = sel.value;
    setSeasonBadge(season);
    const data = all.filter(r => r.Season === season);
    renderTable(data);
  }

  apply();
  sel.addEventListener("change", apply);
}

boot().catch(err => {
  console.error(err);
  showError(err.message);
});
