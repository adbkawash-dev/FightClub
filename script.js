(function () {
  "use strict";

  const ADMIN_PASSWORD = "ADBK@QAST";
  const STORAGE_KEY = "school-fight-club-state-v3";

  const OFFICIAL_FIGHTERS = [
    { id: "kinan", name: "Kinan", wins: 0, losses: 0, rank: 1, baseRank: 1, active: true },
    { id: "ayham", name: "Ayham", wins: 0, losses: 0, rank: 2, baseRank: 2, active: true },
    { id: "hajar", name: "Hajar", wins: 0, losses: 0, rank: 3, baseRank: 3, active: true },
    { id: "aburoza", name: "Aburoza", wins: 0, losses: 0, rank: 4, baseRank: 4, active: true },
    { id: "mubarak-al-khalifa", name: "Mubarak Al Khalifa", wins: 0, losses: 0, rank: 5, baseRank: 5, active: true },
    { id: "mustafa", name: "Mustafa", wins: 0, losses: 0, rank: 6, baseRank: 6, active: true },
    { id: "rayyan", name: "Rayyan", wins: 0, losses: 0, rank: 7, baseRank: 7, active: true },
    { id: "ahmad-zoubi", name: "Ahmad Zoubi", wins: 0, losses: 0, rank: 8, baseRank: 8, active: true },
    { id: "abdi", name: "Abdi", wins: 0, losses: 0, rank: 9, baseRank: 9, active: true },
    { id: "abed", name: "Abed", wins: 0, losses: 0, rank: 10, baseRank: 10, active: true }
  ];

  const DEFAULT_EVENTS = [
    {
      id: "opening-card",
      title: "Opening Ranking Card",
      type: "1v1",
      date: "2026-05-12",
      status: "approved",
      createdAt: "2026-05-05T00:00:00.000Z"
    }
  ];

  const page = document.body.dataset.page;

  const state = {
    fighters: [],
    fights: [],
    events: [],
    suggestions: [],
    rankings: [],
    firebase: null,
    db: null,
    auth: null,
    isFirebase: false,
    isAdmin: sessionStorage.getItem("sfc-admin") === "true"
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    bootFirebase();
    await loadData();
    render();
    bindPageForms();
    setConnectionStatus();
  }

  function bootFirebase() {
    const cfg = window.SFC_FIREBASE_CONFIG || {};
    const configured = cfg.apiKey && cfg.projectId && window.firebase;

    if (!configured) return;

    const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(cfg);

    state.firebase = app;
    state.db = firebase.firestore();
    state.auth = firebase.auth();
    state.isFirebase = true;
  }

  async function loadData() {
    if (state.isFirebase) {
      await loadFirestore();
    } else {
      await loadLocal();
    }

    enforceOfficialRoster();
    state.rankings = calculateRankings(state.fighters, state.fights);
  }

  async function loadFirestore() {
    const [fighters, fights, events, suggestions] = await Promise.all([
      readCollection("fighters"),
      readCollection("fights"),
      readCollection("events"),
      readCollection("suggestions")
    ]);

    state.fighters = fighters.length ? fighters : OFFICIAL_FIGHTERS;
    state.fights = fights;
    state.events = events.length ? events : DEFAULT_EVENTS;
    state.suggestions = suggestions;

    subscribeFirestore();
  }

  function subscribeFirestore() {
    ["fighters", "fights", "events", "suggestions"].forEach((name) => {
      state.db.collection(name).onSnapshot((snap) => {
        state[name] = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

        if (!state.fighters.length) state.fighters = OFFICIAL_FIGHTERS;
        if (!state.events.length) state.events = DEFAULT_EVENTS;

        enforceOfficialRoster();
        state.rankings = calculateRankings(state.fighters, state.fights);
        render();
      });
    });
  }

  async function readCollection(name) {
    const snap = await state.db.collection(name).get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async function loadLocal() {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");

    if (saved) {
      state.fighters = saved.fighters || OFFICIAL_FIGHTERS;
      state.fights = saved.fights || [];
      state.events = saved.events || DEFAULT_EVENTS;
      state.suggestions = saved.suggestions || [];
      return;
    }

    const [fighters, fights, events, suggestions] = await Promise.all([
      fetchJson("data/fighters.json"),
      fetchJson("data/fights.json"),
      fetchJson("data/events.json"),
      fetchJson("data/suggestions.json")
    ]);

    state.fighters = fighters.length ? fighters : OFFICIAL_FIGHTERS;
    state.fights = fights.length ? fights : [];
    state.events = events.length ? events : DEFAULT_EVENTS;
    state.suggestions = suggestions.length ? suggestions : [];

    persistLocal();
  }

  async function fetchJson(path) {
    try {
      const res = await fetch(path);
      if (!res.ok) throw new Error(path);
      return await res.json();
    } catch (error) {
      return [];
    }
  }

  function persistLocal() {
    if (state.isFirebase) return;

    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      fighters: state.fighters,
      fights: state.fights,
      events: state.events,
      suggestions: state.suggestions
    }));
  }

  function enforceOfficialRoster() {
    const byName = new Map(state.fighters.map((fighter) => [fighter.name, fighter]));

    state.fighters = OFFICIAL_FIGHTERS.map((official) => ({
      ...official,
      ...(byName.get(official.name) || {}),
      name: official.name,
      id: official.id,
      baseRank: official.baseRank,
      active: true
    }));
  }

  function calculateRankings(fighters, fights) {
    const stats = fighters.map((fighter) => ({
      ...fighter,
      wins: 0,
      losses: 0,
      rank: fighter.baseRank || 99
    }));

    const byName = new Map(stats.map((fighter) => [fighter.name, fighter]));
    const validFights = fights.filter((fight) => fight.status === "valid");

    validFights.forEach((fight) => {
      const f1 = byName.get(fight.fighter1);
      const f2 = byName.get(fight.fighter2);
      const winner = byName.get(fight.winner);

      if (!f1 || !f2 || !winner || fight.fighter1 === fight.fighter2) return;

      const loser = fight.winner === fight.fighter1 ? f2 : f1;

      winner.wins += 1;
      loser.losses += 1;
    });

    const kinanDefeated = validFights.some((fight) => {
      const kinanWasInFight = fight.fighter1 === "Kinan" || fight.fighter2 === "Kinan";
      return kinanWasInFight && fight.winner !== "Kinan";
    });

    const sorted = stats.sort(compareFighters);

    const finalList = kinanDefeated
      ? sorted
      : [
          stats.find((fighter) => fighter.name === "Kinan"),
          ...sorted.filter((fighter) => fighter.name !== "Kinan")
        ];

    return finalList.filter(Boolean).map((fighter, index) => ({
      ...fighter,
      rank: index + 1
    }));
  }

  function compareFighters(a, b) {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (a.losses !== b.losses) return a.losses - b.losses;
    return (a.baseRank || 99) - (b.baseRank || 99);
  }

  function render() {
    state.rankings = calculateRankings(state.fighters, state.fights);

    renderLeaderboard();
    renderFighters();
    renderEvents();
    renderAdmin();
    renderRecentFights();
    renderHomeStats();
  }

  function renderHomeStats() {
    text("totalFighters", state.fighters.length);
    text("validFightCount", state.fights.filter((fight) => fight.status === "valid").length);
    text("ignoredFightCount", state.fights.filter((fight) => fight.status !== "valid").length);
  }

  function renderLeaderboard() {
    const target = document.getElementById("leaderboard");
    if (!target) return;

    target.innerHTML = state.rankings.map((fighter) => {
      const lastFight = getFighterHistory(fighter.name)[0];

      return `
        <article class="leader-row" data-fighter="${escapeAttr(fighter.name)}" style="cursor:pointer">
          <div class="rank">#${fighter.rank}</div>

          <div>
            <h2>${escapeHtml(fighter.name)}</h2>
            <p class="meta">
              ${fighter.name === "Kinan" ? "Champion lock active until valid defeat" : "Official contender"}
            </p>
            <p class="meta">
              Last result: ${lastFight ? getFightResultText(fighter.name, lastFight) : "No fights yet"}
            </p>
          </div>

          <div class="record"><strong>${fighter.wins}</strong> W</div>
          <div class="record"><strong>${fighter.losses}</strong> L</div>
        </article>
      `;
    }).join("");

    ensureHistoryPanel(target);
  }

  function ensureHistoryPanel(leaderboard) {
    let panel = document.getElementById("fighterHistoryPanel");

    if (!panel) {
      panel = document.createElement("section");
      panel.id = "fighterHistoryPanel";
      panel.className = "panel";
      panel.style.marginTop = "18px";
      panel.innerHTML = `
        <div class="section-head">
          <div>
            <p class="eyebrow">Fighter history</p>
            <h2>Select a fighter</h2>
          </div>
        </div>
        <p class="meta">Click any fighter on the leaderboard to view their fight history.</p>
      `;

      leaderboard.parentElement.appendChild(panel);
    }
  }

  function renderFighterHistory(name) {
    const panel = document.getElementById("fighterHistoryPanel");
    if (!panel) return;

    const fighter = state.rankings.find((item) => item.name === name);
    const history = getFighterHistory(name);

    panel.innerHTML = `
      <div class="section-head">
        <div>
          <p class="eyebrow">Fighter history</p>
          <h2>${escapeHtml(name)}</h2>
        </div>
        <span class="badge">#${fighter ? fighter.rank : "?"}</span>
      </div>

      <p class="meta">
        Record: ${fighter ? fighter.wins : 0} wins / ${fighter ? fighter.losses : 0} losses
      </p>

      <div class="fight-list">
        ${
          history.length
            ? history.map((fight) => fighterHistoryCard(name, fight)).join("")
            : empty("This fighter has no fight history yet.")
        }
      </div>
    `;
  }

  function fighterHistoryCard(name, fight) {
    return `
      <article class="fight-item">
        <div class="item-top">
          <strong>${escapeHtml(fight.fighter1)} vs ${escapeHtml(fight.fighter2)}</strong>
          <span class="badge ${classForStatus(fight.status)}">${labelStatus(fight.status)}</span>
        </div>

        <p class="meta">${getFightResultText(name, fight)}</p>
        <p class="meta">Type: ${escapeHtml(fight.type || "1v1")} / ${formatDateTime(fight.timestamp)}</p>

        ${fight.comment ? `<p class="meta">Comment: ${escapeHtml(fight.comment)}</p>` : ""}
        ${fight.reason ? `<p class="meta">Reason: ${escapeHtml(fight.reason)}</p>` : ""}
      </article>
    `;
  }

  function getFighterHistory(name) {
    return state.fights
      .filter((fight) => fight.fighter1 === name || fight.fighter2 === name)
      .sort(newestFirst);
  }

  function getFightResultText(name, fight) {
    const opponent = fight.fighter1 === name ? fight.fighter2 : fight.fighter1;

    if (fight.status === "no-contest") {
      return `No Contest vs ${opponent}`;
    }

    if (fight.status === "reversed") {
      return `Reversed fight vs ${opponent}`;
    }

    if (fight.winner === name) {
      return `Win vs ${opponent}`;
    }

    return `Loss vs ${opponent}`;
  }

  function renderFighters() {
    const publicGrid = document.getElementById("fighterGrid");
    const adminGrid = document.getElementById("adminFighterGrid");

    if (publicGrid) {
      publicGrid.innerHTML = state.rankings.map((fighter) => fighterCard(fighter)).join("");
    }

    if (adminGrid) {
      adminGrid.innerHTML = state.rankings.map((fighter) => fighterCard(fighter, true)).join("");
    }

    populateFightDropdowns();
  }

  function fighterCard(fighter, admin = false) {
    const lastFight = getFighterHistory(fighter.name)[0];

    return `
      <article class="fighter-card" data-fighter="${escapeAttr(fighter.name)}" style="cursor:pointer">
        <div class="rank">#${fighter.rank}</div>
        <h2>${escapeHtml(fighter.name)}</h2>
        <p class="meta">${fighter.wins} wins / ${fighter.losses} losses</p>
        <p class="meta">Last result: ${lastFight ? getFightResultText(fighter.name, lastFight) : "No fights yet"}</p>
        ${admin ? `<p class="meta">Stats are recalculated from valid fight results.</p>` : ""}
      </article>
    `;
  }

  function renderEvents() {
    const approved = state.events
      .filter((event) => event.status !== "pending")
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));

    const eventHtml = approved.map(eventCard).join("") || empty("No approved events yet.");

    const eventList = document.getElementById("eventList");
    const upcomingEvents = document.getElementById("upcomingEvents");

    if (eventList) eventList.innerHTML = eventHtml;
    if (upcomingEvents) {
      upcomingEvents.innerHTML = approved.slice(0, 3).map(eventCard).join("") || empty("No upcoming events.");
    }
  }

  function renderAdmin() {
    if (page !== "admin") return;

    document.getElementById("loginPanel").classList.toggle("hidden", state.isAdmin);
    document.getElementById("adminPanel").classList.toggle("hidden", !state.isAdmin);
    document.getElementById("logoutButton").classList.toggle("hidden", !state.isAdmin);

    if (!state.isAdmin) return;

    const fightDashboard = document.getElementById("fightDashboard");

    fightDashboard.innerHTML = state.fights
      .slice()
      .sort(newestFirst)
      .map(fightManageCard)
      .join("") || empty("No fights logged.");

    document.getElementById("suggestionDashboard").innerHTML = state.suggestions
      .filter((item) => item.status === "pending")
      .map(suggestionCard)
      .join("") || empty("No pending suggestions.");

    document.getElementById("eventDashboard").innerHTML = state.events
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .map((event) => eventCard(event, true))
      .join("") || empty("No events created.");
  }

  function renderRecentFights() {
    const target = document.getElementById("recentFights");
    if (!target) return;

    target.innerHTML = state.fights
      .slice()
      .sort(newestFirst)
      .slice(0, 5)
      .map(fightCard)
      .join("") || empty("No fights logged yet.");
  }

  function fightCard(fight) {
    return `
      <article class="fight-item">
        <div class="item-top">
          <strong>${escapeHtml(fight.fighter1)} vs ${escapeHtml(fight.fighter2)}</strong>
          <span class="badge ${classForStatus(fight.status)}">${labelStatus(fight.status)}</span>
        </div>

        <div class="meta">
          Winner: ${escapeHtml(fight.winner || "None")} / ${escapeHtml(fight.type || "1v1")} / ${formatDateTime(fight.timestamp)}
        </div>

        ${fight.comment ? `<p class="meta">Comment: ${escapeHtml(fight.comment)}</p>` : ""}
        ${fight.reason ? `<div class="meta">Reason: ${escapeHtml(fight.reason)}</div>` : ""}
      </article>
    `;
  }

  function fightManageCard(fight) {
    return `
      <article class="fight-item">
        <div class="item-top">
          <div>
            <strong>${escapeHtml(fight.fighter1)} vs ${escapeHtml(fight.fighter2)}</strong>
            <p class="meta">Winner: ${escapeHtml(fight.winner || "None")} / ${formatDateTime(fight.timestamp)}</p>
          </div>
          <span class="badge ${classForStatus(fight.status)}">${labelStatus(fight.status)}</span>
        </div>

        ${fight.comment ? `<p class="meta">Comment: ${escapeHtml(fight.comment)}</p>` : ""}
        ${fight.reason ? `<p class="meta">Reason: ${escapeHtml(fight.reason)}</p>` : ""}

        <div class="actions">
          <button class="button warn" data-action="no-contest" data-id="${fight.id}">Mark No Contest</button>
          <button class="button warn" data-action="reverse-fight" data-id="${fight.id}">Reverse Fight</button>
          <button class="button danger" data-action="delete-fight" data-id="${fight.id}">Delete Fight</button>
        </div>
      </article>
    `;
  }

  function eventCard(event, admin = false) {
    return `
      <article class="event-item">
        <div class="item-top">
          <div>
            <strong>${escapeHtml(event.title)}</strong>
            <p class="meta">${escapeHtml(event.type)} / ${escapeHtml(event.date || "No date")}</p>
          </div>
          <span class="badge">${escapeHtml(event.status || "approved")}</span>
        </div>

        ${admin ? `<div class="actions"><button class="button danger" data-action="delete-event" data-id="${event.id}">Delete event</button></div>` : ""}
      </article>
    `;
  }

  function suggestionCard(item) {
    return `
      <article class="event-item">
        <div class="item-top">
          <div>
            <strong>${escapeHtml(item.title)}</strong>
            <p class="meta">${escapeHtml(item.type)} / ${escapeHtml(item.date || "No date")}</p>
          </div>
        </div>

        <div class="actions">
          <button class="button primary" data-action="approve-suggestion" data-id="${item.id}">Approve</button>
          <button class="button danger" data-action="reject-suggestion" data-id="${item.id}">Reject</button>
        </div>
      </article>
    `;
  }

  function bindPageForms() {
    renderRecentFights();

    document.getElementById("adminLoginForm")?.addEventListener("submit", handleLogin);
    document.getElementById("logoutButton")?.addEventListener("click", handleLogout);
    document.getElementById("fightForm")?.addEventListener("submit", handleFightSubmit);
    document.getElementById("eventForm")?.addEventListener("submit", handleEventSubmit);
    document.getElementById("suggestForm")?.addEventListener("submit", handleSuggestionSubmit);

    document.body.addEventListener("click", handleActionClick);
  }

  async function handleLogin(event) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const identity = String(form.get("identity") || "").trim();
    const password = String(form.get("password") || "").trim();

    try {
      if (!state.isFirebase && identity === ADMIN_PASSWORD) {
        state.isAdmin = true;
      } else if (state.isFirebase && identity.includes("@") && password) {
        await state.auth.signInWithEmailAndPassword(identity, password);

        const token = await state.auth.currentUser.getIdTokenResult(true);
        state.isAdmin = token.claims.admin === true;

        if (!state.isAdmin) throw new Error("This Firebase user is not an admin.");
      } else {
        throw new Error(
          state.isFirebase
            ? "Use a Firebase account with the admin custom claim."
            : "Use the temporary local password admin123."
        );
      }

      sessionStorage.setItem("sfc-admin", "true");
      message("loginMessage", "Admin controls unlocked.");
      render();
    } catch (error) {
      state.isAdmin = false;
      sessionStorage.removeItem("sfc-admin");
      message("loginMessage", error.message);
    }
  }

  function handleLogout() {
    state.isAdmin = false;
    sessionStorage.removeItem("sfc-admin");
    state.auth?.signOut();
    render();
  }

  async function handleFightSubmit(event) {
    event.preventDefault();

    if (!requireAdmin()) return;

    const form = new FormData(event.currentTarget);

    const fight = {
      id: crypto.randomUUID(),
      fighter1: form.get("fighter1"),
      fighter2: form.get("fighter2"),
      winner: form.get("winner"),
      type: form.get("type"),
      status: "valid",
      reason: "",
      comment: clean(form.get("comment")),
      timestamp: new Date().toISOString()
    };

    if (fight.fighter1 === fight.fighter2) {
      return message("fightMessage", "Choose two different fighters.");
    }

    if (![fight.fighter1, fight.fighter2].includes(fight.winner)) {
      return message("fightMessage", "Winner must be one of the selected fighters.");
    }

    await saveDoc("fights", fight);

    message("fightMessage", "Fight logged and rankings recalculated.");
    event.currentTarget.reset();
  }

  async function handleEventSubmit(event) {
    event.preventDefault();

    if (!requireAdmin()) return;

    const form = new FormData(event.currentTarget);

    const item = {
      id: crypto.randomUUID(),
      title: clean(form.get("title")),
      type: form.get("type"),
      date: form.get("date"),
      status: "approved",
      createdAt: new Date().toISOString()
    };

    await saveDoc("events", item);

    message("eventMessage", "Event created.");
    event.currentTarget.reset();
  }

  async function handleSuggestionSubmit(event) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);

    const item = {
      id: crypto.randomUUID(),
      title: clean(form.get("title")),
      type: form.get("type"),
      date: form.get("date"),
      status: "pending",
      createdAt: new Date().toISOString()
    };

    await saveDoc("suggestions", item, true);

    message("suggestMessage", "Suggestion submitted for admin approval.");
    event.currentTarget.reset();
  }

  async function handleActionClick(event) {
    const fighterCard = event.target.closest("[data-fighter]");

    if (fighterCard && !event.target.closest("button")) {
      renderFighterHistory(fighterCard.dataset.fighter);
      return;
    }

    const button = event.target.closest("[data-action]");
    if (!button) return;

    const action = button.dataset.action;
    const id = button.dataset.id;

    if (!state.isAdmin) return;

    if (action === "no-contest") {
      const reason = prompt("No Contest reason:");
      if (!reason) return;

      await updateDoc("fights", id, {
        status: "no-contest",
        reason: clean(reason)
      });
    }

    if (action === "reverse-fight") {
      const reason = prompt("Reversal reason:");
      if (!reason) return;

      await updateDoc("fights", id, {
        status: "reversed",
        reason: clean(reason)
      });
    }

    if (action === "delete-fight") {
      if (confirm("Delete this fight permanently?")) {
        await deleteDoc("fights", id);
      }
    }

    if (action === "delete-event") {
      if (confirm("Delete this event?")) {
        await deleteDoc("events", id);
      }
    }

    if (action === "approve-suggestion") {
      const suggestion = state.suggestions.find((item) => item.id === id);
      if (!suggestion) return;

      await saveDoc("events", {
        ...suggestion,
        id: crypto.randomUUID(),
        status: "approved",
        approvedAt: new Date().toISOString()
      });

      await updateDoc("suggestions", id, { status: "approved" });
    }

    if (action === "reject-suggestion") {
      await updateDoc("suggestions", id, { status: "rejected" });
    }
  }

  async function saveDoc(collection, doc, publicWrite = false) {
    if (!publicWrite && !requireAdmin()) return;

    if (state.isFirebase) {
      await state.db.collection(collection).doc(doc.id).set(doc);
    } else {
      state[collection].push(doc);
      persistLocal();
      render();
    }
  }

  async function updateDoc(collection, id, patch) {
    if (!requireAdmin()) return;

    if (state.isFirebase) {
      await state.db.collection(collection).doc(id).update(patch);
    } else {
      state[collection] = state[collection].map((item) => {
        return item.id === id ? { ...item, ...patch } : item;
      });

      persistLocal();
      render();
    }
  }

  async function deleteDoc(collection, id) {
    if (!requireAdmin()) return;

    if (state.isFirebase) {
      await state.db.collection(collection).doc(id).delete();
    } else {
      state[collection] = state[collection].filter((item) => item.id !== id);
      persistLocal();
      render();
    }
  }

  function populateFightDropdowns() {
    const form = document.getElementById("fightForm");
    if (!form) return;

    const options = state.rankings.map((fighter) => {
      return `<option value="${escapeAttr(fighter.name)}">${escapeHtml(fighter.name)}</option>`;
    }).join("");

    ["fighter1", "fighter2", "winner"].forEach((name) => {
      const select = form.elements[name];
      const current = select.value;

      select.innerHTML = options;
      select.value = current || select.value;
    });
  }

  function requireAdmin() {
    if (state.isAdmin) return true;

    alert("Admin login required.");
    return false;
  }

  function setConnectionStatus() {
    const label = state.isFirebase ? "Firestore live" : "Local storage mode";

    document.querySelectorAll("#connectionStatus").forEach((el) => {
      el.textContent = label;
    });
  }

  function newestFirst(a, b) {
    return String(b.timestamp || b.createdAt || "").localeCompare(String(a.timestamp || a.createdAt || ""));
  }

  function clean(value) {
    return String(value || "").trim().slice(0, 200);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char]));
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, "&#96;");
  }

  function formatDateTime(value) {
    if (!value) return "No timestamp";

    return new Date(value).toLocaleString([], {
      dateStyle: "medium",
      timeStyle: "short"
    });
  }

  function labelStatus(status) {
    if (status === "no-contest") return "No Contest";
    if (status === "reversed") return "Reversed";
    return "Valid";
  }

  function classForStatus(status) {
    if (status === "no-contest") return "no-contest";
    if (status === "reversed") return "reversed";
    return "valid";
  }

  function empty(label) {
    return `<p class="meta">${label}</p>`;
  }

  function text(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function message(id, value) {
    text(id, value);
  }
})();
