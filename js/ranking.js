// ranking.js — reads data/ranking.csv and renders a compact stats table + insights

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

    // Insights DOM
    const iLeader = document.getElementById("iLeader");
    const iLeaderSub = document.getElementById("iLeaderSub");
    const iWins = document.getElementById("iWins");
    const iWinsSub = document.getElementById("iWinsSub");
    const iBonus = document.getElementById("iBonus");
    const iBonusSub = document.getElementById("iBonusSub");
    const i7b = document.getElementById("i7b");
    const i7bSub = document.getElementById("i7bSub");
    const iEff = document.getElementById("iEff");
    const iEffSub = document.getElementById("iEffSub");
    const iSpread = document.getElementById("iSpread");
    const iSpreadSub = document.getElementById("iSpreadSub");

    // Expected columns:
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

    // Validate
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

    // Dropdown
    seasonSelect.innerHTML = "";
    seasons.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = `Season ${s}`;
      seasonSelect.appendChild(opt);
    });

    // Default = latest season
    const defaultSeason = seasons[seasons.length - 1];
    seasonSelect.value = defaultSeason;

    function posBadgeClass(pos, total) {
      if (pos <= 3) return "pos topGlow";
      if (total >= 2 && pos >= total - 1) return "pos bottomDanger";
      return "pos neutral";
    }

    function topBy(arr, selector, tieBreaker) {
      // returns {item, value}
      let best = null;
      let bestVal = -Infinity;

      for (const item of arr) {
        const val = selector(item);
        if (val > bestVal) {
          bestVal = val;
          best = item;
        } else if (val === bestVal && tieBreaker) {
          // tie-breaker (e.g., higher score / lower pos)
          if (tieBreaker(item, best)) best = item;
        }
      }
      return { item: best, value: bestVal };
    }

    function renderInsights(seasonRows) {
      if (!seasonRows.length) return;

      // Score Leader
      const scoreLeader = seasonRows[0]; // sorted by pos already
      iLeader.textContent = scoreLeader.player;
      iLeaderSub.textContent = `Score: ${scoreLeader.score} • Pos: ${scoreLeader.pos}`;

      // Most Wins (tie -> higher score)
      const winsTop = topBy(
        seasonRows,
        r => r.wins,
        (a, b) => (a.score > b.score)
      );
      iWins.textContent = winsTop.item ? winsTop.item.player : "—";
      iWinsSub.textContent = winsTop.item ? `Wins: ${winsTop.item.wins} • Score: ${winsTop.item.score}` : "—";

      // Most Bonus (tie -> higher score)
      const bonusTop = topBy(
        seasonRows,
        r => r.bonus,
        (a, b) => (a.score > b.score)
      );
      iBonus.textContent = bonusTop.item ? bonusTop.item.player : "—";
      iBonusSub.textContent = bonusTop.item ? `Bonus: ${bonusTop.item.bonus} • Score: ${bonusTop.item.score}` : "—";

      // Most 7B (tie -> higher score)
      const sevenTop = topBy(
        seasonRows,
        r => r.seven,
        (a, b) => (a.score > b.score)
      );
      i7b.textContent = sevenTop.item ? sevenTop.item.player : "—";
      i7bSub.textContent = sevenTop.item ? `7B: ${sevenTop.item.seven} • Score: ${sevenTop.item.score}` : "—";

      // Best efficiency = score per win (min wins >= 1)
      const eligible = seasonRows.filter(r => r.wins > 0);
      if (eligible.length) {
        const effTop = topBy(
          eligible,
          r => r.score / r.wins,
          (a, b) => (a.score > b.score)
        );
        const eff = effTop.item ? (effTop.item.score / effTop.item.wins) : 0;
        iEff.textContent = effTop.item ? effTop.item.player : "—";
        iEffSub.textContent = effTop.item ? `Score/W: ${eff.toFixed(2)} • (${effTop.item.score}/${effTop.item.wins})` : "—";
      } else {
        iEff.textContent = "—";
        iEffSub.textContent = "No wins yet";
      }

      // Top-3 spread
      const s1 = seasonRows.find(r => r.pos === 1)?.score ?? null;
      const s3 = seasonRows.find(r => r.pos === 3)?.score ?? null;
      if (s1 !== null && s3 !== null) {
        iSpread.textContent = `${Math.max(0, s1 - s3)}`;
        iSpreadSub.textContent = `#1: ${s1} • #3: ${s3}`;
      } else {
        iSpread.textContent = "—";
        iSpreadSub.textContent = "Need top 3 data";
      }
    }

    function render(season) {
      tbody.innerHTML = "";

      const seasonRows = data
        .filter(r => r.season === season)
        .sort((a, b) => a.pos - b.pos);

      seasonBadge.textContent = `Season: ${season}`;
      meta.textContent = `Players: ${seasonRows.length}`;

      renderInsights(seasonRows);

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
