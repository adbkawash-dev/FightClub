async function loadFighters() {
  const res = await fetch("data/fighters.json");
  return await res.json();
}

async function loadEvents() {
  const res = await fetch("data/events.json");
  return await res.json();
}

async function loadFights() {
  const res = await fetch("data/fights.json");
  return await res.json();
}

/* =========================
   RANKING SYSTEM CORE
========================= */

async function getSortedFighters() {
  const fighters = await loadFighters();

  return fighters.sort((a, b) => {
    // Kinan always #1
    if (a.name === "Kinan") return -1;
    if (b.name === "Kinan") return 1;

    // sort by wins
    return b.wins - a.wins;
  });
}

/* =========================
   RENDER FUNCTIONS
========================= */

async function renderRankings() {
  const data = await getSortedFighters();

  const container = document.getElementById("rankings");
  if (!container) return;

  container.innerHTML = data.map((f, i) => `
    <div class="card">
      <h3>#${i + 1} ${f.name}</h3>
      <p>Wins: ${f.wins} | Losses: ${f.losses}</p>
    </div>
  `).join("");
}

async function renderFighters() {
  const data = await loadFighters();

  const container = document.getElementById("fighters");
  if (!container) return;

  container.innerHTML = data.map(f => `
    <div class="card">
      <h3>${f.name}</h3>
      <p>Wins: ${f.wins} | Losses: ${f.losses}</p>
    </div>
  `).join("");
}

async function renderEvents() {
  const data = await loadEvents();

  const container = document.getElementById("events");
  if (!container) return;

  container.innerHTML = data.map(e => `
    <div class="card">
      <h3>${e.title}</h3>
      <p>${e.type}</p>
    </div>
  `).join("");
}

/* =========================
   ADMIN (basic gate only)
========================= */

function adminLogin() {
  const pass = document.getElementById("pass").value;

  if (pass === "admin123") {
    document.getElementById("panel").style.display = "block";
  } else {
    alert("Wrong password");
  }
}

/* =========================
   AUTO INIT
========================= */

window.addEventListener("load", () => {
  renderRankings();
  renderFighters();
  renderEvents();
});
