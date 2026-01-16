fetch("data/fixtures.csv")
  .then(res => res.text())
  .then(csv => {
    const rows = csv.trim().split("\n").slice(1);
    const tbody = document.querySelector("#fixturesTable tbody");
    const roundSelect = document.getElementById("roundFilter");

    let rounds = new Set();
    let fixtures = [];

    rows.forEach(row => {
      const [round, a, b, sa, sb] = row.split(",");
      rounds.add(round);

      fixtures.push({
        round,
        a,
        b,
        sa,
        sb,
        played: sa !== "" && sb !== ""
      });
    });

    // Populate round dropdown
    [...rounds].sort((a,b)=>a-b).forEach(r => {
      const opt = document.createElement("option");
      opt.value = r;
      opt.textContent = `Round ${r}`;
      roundSelect.appendChild(opt);
    });

    function render(filter = "all") {
      tbody.innerHTML = "";
      fixtures
        .filter(f => filter === "all" || f.round === filter)
        .forEach(f => {
          const tr = document.createElement("tr");

          tr.innerHTML = `
            <td>${f.round}</td>
            <td>${f.a}</td>
            <td>${f.played ? `${f.sa} - ${f.sb}` : "vs"}</td>
            <td>${f.b}</td>
            <td class="${f.played ? "played" : "pending"}">
              ${f.played ? "Played" : "Pending"}
            </td>
          `;
          tbody.appendChild(tr);
        });
    }

    render();

    roundSelect.addEventListener("change", e => {
      render(e.target.value);
    });
  });
