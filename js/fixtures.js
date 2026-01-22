// js/fixtures.js
(() => {
  const CSV_URL = "data/fixtures.csv"; // must exist exactly as /data/fixtures.csv (case-sensitive)

  // ---------- helpers ----------
  function $(id) { return document.getElementById(id); }

  // basic CSV parser that handles quoted commas
  function parseCSV(text) {
    const rows = [];
    let row = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];

      if (ch === '"' && inQuotes && next === '"') {
        cur += '"'; i++; continue; // escaped quote
      }
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

    // remove empty trailing rows
    return rows.filter(r => r.some(c => String(c).trim() !== ""));
  }

  function normHeader(h) {
    // "Player A" -> "playera", "Played?" -> "played"
    return String(h || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  function makeStatusPill(played) {
    return played
      ? `<span class="status played"><span class="dot"></span>Played</span>`
      : `<span class="status pending"><span class="dot"></span>Pending</span>`;
  }

  function showError(msg, detail = "") {
    const box = $("errorBox");
    if (!box) return;
    box.style.display = "block";
    box.innerHTML = `
      <div style="font-weight:800;margin-bottom:4px;">Couldn't load fixtures</div>
      <div style="opacity:.9">${msg}</div>
      ${detail ? `<div style="opacity:.7;margin-top:6px;font-size:12px;white-space:pre-wrap">${detail}</div>` : ""}
    `;
  }

  // ---------- main ----------
  document.addEventListener("DOMContentLoaded", async () => {
    // required elements (must exist in fixtures.html)
    const pendingBody = $("pendingBody");
    const playedBody  = $("playedBody");
    const roundFilter = $("roundFilter");
    const badgeRound  = $("currentRoundBadge");
    const badgeCount  = $("playedCountBadge");
    const pendingOnlyBtn = $("pendingOnlyBtn");
    const currentRoundBtn = $("currentRoundBtn");

    if (!pendingBody || !playedBody || !roundFilter || !badgeRound || !badgeCount) {
      showError("Missing required table elements in fixtures.html (tbody IDs).");
      return;
    }

    let pendingOnly = false;
    let currentRoundOnly = false;

    try {
      // cache-bust so GitHub Pages updates immediately
      const res = await fetch(`${CSV_URL}?v=${Date.now()}`);
      if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);

      const text = await res.text();
      const grid = parseCSV(text);

      if (grid.length < 2) throw new Error("CSV has no data rows.");

      const rawHeader = grid[0];
      const header = rawHeader.map(normHeader);

      // map headers flexibly (supports your format: Round,Player A,Player B,Played?,Winner)
      const idx = {
        season: header.indexOf("season"),
        round: header.indexOf("round"),
        a: header.indexOf("playera"),
        b: header.indexOf("playerb"),
        played: header.indexOf("played"),
        winner: header.indexOf("winner"),
        scorea: header.indexOf("scorea"),
        scoreb: header.indexOf("scoreb"),
      };

      if (idx.round === -1 || idx.a === -1 || idx.b === -1) {
        throw new Error(
          "CSV headers not recognized. Need at least: Round, Player A, Player B.\n" +
          `Found headers: ${rawHeader.join(" | ")}`
        );
      }

      const fixtures = [];
      const roundsSet = new Set();

      for (let i = 1; i < grid.length; i++) {
        const r = grid[i];
        const round = (r[idx.round] ?? "").trim();
        const a = (r[idx.a] ?? "").trim();
        const b = (r[idx.b] ?? "").trim();
        if (!round || !a || !b) continue;

        const playedStr = idx.played !== -1 ? String(r[idx.played] ?? "").trim() : "";
        const winner = idx.winner !== -1 ? String(r[idx.winner] ?? "").trim() : "";

        const sa = idx.scorea !== -1 ? String(r[idx.scorea] ?? "").trim() : "";
        const sb = idx.scoreb !== -1 ? String(r[idx.scoreb] ?? "").trim() : "";

        const played =
          (playedStr && /^(yes|y|played|true|1)$/i.test(playedStr)) ||
          (!!sa && !!sb) ||
          (!!winner && winner.length > 0);

        roundsSet.add(round);
        fixtures.push({ round, a, b, played, winner, sa, sb });
      }

      const rounds = [...roundsSet].map(Number).sort((x, y) => x - y).map(String);

      // determine "current round" = first round with any pending match
      let currentRound = rounds[0] || "1";
      for (const r of rounds) {
        const hasPending = fixtures.some(f => f.round === r && !f.played);
        if (hasPending) { currentRound = r; break; }
      }
      badgeRound.textContent = `Current Round: ${currentRound}`;

      // dropdown
      // clear existing except first "All Rounds"
      while (roundFilter.options.length > 1) roundFilter.remove(1);
      rounds.forEach(r => {
        const opt = document.createElement("option");
        opt.value = r;
        opt.textContent = `Round ${r}`;
        roundFilter.appendChild(opt);
      });

      function render() {
        const filterRound = roundFilter.value; // "all" or number as string
        pendingBody.innerHTML = "";
        playedBody.innerHTML = "";

        const filtered = fixtures.filter(f => {
          if (currentRoundOnly && f.round !== currentRound) return false;
          if (filterRound !== "all" && f.round !== filterRound) return false;
          if (pendingOnly && f.played) return false;
          return true;
        });

        const pending = filtered.filter(f => !f.played);
        const played = filtered.filter(f => f.played);

        // counts across ALL fixtures (not just filtered) for the badge
        const playedCountAll = fixtures.filter(f => f.played).length;
        badgeCount.textContent = `Played: ${playedCountAll}/${fixtures.length}`;

        // pending table
        pending.forEach(f => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>R${f.round}</td>
            <td style="text-align:left;padding-left:12px;"><strong>${f.a}</strong></td>
            <td>vs</td>
            <td style="text-align:left;padding-left:12px;"><strong>${f.b}</strong></td>
            <td>${makeStatusPill(false)}</td>
          `;
          pendingBody.appendChild(tr);
        });

        // played table
        played.forEach(f => {
          const tr = document.createElement("tr");
          const result =
            (f.sa && f.sb) ? `${f.sa} - ${f.sb}` :
            (f.winner ? `Winner: ${f.winner}` : "Played");

          tr.innerHTML = `
            <td>R${f.round}</td>
            <td style="text-align:left;padding-left:12px;"><strong>${f.a}</strong></td>
            <td>${result}</td>
            <td style="text-align:left;padding-left:12px;"><strong>${f.b}</strong></td>
            <td>${makeStatusPill(true)}</td>
          `;
          playedBody.appendChild(tr);
        });
      }

      // default view
      roundFilter.value = currentRound;
      render();

      roundFilter.addEventListener("change", render);

      if (pendingOnlyBtn) {
        pendingOnlyBtn.addEventListener("click", () => {
          pendingOnly = !pendingOnly;
          pendingOnlyBtn.classList.toggle("active", pendingOnly);
          render();
        });
      }

      if (currentRoundBtn) {
        currentRoundBtn.addEventListener("click", () => {
          currentRoundOnly = !currentRoundOnly;
          currentRoundBtn.classList.toggle("active", currentRoundOnly);
          render();
        });
      }

    } catch (err) {
      console.error(err);
      showError(err.message || "Unknown error", String(err.stack || ""));
    }
  });
})();
