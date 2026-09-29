/* Triwon Work v2 — daily task manager
   Supabase (auth + Postgres + storage + realtime) · static hosting on Vercel */
(() => {
"use strict";

/* ================= config ================= */
const CFG = window.TRIWON_CONFIG || {};
const DOMAIN = CFG.EMAIL_DOMAIN || "triwon.app";
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_EXT = ["jpg","jpeg","png","webp","gif","heic","pdf","zip","rar","7z","doc","docx","xls","xlsx","ppt","pptx","csv","txt","md","fig","psd","ai","mp4","mov","mp3"];
const POINTS = { done: 10, onTime: 5, high: 5, medium: 2, proofFile: 3 };

const LINES = [
  "Small tasks, done well and on time, add up to a big month.",
  "Start with the task you're avoiding. Everything after it feels lighter.",
  "Progress beats perfection. Ship the next step.",
  "One focused hour is worth three distracted ones.",
  "Your work today is the proof of what you'll be trusted with tomorrow.",
  "Clear the list, then raise the bar.",
  "Discipline is choosing what you want most over what you want now.",
  "Done is a habit. Build it one task at a time.",
  "Make the first call before you check the first notification.",
  "The best follow-up is the one you send today.",
  "Quality is doing it right when nobody is checking. Attach the proof anyway.",
  "Win the morning and the afternoon takes care of itself.",
  "A good day is planned the night before and finished before the deadline.",
  "Don't count the hours. Make the hours count.",
  "Consistency beats intensity. Show up again today.",
  "Every lead you call is a door you gave a chance to open.",
  "Break it small, then finish it fast.",
  "Your streak is a promise to yourself. Keep it.",
  "Results love routine.",
  "Be the teammate who closes loops.",
  "Energy flows where focus goes.",
  "Finish strong. The last 10% is where good work becomes great work.",
  "Busy is easy. Productive is a choice.",
  "Today's effort is tomorrow's advantage.",
  "Say less, ship more.",
  "Aim to be the one others race to catch.",
  "Hard work compounds. So does skipping it.",
  "The task list is short when the excuses are.",
  "Deep work first, messages later.",
  "Leave today better than you found it.",
];

/* ================= helpers ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const pad = n => String(n).padStart(2, "0");
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => ymd(new Date());
const addDays = (s, n) => { const d = new Date(s + "T00:00"); d.setDate(d.getDate() + n); return ymd(d); };
const parseDay = s => new Date(s + "T00:00");
const weekStart = () => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); };
const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
function dayLabel(s, long = false) {
  const t = today();
  if (s === t) return "Today";
  if (s === addDays(t, 1)) return "Tomorrow";
  if (s === addDays(t, -1)) return "Yesterday";
  return parseDay(s).toLocaleDateString(undefined, long ? { weekday: "long", day: "numeric", month: "long" } : { weekday: "short", day: "numeric", month: "short" });
}
const fullDate = s => parseDay(s).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
const shortDate = s => parseDay(s).toLocaleDateString(undefined, { day: "numeric", month: "short" });
const fmtTime = hm => { if (!hm) return ""; const [h, m] = hm.split(":").map(Number); const d = new Date(); d.setHours(h, m); return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); };
function fmtDur(ms) {
  const m = Math.round(Math.abs(ms) / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${pad(m % 60)}m`;
  const d = Math.floor(h / 24); return `${d}d ${h % 24}h`;
}
function fmtSecs(s, live = false) {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (live) return `${h}:${pad(m)}:${pad(sec)}`;
  if (h) return `${h}h ${pad(m)}m`;
  return `${m}m`;
}
const fmtSize = b => b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1048576).toFixed(1)} MB`;
const initials = n => (n || "?").trim().split(/\s+/).map(x => x[0]).slice(0, 2).join("").toUpperCase();
const ext = n => (n.split(".").pop() || "").toLowerCase();
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

const I = {
  check: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  home: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg>',
  team: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M21.5 20a6.5 6.5 0 0 0-4-6"/></svg>',
  trophy: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>',
  repeat: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>',
  chart: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 15v2M12 10v7M17 6v11"/></svg>',
  clock: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  clip: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.4 11.6-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/></svg>',
  chat: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z"/></svg>',
  play: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>',
  pause: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4.5" width="4" height="15" rx="1"/><rect x="14" y="4.5" width="4" height="15" rx="1"/></svg>',
  plus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  x: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  lock: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  flame: '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2s5 4.5 5 10a5 5 0 0 1-10 0c0-2.2 1.2-3.8 2-4.6 0 2 1 3.1 2 3.1 0-3.5 1-6.5 1-8.5z"/></svg>',
  left: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
  right: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
  out: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>',
  key: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.8-9.8M17 6l3 3"/></svg>',
};

/* ================= state ================= */
const S = {
  me: null, profiles: [], byId: {},
  tasks: new Map(), routines: [],
  view: "today", teamDate: today(), memberId: null,
  openTask: null, comments: [], urlCache: {},
  reportDays: 7, notified: new Set(), loaded: false,
};
let sb = null;

const isAdmin = () => S.me?.role === "admin";
const members = () => S.profiles.filter(p => p.role === "member");
const person = id => S.byId[id] || { full_name: "Unknown", color: "#98A2B3" };
const canWork = t => isAdmin() || t.assignee === S.me.id;
const canEditDetails = t => isAdmin() || (t.created_by === S.me.id && t.assignee === S.me.id);
const canEditRoutine = r => isAdmin() || (r.assignee === S.me.id && r.created_by === S.me.id);
const startOf = t => t.start_date || t.due_date;
const activeOn = (t, d) => startOf(t) <= d && t.due_date >= d;
const dueAt = t => new Date(`${t.due_date}T${t.due_time || "23:59"}`);
function stateOf(t) {
  if (t.progress >= 100) return "done";
  if (dueAt(t) < new Date()) return "late";
  if (t.progress > 0 || t.timer_started_at) return "active";
  return "todo";
}
const STATE_LABEL = { done: "Done", late: "Not done", active: "In progress", todo: "To do" };
const liveSpent = t => (t.time_spent || 0) + (t.timer_started_at ? (Date.now() - new Date(t.timer_started_at)) / 1000 : 0);
const proofCount = t => (t.proofs || []).length;
const commentCount = t => t.comments?.[0]?.count || 0;
const sortTasks = arr => arr.sort((a, b) => {
  const o = { late: 0, active: 1, todo: 2, done: 3 };
  return o[stateOf(a)] - o[stateOf(b)] || a.due_date.localeCompare(b.due_date) || (a.due_time || "").localeCompare(b.due_time || "") || ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority]);
});
const tasksWhere = fn => sortTasks([...S.tasks.values()].filter(fn));

/* ================= ui primitives ================= */
let toastT;
function toast(msg, bad = false) {
  const el = $("#toast"); el.textContent = msg; el.classList.toggle("bad", bad); el.classList.add("show");
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("show"), bad ? 4200 : 2600);
}
function openSheet(html) { $("#sheet").innerHTML = html; $("#scrim").classList.add("open"); document.body.style.overflow = "hidden"; }
function closeSheet() { $("#scrim").classList.remove("open"); S.openTask = null; document.body.style.overflow = ""; }
$("#scrim").addEventListener("mousedown", e => { if (e.target.id === "scrim") closeSheet(); });
$("#lightbox").addEventListener("click", () => $("#lightbox").classList.remove("open"));
document.addEventListener("keydown", e => {
  if (e.key === "Escape") { if ($("#lightbox").classList.contains("open")) $("#lightbox").classList.remove("open"); else closeSheet(); }
  if (e.key === "n" && S.me && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !$("#scrim").classList.contains("open")) { e.preventDefault(); openTaskForm(); }
});
const av = (p, cls = "") => `<span class="av ${cls}" style="--mc:${esc(p.color)}">${esc(initials(p.full_name))}</span>`;

function greeting(name) {
  const h = new Date().getHours();
  const g = h < 5 ? "Working late" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : h < 21 ? "Good evening" : "Good night";
  return name ? `${g}, ${name.split(" ")[0]}` : g;
}
function lineOfDay() {
  const d = new Date(); const start = new Date(d.getFullYear(), 0, 0);
  const doy = Math.floor((d - start) / 86400000);
  return LINES[doy % LINES.length];
}

/* ================= boot & auth ================= */
function renderSetupNeeded() {
  $("#app").innerHTML = `<div class="setup"><h2>Almost there</h2><p>Add your Supabase Project URL and anon key to <b>config.js</b>, then redeploy.</p><p class="hint">See README.md for the full steps.</p></div>`;
}
async function boot() {
  if (!CFG.SUPABASE_URL || CFG.SUPABASE_URL.includes("YOUR-") || !window.supabase) return renderSetupNeeded();
  sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
  const { data: { session } } = await sb.auth.getSession();
  sb.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_OUT") { S.me = null; renderLogin(); } });
  if (session) start(); else renderLogin();
}

function renderLogin(msg = "") {
  $("#app").innerHTML = `
  <div class="login">
    <div class="art">
      <div class="logo"><span class="mark">T</span>Triwon</div>
      <div><h1>Plan the day. Prove the work.</h1><p>Daily tasks, routines, time tracking and a friendly race for Bhavya, Dhruv and Parth.</p></div>
      <div class="q">${esc(lineOfDay())}</div>
    </div>
    <div class="panel">
      <form id="loginForm" autocomplete="on">
        <h2>${esc(greeting(""))}</h2>
        <p>Sign in with the username and password your admin gave you.</p>
        <label class="field"><span>Username</span><input class="input" name="u" autocomplete="username" autocapitalize="none" required placeholder="e.g. dhruv"></label>
        <label class="field"><span>Password</span><input class="input" name="p" type="password" autocomplete="current-password" required></label>
        <div class="err" id="loginErr">${esc(msg)}</div>
        <button class="btn primary" style="width:100%;height:42px" id="loginBtn">Sign in</button>
      </form>
    </div>
  </div>`;
  $("#loginForm").onsubmit = async e => {
    e.preventDefault();
    const f = e.target, u = f.u.value.trim().toLowerCase();
    const email = u.includes("@") ? u : `${u}@${DOMAIN}`;
    $("#loginBtn").disabled = true; $("#loginErr").textContent = "";
    const { error } = await sb.auth.signInWithPassword({ email, password: f.p.value });
    $("#loginBtn").disabled = false;
    if (error) { $("#loginErr").textContent = error.message.includes("Invalid") ? "Wrong username or password." : error.message; return; }
    start();
  };
}

async function start() {
  $("#app").innerHTML = `<div class="loading">Loading your workspace…</div>`;
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return renderLogin();
  const { data: profs, error } = await sb.from("profiles").select("*").order("full_name");
  if (error) return renderLogin("Couldn't load your team. Check the database setup.");
  S.profiles = profs; S.byId = Object.fromEntries(profs.map(p => [p.id, p]));
  S.me = S.byId[user.id];
  if (!S.me) { await sb.auth.signOut(); return renderLogin("Your account has no profile yet. Ask your admin to run setup-team.sql."); }
  S.view = isAdmin() ? "team" : "today";
  await sb.rpc("generate_routine_tasks", { from_date: today(), to_date: addDays(today(), 7) });
  await Promise.all([loadTasks(), loadRoutines()]);
  S.loaded = true;
  renderShell();
  subscribeRealtime();
  setInterval(tick, 1000);
  setInterval(minuteTick, 60000);
  if (!isAdmin() && "Notification" in window && Notification.permission === "default") setTimeout(() => Notification.requestPermission().catch(() => {}), 4000);
}

/* ================= data ================= */
const SEL = "*, proofs(*), comments(count)";
async function loadTasks() {
  const from = addDays(today(), -21), to = addDays(today(), 30);
  const [a, b] = await Promise.all([
    sb.from("tasks").select(SEL).gte("due_date", from).lte("due_date", to).order("due_date").limit(3000),
    sb.from("tasks").select(SEL).lt("due_date", from).lt("progress", 100).limit(300),
  ]);
  if (a.error) { toast("Couldn't load tasks: " + a.error.message, true); return; }
  const m = new Map();
  for (const t of [...a.data, ...(b.data || [])]) m.set(t.id, t);
  // keep extra days fetched for the team view
  for (const t of S.tasks.values()) if (!m.has(t.id) && (t.due_date < from || t.due_date > to)) m.set(t.id, t);
  S.tasks = m;
}
async function loadDay(date) {
  const { data } = await sb.from("tasks").select(SEL).lte("start_date", date).gte("due_date", date);
  (data || []).forEach(t => S.tasks.set(t.id, t));
}
async function loadRoutines() {
  const { data } = await sb.from("routines").select("*").order("created_at");
  S.routines = data || [];
}
async function loadComments(taskId) {
  const { data } = await sb.from("comments").select("*").eq("task_id", taskId).order("created_at");
  S.comments = data || [];
}

const refresh = debounce(async () => {
  await Promise.all([loadTasks(), loadRoutines()]);
  if (S.view === "team" && !S.tasks.size) await loadDay(S.teamDate);
  safeRender();
  if (S.openTask) { await loadComments(S.openTask); safeRenderTaskSheet(); }
}, 350);

function subscribeRealtime() {
  sb.channel("triwon-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, refresh)
    .on("postgres_changes", { event: "*", schema: "public", table: "proofs" }, refresh)
    .on("postgres_changes", { event: "*", schema: "public", table: "comments" }, refresh)
    .on("postgres_changes", { event: "*", schema: "public", table: "routines" }, refresh)
    .subscribe();
}

async function updateTask(id, patch, okMsg) {
  const t = S.tasks.get(id); if (!t) return false;
  const before = { ...t };
  Object.assign(t, patch); safeRender(); safeRenderTaskSheet(true);
  const { error } = await sb.from("tasks").update(patch).eq("id", id);
  if (error) {
    S.tasks.set(id, before); safeRender(); safeRenderTaskSheet(true);
    toast(cleanErr(error), true); return false;
  }
  if (okMsg) toast(okMsg);
  return true;
}
const cleanErr = e => (e?.message || "Something went wrong").replace(/^.*?:\s(?=[A-Z])/, "");

/* ================= rendering: shell ================= */
function navItems() {
  const lateMine = tasksWhere(t => t.assignee === S.me.id && stateOf(t) === "late").length;
  const items = [
    { v: "today", l: isAdmin() ? "My planner" : "My day", i: I.home, b: lateMine },
    { v: "team", l: "Team", i: I.team },
    { v: "race", l: "Race", i: I.trophy },
    { v: "routines", l: "Routines", i: I.repeat },
  ];
  if (isAdmin()) items.push({ v: "reports", l: "Reports", i: I.chart });
  return items;
}
function renderShell() {
  const nav = navItems().map(n => `<button data-nav="${n.v}" class="${S.view === n.v || (n.v === "team" && S.view === "member") ? "on" : ""}">${n.i}<span>${n.l}</span>${n.b ? `<span class="badge">${n.b}</span>` : ""}</button>`).join("");
  $("#app").innerHTML = `
  <div class="shell">
    <aside class="side">
      <div class="logo"><span class="mark">T</span>Triwon</div>
      <nav class="nav">${nav}</nav>
      <div class="me">${av(S.me)}<div class="who"><b>${esc(S.me.full_name)}</b><small>${esc(S.me.role)}</small></div>
        <button class="btn ghost icon" data-act="password" title="Change password" aria-label="Change password">${I.key}</button>
        <button class="btn ghost icon" data-act="logout" title="Sign out" aria-label="Sign out">${I.out}</button></div>
    </aside>
    <main class="main"><div class="topbar"><div class="logo" style="padding:0"><span class="mark">T</span>Triwon</div>
      <div style="display:flex;gap:4px"><button class="btn ghost icon" data-act="password" aria-label="Change password">${I.key}</button><button class="btn ghost icon" data-act="logout" aria-label="Sign out">${I.out}</button></div></div>
      <div id="view"></div></main>
    <nav class="tabbar">${nav}</nav>
  </div>
  <button class="fab" data-act="new" aria-label="Add task">${I.plus}</button>`;
  $$("[data-nav]").forEach(b => b.onclick = () => go(b.dataset.nav));
  $$("[data-act=logout]").forEach(b => b.onclick = () => sb.auth.signOut());
  $$("[data-act=password]").forEach(b => b.onclick = openPassword);
  $(".fab").onclick = () => S.view === "routines" ? openTaskForm({ repeat: "monsat" }) : openTaskForm({ assignee: S.view === "member" ? S.memberId : null, date: S.view === "team" ? S.teamDate : null });
  renderView();
}
function go(v, memberId) {
  S.view = v; if (memberId) S.memberId = memberId;
  renderShell(); window.scrollTo(0, 0);
}
function safeRender() {
  if (!S.loaded || !$("#view")) return;
  const a = document.activeElement;
  if (a && $("#view").contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) return;
  // update nav badges + view
  const y = window.scrollY; renderShell(); window.scrollTo(0, y);
}
function renderView() {
  const V = { today: viewToday, team: viewTeam, member: viewMember, race: viewRace, routines: viewRoutines, reports: viewReports };
  $("#view").innerHTML = (V[S.view] || viewToday)();
  bindView();
  if (S.view === "reports") loadReport();
}

/* ================= task row ================= */
function dueHTML(t) {
  const st = stateOf(t);
  if (st === "done") return t.done_at ? `<span class="it">Done ${new Date(t.done_at) <= dueAt(t) ? "on time" : "late"}</span>` : "";
  const diff = dueAt(t) - new Date();
  if (diff < 0) return `<span class="it late">${I.clock} Overdue ${fmtDur(diff)}</span>`;
  if (diff < 2 * 3600e3) return `<span class="it soon">${I.clock} Due in ${fmtDur(diff)}</span>`;
  const range = startOf(t) !== t.due_date ? `${shortDate(startOf(t))} → ${shortDate(t.due_date)}, ` : (t.due_date === today() ? "" : dayLabel(t.due_date) + ", ");
  return `<span class="it">${I.clock} ${range}${fmtTime(t.due_time)}</span>`;
}
function rowHTML(t, { who = true } = {}) {
  const p = person(t.assignee), st = stateOf(t), work = canWork(t);
  return `<div class="trow st-${st}" data-open="${t.id}" style="--mc:${esc(p.color)}" tabindex="0" role="button" aria-label="${esc(t.title)}">
    <button class="check ${st === "done" ? "on" : ""}" data-done="${t.id}" ${work ? "" : "disabled"} aria-label="${st === "done" ? "Reopen task" : "Mark done"}">${I.check}</button>
    <div class="tmain">
      <div class="ttitle"><span class="prio ${t.priority}" title="${t.priority} priority"></span>${esc(t.title)}${t.routine_id ? '<span class="tag">Daily</span>' : ""}</div>
      <div class="tmeta">
        ${who ? `<span class="it chip">${av(p, "sm")}${esc(p.full_name.split(" ")[0])}</span>` : ""}
        ${dueHTML(t)}
        ${t.timer_started_at ? `<span class="it run" data-live="${t.id}">${I.clock} ${fmtSecs(liveSpent(t), true)}</span>` : t.time_spent ? `<span class="it">${I.clock} ${fmtSecs(t.time_spent)} logged</span>` : ""}
        ${proofCount(t) ? `<span class="it">${I.clip} ${proofCount(t)}</span>` : ""}
        ${commentCount(t) ? `<span class="it">${I.chat} ${commentCount(t)}</span>` : ""}
        ${!work ? `<span class="it lock">${I.lock}</span>` : ""}
      </div>
    </div>
    <div class="tright"><div class="mini"><i style="width:${t.progress}%"></i></div><span class="pct">${t.progress}%</span></div>
  </div>`;
}
const listHTML = (arr, opts) => arr.length ? `<div class="list">${arr.map(t => rowHTML(t, opts)).join("")}</div>` : "";
function section(title, arr, opts = {}, cls = "") {
  if (!arr.length && !opts.showEmpty) return "";
  return `<div class="section"><div class="sechead ${cls}">${title}<span class="count">${arr.length}</span></div>${arr.length ? listHTML(arr, opts) : `<div class="empty">${opts.empty || "Nothing here."}</div>`}</div>`;
}
function groupedUpcoming(arr, opts) {
  const by = {}; arr.forEach(t => (by[startOf(t)] ||= []).push(t));
  return Object.keys(by).sort().map(d => section("Starts " + dayLabel(d).replace(/^(Today|Tomorrow|Yesterday)$/, m => m.toLowerCase()), by[d], opts)).join("");
}

/* ================= stats / race ================= */
function taskPoints(t) {
  if (t.progress < 100) return 0;
  let p = POINTS.done;
  if (t.done_at && new Date(t.done_at) <= dueAt(t)) p += POINTS.onTime;
  p += t.priority === "high" ? POINTS.high : t.priority === "medium" ? POINTS.medium : 0;
  if (proofCount(t)) p += POINTS.proofFile;
  return p;
}
function streakOf(uid) {
  let d = today(), n = 0;
  const dayTasks = day => [...S.tasks.values()].filter(t => t.assignee === uid && t.due_date === day);
  const todays = dayTasks(d);
  if (!todays.length || todays.some(t => t.progress < 100)) d = addDays(d, -1);
  for (let i = 0; i < 21; i++, d = addDays(d, -1)) {
    const ts = dayTasks(d);
    if (!ts.length) continue;           // days off don't break a streak
    if (ts.every(t => t.progress >= 100)) n++; else break;
  }
  return n;
}
function raceTable() {
  const ws = weekStart(), we = addDays(ws, 6);
  return members().map(p => {
    const wk = [...S.tasks.values()].filter(t => t.assignee === p.id && t.due_date >= ws && t.due_date <= we);
    const due = wk.filter(t => t.due_date <= today());
    const done = wk.filter(t => t.progress >= 100);
    const onTime = done.filter(t => t.done_at && new Date(t.done_at) <= dueAt(t)).length;
    const todayT = wk.filter(t => t.due_date === today());
    return {
      p, points: done.reduce((a, t) => a + taskPoints(t), 0), done: done.length, total: due.length,
      onTimePct: done.length ? Math.round(onTime / done.length * 100) : 0,
      streak: streakOf(p.id), secs: wk.reduce((a, t) => a + liveSpent(t), 0),
      todayDone: todayT.filter(t => t.progress >= 100).length, todayTotal: todayT.length,
    };
  }).sort((a, b) => b.points - a.points || b.done - a.done);
}

/* ================= views ================= */
function viewToday() {
  const t0 = today(), uid = S.me.id;
  const mine = [...S.tasks.values()].filter(t => t.assignee === uid);
  const overdue = sortTasks(mine.filter(t => t.due_date < t0 && t.progress < 100));
  const todays = sortTasks(mine.filter(t => activeOn(t, t0)));
  const upcoming = sortTasks(mine.filter(t => startOf(t) > t0 && startOf(t) <= addDays(t0, 14)));
  const doneToday = todays.filter(t => t.progress >= 100).length;
  const focus = todays.reduce((a, t) => a + liveSpent(t), 0);
  const race = raceTable(); const myIdx = race.findIndex(r => r.p.id === uid); const me = race[myIdx];
  let raceLine = "";
  if (me) {
    if (myIdx === 0 && me.points > 0) raceLine = `You're leading the race this week with ${me.points} points. Keep the gap.`;
    else if (myIdx > 0 && race[myIdx - 1].points === me.points) raceLine = `You're tied with ${esc(race[myIdx - 1].p.full_name.split(" ")[0])} at ${me.points} points. One task breaks the tie.`;
    else if (myIdx > 0) raceLine = `You're #${myIdx + 1} this week, ${race[myIdx - 1].points - me.points} points behind ${esc(race[myIdx - 1].p.full_name.split(" ")[0])}.`;
    else raceLine = `The race is wide open. Finish your first task to take the lead.`;
  }
  const subtitle = todays.length
    ? (doneToday === todays.length ? `All ${todays.length} of today's tasks are done. Great work.` : `You have ${todays.length - doneToday} task${todays.length - doneToday > 1 ? "s" : ""} left today${overdue.length ? ` and ${overdue.length} overdue` : ""}.`)
    : overdue.length ? `Nothing new today, but ${overdue.length} task${overdue.length > 1 ? "s are" : " is"} overdue.` : "Your day is clear. Add something worth finishing.";
  return `
  <div class="hello" style="--mc:${esc(S.me.color)}">
    <h1>${esc(greeting(S.me.full_name))}</h1>
    <p>${fullDate(t0)} · ${subtitle}</p>
    <div class="quote">${esc(lineOfDay())}</div>
  </div>
  <div class="stats">
    <div class="stat"><small>Today</small><b>${doneToday}/${todays.length}</b><span>tasks done</span></div>
    <div class="stat"><small>Focus time</small><b data-focus>${fmtSecs(focus)}</b><span>tracked today</span></div>
    <div class="stat"><small>This week</small><b>${me ? me.points : 0}</b><span>${me ? `points · rank #${myIdx + 1}` : "points"}</span></div>
    <div class="stat"><small>Streak</small><b>${me ? me.streak : streakOf(uid)}</b><span>days fully done</span></div>
  </div>
  ${raceLine && !isAdmin() ? `<div class="callout">${I.trophy}<span>${raceLine}</span><button class="btn sm ghost" style="margin-left:auto" data-go="race">See race</button></div>` : ""}
  <form class="quickadd" id="quickAdd"><input class="input" name="q" list="titleHints" maxlength="160" placeholder="Add a task for today and press Enter"><button class="btn primary" type="submit">Add</button><button class="btn" type="button" data-act="new">More options</button></form>
  ${titleDatalist(uid)}
  ${section("Overdue", overdue, { who: false }, "late")}
  ${section("Today", todays, { who: false, showEmpty: true, empty: "<b>No tasks for today</b>Add one above, or set up a routine for work you do every day." })}
  ${upcoming.length ? `<div class="sechead" style="margin-top:6px">Upcoming</div>${groupedUpcoming(upcoming, { who: false })}` : ""}`;
}
function titleDatalist(uid) {
  const titles = [...new Set([...S.tasks.values()].filter(t => !uid || t.assignee === uid).sort((a, b) => b.created_at.localeCompare(a.created_at)).map(t => t.title))].slice(0, 40);
  return `<datalist id="titleHints">${titles.map(t => `<option value="${esc(t)}">`).join("")}</datalist>`;
}

function viewTeam() {
  const d = S.teamDate;
  const people = S.profiles.filter(p => p.role === "member" || [...S.tasks.values()].some(t => t.assignee === p.id && activeOn(t, d)));
  const cols = people.map(p => {
    const ts = tasksWhere(t => t.assignee === p.id && activeOn(t, d));
    const done = ts.filter(t => t.progress >= 100).length, late = ts.filter(t => stateOf(t) === "late").length;
    const avg = ts.length ? Math.round(ts.reduce((a, t) => a + t.progress, 0) / ts.length) : 0;
    const sub = !ts.length ? "No tasks" : late ? `${late} not done · ${done}/${ts.length} done` : `${done}/${ts.length} done · ${avg}%`;
    return `<div class="col" style="--mc:${esc(p.color)}">
      <div class="colhead ${late ? "late" : ""}">${av(p)}<div class="grow"><div class="nm">${esc(p.full_name)}</div><div class="sub">${sub}</div><div class="bar"><i style="width:${avg}%"></i></div></div>
        <button class="btn sm" data-member="${p.id}">Planner</button></div>
      ${ts.length ? ts.map(t => rowHTML(t, { who: false })).join("") : `<div class="empty">Nothing assigned for ${dayLabel(d).toLowerCase() === "today" ? "today" : dayLabel(d)}.</div>`}
    </div>`;
  }).join("");
  return `
  <div class="pagehead"><div><h1>Team</h1><p>${d === today() ? "Today · " : ""}${fullDate(d)}</p></div>
    <div class="datenav"><button class="btn icon" data-day="-1" aria-label="Previous day">${I.left}</button>
      <input class="input" type="date" id="teamDate" value="${d}" aria-label="Pick a date">
      <button class="btn icon" data-day="1" aria-label="Next day">${I.right}</button>
      ${d !== today() ? `<button class="btn" data-day="0">Today</button>` : ""}
      ${isAdmin() ? `<button class="btn primary" data-act="new">${I.plus}Assign task</button>` : ""}</div></div>
  <div class="board">${cols}</div>`;
}

function viewMember() {
  const p = person(S.memberId), t0 = today();
  const mine = [...S.tasks.values()].filter(t => t.assignee === p.id);
  const overdue = sortTasks(mine.filter(t => t.due_date < t0 && t.progress < 100));
  const todays = sortTasks(mine.filter(t => activeOn(t, t0)));
  const upcoming = sortTasks(mine.filter(t => startOf(t) > t0));
  const recent = mine.filter(t => t.due_date < t0 && t.due_date >= addDays(t0, -7) && t.progress >= 100).sort((a, b) => b.due_date.localeCompare(a.due_date));
  const r = raceTable().find(x => x.p.id === p.id);
  return `
  <div class="pagehead"><div style="display:flex;align-items:center;gap:12px">${av(p, "lg")}<div><h1>${esc(p.full_name)}'s planner</h1><p>${r ? `${r.points} points this week · ${r.streak}-day streak · ${fmtSecs(r.secs)} tracked` : esc(p.role)}</p></div></div>
    <div class="datenav"><button class="btn" data-go="team">${I.left}Team</button>${isAdmin() ? `<button class="btn primary" data-act="new">${I.plus}Assign to ${esc(p.full_name.split(" ")[0])}</button>` : ""}</div></div>
  ${section("Overdue", overdue, { who: false }, "late")}
  ${section("Today", todays, { who: false, showEmpty: true, empty: "Nothing for today." })}
  ${upcoming.length ? `<div class="sechead">Upcoming</div>${groupedUpcoming(upcoming, { who: false })}` : section("Upcoming", [], { showEmpty: true, empty: "Nothing scheduled ahead." })}
  ${section("Done in the last 7 days", recent, { who: false })}`;
}

function viewRace() {
  const rows = raceTable(); const top = rows[0]?.points || 0;
  const ws = weekStart();
  return `
  <div class="pagehead"><div><h1>This week's race</h1><p>${shortDate(ws)} – ${shortDate(addDays(ws, 6))} · resets every Monday</p></div></div>
  <div class="podium">${rows.map((r, i) => `
    <div class="racer ${i === 0 && r.points > 0 ? "first" : ""}" style="--mc:${esc(r.p.color)}">
      <div class="rank">${i + 1}</div>${av(r.p, "lg")}
      <div><div class="nm">${esc(r.p.full_name)}${i === 0 && r.points > 0 ? `<span class="pill" style="background:var(--gold-bg);color:var(--gold)">${I.trophy} Leading</span>` : ""}${r.streak >= 2 ? `<span class="pill active">${I.flame} ${r.streak}</span>` : ""}</div>
        <div class="facts"><span>${r.done}/${r.total} done</span><span>${r.onTimePct}% on time</span><span>${fmtSecs(r.secs)} tracked</span><span>Today ${r.todayDone}/${r.todayTotal}</span></div>
        <div class="track"><i style="width:${top ? Math.round(r.points / top * 100) : 0}%"></i></div></div>
      <div class="pts"><b>${r.points}</b><small>points</small></div>
    </div>`).join("")}</div>
  <div class="sechead">How points work</div>
  <div class="rules">
    <div class="rule"><b>+${POINTS.done}</b> for every task done</div>
    <div class="rule"><b>+${POINTS.onTime}</b> finished before the due time</div>
    <div class="rule"><b>+${POINTS.high}</b> high priority · <b>+${POINTS.medium}</b> medium</div>
    <div class="rule"><b>+${POINTS.proofFile}</b> proof file attached</div>
    <div class="rule">${I.flame} Streak: days where every task was done</div>
  </div>`;
}

function daysText(days) {
  const s = [...days].sort().join(",");
  if (s === "0,1,2,3,4,5,6") return "Every day";
  if (s === "1,2,3,4,5,6") return "Mon – Sat";
  if (s === "1,2,3,4,5") return "Mon – Fri";
  return [...days].sort().map(d => DOW[d]).join(", ");
}
function viewRoutines() {
  const groups = S.profiles.map(p => ({ p, rs: S.routines.filter(r => r.assignee === p.id) })).filter(g => g.rs.length);
  return `
  <div class="pagehead"><div><h1>Routines</h1><p>Work that repeats. Tasks are created automatically on the chosen days, so nobody retypes them.</p></div>
    <button class="btn primary" data-act="newRoutine">${I.plus}New routine</button></div>
  ${groups.length ? groups.map(g => `
    <div class="section"><div class="sechead">${av(g.p, "sm")} ${esc(g.p.full_name)}<span class="count">${g.rs.length}</span></div>
    <div class="list">${g.rs.map(r => `
      <div class="rrow ${r.active ? "" : "off"}" style="--mc:${esc(g.p.color)}">
        <button class="switch ${r.active ? "on" : ""}" data-toggle="${r.id}" ${canEditRoutine(r) ? "" : "disabled"} aria-label="${r.active ? "Pause" : "Resume"} routine"></button>
        <div class="tmain"><div class="ttitle"><span class="prio ${r.priority}"></span>${esc(r.title)}</div><div class="days">${daysText(r.days)} · due ${fmtTime(r.due_time)}${r.active ? "" : " · paused"}</div></div>
        ${canEditRoutine(r) ? `<button class="btn sm" data-editr="${r.id}">Edit</button>` : `<span class="lock">${I.lock}</span>`}
      </div>`).join("")}</div></div>`).join("")
  : `<div class="empty"><b>No routines yet</b>Example: “Call new leads and send follow-up emails”, Mon – Sat, due 6:00 PM.</div>`}`;
}

function viewReports() {
  return `
  <div class="pagehead"><div><h1>Reports</h1><p>Completion, punctuality and time per member.</p></div>
    <div class="datenav"><div class="seg" style="width:220px">${[7, 30].map(n => `<button data-range="${n}" class="${S.reportDays === n ? "on" : ""}">Last ${n} days</button>`).join("")}</div>
    <button class="btn" data-act="csv">Export CSV</button></div></div>
  <div id="report"><div class="loading">Crunching numbers…</div></div>`;
}
let reportRows = [];
async function loadReport() {
  const from = addDays(today(), -(S.reportDays - 1));
  const { data, error } = await sb.from("tasks").select("*, proofs(id)").gte("due_date", from).lte("due_date", today()).order("due_date").limit(5000);
  if (error) { $("#report").innerHTML = `<div class="empty">Couldn't load the report.</div>`; return; }
  reportRows = data;
  const now = new Date();
  const rows = S.profiles.filter(p => p.role === "member" || data.some(t => t.assignee === p.id)).map(p => {
    const ts = data.filter(t => t.assignee === p.id);
    const done = ts.filter(t => t.progress >= 100);
    const onTime = done.filter(t => t.done_at && new Date(t.done_at) <= dueAt(t)).length;
    const missed = ts.filter(t => t.progress < 100 && dueAt(t) < now).length;
    const noProof = done.filter(t => !t.proofs?.length && !(t.proof_note || "").trim()).length;
    const secs = ts.reduce((a, t) => a + (t.time_spent || 0), 0);
    return { p, n: ts.length, done: done.length, pct: ts.length ? Math.round(done.length / ts.length * 100) : 0, onTime: done.length ? Math.round(onTime / done.length * 100) : 0, missed, noProof, secs, pts: done.reduce((a, t) => a + taskPoints(t), 0) };
  });
  const missedList = data.filter(t => t.progress < 100 && dueAt(t) < now).sort((a, b) => b.due_date.localeCompare(a.due_date)).slice(0, 30);
  $("#report").innerHTML = `
    <div class="tablewrap" style="margin-bottom:24px"><table>
      <thead><tr><th>Member</th><th>Assigned</th><th>Done</th><th>Completion</th><th>On time</th><th>Not done</th><th>Time tracked</th><th>Points</th></tr></thead>
      <tbody>${rows.map(r => `<tr><td><span class="chip">${av(r.p, "sm")}${esc(r.p.full_name)}</span></td><td>${r.n}</td><td>${r.done}</td>
        <td class="${r.pct >= 80 ? "good" : r.pct < 50 && r.n ? "bad" : ""}">${r.pct}%</td><td>${r.onTime}%</td><td class="${r.missed ? "bad" : ""}">${r.missed}</td><td>${fmtSecs(r.secs)}</td><td>${r.pts}</td></tr>`).join("")}</tbody>
    </table></div>
    ${missedList.length ? `<div class="section"><div class="sechead late">Not done<span class="count">${missedList.length}</span></div><div class="list">${missedList.map(t => rowHTML(S.tasks.get(t.id) || { ...t, proofs: t.proofs || [], comments: [] })).join("")}</div></div>` : `<div class="empty"><b>Nothing missed</b>Every task in this period was finished.</div>`}`;
  bindRows($("#report"));
}
function exportCSV() {
  const head = ["Date", "Due", "Member", "Task", "Priority", "Progress", "Status", "Done at", "Minutes tracked", "Proof files", "Proof note"];
  const lines = reportRows.map(t => [t.due_date, t.due_time, person(t.assignee).full_name, t.title, t.priority, t.progress + "%", STATE_LABEL[stateOf(t)], t.done_at ? new Date(t.done_at).toLocaleString() : "", Math.round((t.time_spent || 0) / 60), t.proofs?.length || 0, t.proof_note || ""]);
  const csv = [head, ...lines].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv" }));
  a.download = `triwon-report-${today()}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ================= view events ================= */
function bindRows(root) {
  $$("[data-open]", root).forEach(el => {
    el.addEventListener("click", e => { if (e.target.closest("[data-done]")) return; openTask(el.dataset.open); });
    el.addEventListener("keydown", e => { if (e.key === "Enter" && e.target === el) openTask(el.dataset.open); });
  });
  $$("[data-done]", root).forEach(b => b.onclick = e => { e.stopPropagation(); toggleDone(b.dataset.done); });
}
function bindView() {
  const v = $("#view");
  bindRows(v);
  $$("[data-go]", v).forEach(b => b.onclick = () => go(b.dataset.go));
  $$("[data-member]", v).forEach(b => b.onclick = () => go("member", b.dataset.member));
  $$("[data-act=new]", v).forEach(b => b.onclick = () => openTaskForm({ assignee: S.view === "member" ? S.memberId : null, date: S.view === "team" ? S.teamDate : null }));
  $$("[data-act=newRoutine]", v).forEach(b => b.onclick = () => openTaskForm({ repeat: "monsat" }));
  $$("[data-day]", v).forEach(b => b.onclick = async () => { const n = +b.dataset.day; S.teamDate = n === 0 ? today() : addDays(S.teamDate, n); await ensureDay(S.teamDate); renderView(); });
  const dp = $("#teamDate"); if (dp) dp.onchange = async () => { if (dp.value) { S.teamDate = dp.value; await ensureDay(dp.value); renderView(); } };
  $$("[data-toggle]", v).forEach(b => b.onclick = () => toggleRoutine(b.dataset.toggle));
  $$("[data-editr]", v).forEach(b => b.onclick = () => openTaskForm({ routine: S.routines.find(r => r.id === b.dataset.editr) }));
  $$("[data-range]", v).forEach(b => b.onclick = () => { S.reportDays = +b.dataset.range; renderView(); });
  $$("[data-act=csv]", v).forEach(b => b.onclick = exportCSV);
  const qa = $("#quickAdd");
  if (qa) qa.onsubmit = async e => {
    e.preventDefault(); const title = qa.q.value.trim(); if (!title) return;
    qa.q.value = "";
    const { error } = await sb.from("tasks").insert({ title, assignee: S.me.id, start_date: today(), due_date: today(), due_time: "18:00", priority: "medium", created_by: S.me.id });
    if (error) return toast(cleanErr(error), true);
    toast("Task added"); await loadTasks(); renderView(); $("#quickAdd input")?.focus();
  };
}
async function ensureDay(d) { if (![...S.tasks.values()].some(t => activeOn(t, d))) await loadDay(d); }

/* ================= task actions ================= */
async function toggleDone(id) {
  const t = S.tasks.get(id); if (!t || !canWork(t)) return;
  if (t.progress >= 100) { await updateTask(id, { progress: 0 }, "Task reopened"); return; }
  if (!isAdmin() && !proofCount(t) && !(t.proof_note || "").trim()) {
    toast("Add a proof file or note first, then mark it done.", true); openTask(id); return;
  }
  const patch = { progress: 100 };
  if (t.timer_started_at) Object.assign(patch, { time_spent: Math.round(liveSpent(t)), timer_started_at: null });
  await updateTask(id, patch, `Done. +${taskPoints({ ...t, ...patch, done_at: new Date().toISOString() })} points`);
}
async function setProgress(id, v) {
  const t = S.tasks.get(id);
  if (v >= 100) return toggleDone(id);
  await updateTask(id, { progress: v });
}
async function toggleTimer(id) {
  const t = S.tasks.get(id); if (!t || !canWork(t)) return;
  if (t.timer_started_at) { await updateTask(id, { time_spent: Math.round(liveSpent(t)), timer_started_at: null }, "Timer paused"); return; }
  for (const o of S.tasks.values()) if (o.id !== id && o.assignee === t.assignee && o.timer_started_at) await updateTask(o.id, { time_spent: Math.round(liveSpent(o)), timer_started_at: null });
  await updateTask(id, { timer_started_at: new Date().toISOString(), progress: Math.max(t.progress, t.progress >= 100 ? 100 : 5) }, "Timer started");
}
async function deleteTask(id) {
  const t = S.tasks.get(id);
  if (!confirm(`Delete “${t.title}”? This also removes its proof files and comments.`)) return;
  const paths = (t.proofs || []).map(p => p.path);
  const { error } = await sb.from("tasks").delete().eq("id", id);
  if (error) return toast(cleanErr(error), true);
  if (paths.length) await sb.storage.from("proofs").remove(paths);
  S.tasks.delete(id); closeSheet(); safeRender(); toast("Task deleted");
}

/* ================= task detail ================= */
async function openTask(id) {
  if (!S.tasks.has(id)) { const { data } = await sb.from("tasks").select(SEL).eq("id", id).single(); if (!data) return; S.tasks.set(id, data); }
  S.openTask = id; S.comments = [];
  renderTaskSheet(); $("#scrim").classList.add("open"); document.body.style.overflow = "hidden";
  await loadComments(id); safeRenderTaskSheet();
}
function safeRenderTaskSheet(force = false) {
  if (!S.openTask || !$("#scrim").classList.contains("open")) return;
  const a = document.activeElement;
  if (!force && a && $("#sheet").contains(a) && /INPUT|TEXTAREA/.test(a.tagName)) return;
  if (force && a && $("#sheet").contains(a) && a.tagName === "TEXTAREA") return;
  renderTaskSheet();
}
function renderTaskSheet() {
  const t = S.tasks.get(S.openTask);
  if (!t) { closeSheet(); return; }
  const p = person(t.assignee), st = stateOf(t), work = canWork(t), edit = canEditDetails(t);
  const running = !!t.timer_started_at;
  const sheet = $("#sheet"); const scroll = sheet.scrollTop;
  sheet.style.setProperty("--mc", p.color);
  sheet.innerHTML = `
    <div class="shead"><div class="grow"><h2>${esc(t.title)}</h2></div><button class="btn ghost icon" data-x aria-label="Close">${I.x}</button></div>
    <div class="smeta">
      <span class="chip">${av(p, "sm")}${esc(p.full_name)}</span>
      <span>${startOf(t) !== t.due_date ? `${dayLabel(startOf(t))} → ` : ""}${dayLabel(t.due_date)}, ${fmtTime(t.due_time)}</span>
      <span><span class="prio ${t.priority}"></span>${t.priority[0].toUpperCase() + t.priority.slice(1)}</span>
      ${t.routine_id ? `<span class="tag" style="margin:0">Daily routine</span>` : ""}
      <span class="pill ${st}">${STATE_LABEL[st]}</span>
    </div>
    ${!work ? `<div class="lockmsg">${I.lock} Only ${esc(p.full_name.split(" ")[0])} or an admin can update this task.</div>` : ""}
    ${t.notes ? `<p class="notes">${esc(t.notes)}</p>` : ""}
    <div class="block">
      <h3>Progress <span class="r">${dueHTML(t)}</span></h3>
      <div class="bigpct">${t.progress}%</div>
      <input class="slider" type="range" min="0" max="100" step="5" value="${t.progress}" id="prog" ${work ? "" : "disabled"} aria-label="Progress">
      <div class="steps">${[0, 25, 50, 75, 100].map(v => `<button data-step="${v}" class="${t.progress === v ? "on" : ""}" ${work ? "" : "disabled"}>${v === 100 ? "Done" : v + "%"}</button>`).join("")}</div>
    </div>
    <div class="block">
      <h3>Time tracker</h3>
      <div class="timerbox"><div class="clock ${running ? "run" : ""}" data-live="${t.id}">${fmtSecs(liveSpent(t), true)}</div>
        ${work && t.progress < 100 ? `<button class="btn ${running ? "" : "primary"}" data-timer>${running ? I.pause + "Pause" : I.play + (t.time_spent ? "Resume" : "Start")}</button>` : ""}</div>
      <p class="hint">${running ? "Running. Pauses automatically when you start another task or mark this done." : "Start the timer when you begin working on this task."}</p>
    </div>
    <div class="block">
      <h3>Proof of work <span class="r">${proofCount(t)} file${proofCount(t) === 1 ? "" : "s"}</span></h3>
      ${proofCount(t) ? `<div class="files">${t.proofs.map(f => fileHTML(f)).join("")}</div>` : ""}
      ${work ? `<button class="btn" data-attach>${I.clip} Attach file</button><p class="hint">Up to 2 MB each. Images, PDF, ZIP, Word, Excel, PowerPoint and more. Large photos are compressed automatically.</p>` : ""}
      <label class="field" style="margin:12px 0 0"><span>Proof note</span>
        <textarea class="textarea" id="proofNote" maxlength="2000" placeholder="${work ? "What did you finish? Links, numbers, call outcomes…" : "No note yet."}" ${work ? "" : "disabled"}>${esc(t.proof_note)}</textarea></label>
    </div>
    <div class="block">
      <h3>Comments <span class="r">${S.comments.length}</span></h3>
      <div class="comments">${S.comments.map(c => { const u = person(c.user_id); return `<div class="cmt">${av(u, "sm")}<div class="body"><b>${esc(u.full_name)}</b><small>${new Date(c.created_at).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</small><p>${esc(c.body)}</p></div>${c.user_id === S.me.id || isAdmin() ? `<button class="btn ghost icon sm" data-delc="${c.id}" aria-label="Delete comment">${I.x}</button>` : ""}</div>`; }).join("") || `<p class="hint" style="margin:0">No comments yet. Ask a question or give feedback.</p>`}</div>
      <form class="cmtform" id="cmtForm"><input class="input" name="c" maxlength="1000" placeholder="Write a comment…" autocomplete="off"><button class="btn">Send</button></form>
    </div>
    ${edit ? `<div class="block" style="display:flex;gap:10px;justify-content:space-between"><button class="btn danger" data-del>Delete task</button><button class="btn" data-edit>Edit details</button></div>` : ""}`;
  sheet.scrollTop = scroll;
  hydrateFiles(t);

  $("[data-x]", sheet).onclick = closeSheet;
  const prog = $("#prog", sheet);
  prog.oninput = () => { $(".bigpct", sheet).textContent = prog.value + "%"; };
  prog.onchange = () => setProgress(t.id, +prog.value);
  $$("[data-step]", sheet).forEach(b => b.onclick = () => setProgress(t.id, +b.dataset.step));
  $("[data-timer]", sheet)?.addEventListener("click", () => toggleTimer(t.id));
  $("[data-attach]", sheet)?.addEventListener("click", () => { const fp = $("#filePick"); fp.value = ""; fp.onchange = () => uploadProof(t.id, fp.files[0]); fp.click(); });
  const note = $("#proofNote", sheet);
  note.onchange = () => updateTask(t.id, { proof_note: note.value.trim() }, "Note saved");
  $$("[data-rmf]", sheet).forEach(b => b.onclick = e => { e.stopPropagation(); removeProof(t.id, b.dataset.rmf); });
  $$("[data-openf]", sheet).forEach(b => b.onclick = () => openFile(t.id, b.dataset.openf));
  $("#cmtForm", sheet).onsubmit = async e => {
    e.preventDefault(); const body = e.target.c.value.trim(); if (!body) return;
    e.target.c.value = "";
    const { error } = await sb.from("comments").insert({ task_id: t.id, body, user_id: S.me.id });
    if (error) return toast(cleanErr(error), true);
    await loadComments(t.id); renderTaskSheet();
  };
  $$("[data-delc]", sheet).forEach(b => b.onclick = async () => { await sb.from("comments").delete().eq("id", b.dataset.delc); await loadComments(t.id); renderTaskSheet(); });
  $("[data-del]", sheet)?.addEventListener("click", () => deleteTask(t.id));
  $("[data-edit]", sheet)?.addEventListener("click", () => openTaskForm({ task: t }));
}
function fileHTML(f) {
  const img = (f.mime || "").startsWith("image/");
  const canRm = isAdmin() || f.user_id === S.me.id;
  return `<div class="file" role="button" tabindex="0" data-openf="${f.id}">
    <div class="thumb" ${img ? `data-img="${esc(f.path)}"` : ""}>${img ? "" : esc(ext(f.name).toUpperCase() || "FILE")}</div>
    <div class="fn">${esc(f.name)}<small>${fmtSize(f.size)} · ${esc(person(f.user_id).full_name.split(" ")[0])}</small></div>
    ${canRm ? `<button class="x" data-rmf="${f.id}" aria-label="Remove file">${I.x}</button>` : ""}
  </div>`;
}
async function signed(paths) {
  const need = paths.filter(p => !S.urlCache[p] || S.urlCache[p].exp < Date.now());
  if (need.length) {
    const { data } = await sb.storage.from("proofs").createSignedUrls(need, 3600);
    (data || []).forEach(d => { if (d.signedUrl) S.urlCache[d.path] = { url: d.signedUrl, exp: Date.now() + 3500e3 }; });
  }
  return Object.fromEntries(paths.map(p => [p, S.urlCache[p]?.url]));
}
async function hydrateFiles(t) {
  const els = $$("[data-img]", $("#sheet")); if (!els.length) return;
  const urls = await signed(els.map(e => e.dataset.img));
  els.forEach(e => { const u = urls[e.dataset.img]; if (u) e.style.backgroundImage = `url("${u}")`; });
}
async function openFile(taskId, fileId) {
  const f = S.tasks.get(taskId)?.proofs?.find(x => x.id === fileId); if (!f) return;
  if ((f.mime || "").startsWith("image/")) {
    const u = (await signed([f.path]))[f.path]; if (!u) return toast("Couldn't open the file.", true);
    $("#lightbox img").src = u; $("#lightbox").classList.add("open");
  } else {
    const { data, error } = await sb.storage.from("proofs").createSignedUrl(f.path, 600, { download: f.name });
    if (error) return toast("Couldn't open the file.", true);
    window.open(data.signedUrl, "_blank", "noopener");
  }
}

/* ================= proofs upload ================= */
async function uploadProof(taskId, file) {
  if (!file) return;
  const t = S.tasks.get(taskId);
  const e = ext(file.name);
  if (!ALLOWED_EXT.includes(e)) return toast(`.${e || "?"} files aren't allowed. Use images, PDF, ZIP or Office files.`, true);
  let blob = file, mime = file.type || "application/octet-stream";
  if (file.size > MAX_BYTES && /^image\/(jpeg|png|webp)$/.test(file.type)) {
    toast("Compressing image…");
    try { blob = await compressImage(file); mime = "image/jpeg"; } catch { }
  }
  if (blob.size > MAX_BYTES) return toast(`That file is ${fmtSize(file.size)}. The limit is 2 MB per file.`, true);
  if (e === "zip" && !file.type) mime = "application/zip";
  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
  const path = `${S.me.id}/${taskId}/${Date.now()}-${safeName}`;
  toast("Uploading…");
  const up = await sb.storage.from("proofs").upload(path, blob, { contentType: mime, upsert: false });
  if (up.error) return toast(up.error.message.includes("size") ? "The limit is 2 MB per file." : cleanErr(up.error), true);
  const { data, error } = await sb.from("proofs").insert({ task_id: taskId, path, name: file.name.slice(0, 120), size: blob.size, mime, user_id: S.me.id }).select().single();
  if (error) { await sb.storage.from("proofs").remove([path]); return toast(cleanErr(error), true); }
  t.proofs = [...(t.proofs || []), data];
  toast("Proof attached"); renderTaskSheet(); safeRender();
}
async function compressImage(file) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
  let side = 2000, q = 0.85, blob;
  for (let k = 0; k < 7; k++) {
    const s = Math.min(1, side / Math.max(img.width, img.height));
    const c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    blob = await new Promise(r => c.toBlob(r, "image/jpeg", q));
    if (blob.size <= MAX_BYTES * 0.95) break;
    side *= 0.8; q = Math.max(0.5, q - 0.07);
  }
  URL.revokeObjectURL(img.src); return blob;
}
async function removeProof(taskId, fileId) {
  const t = S.tasks.get(taskId); const f = t?.proofs?.find(x => x.id === fileId); if (!f) return;
  if (!confirm(`Remove “${f.name}”?`)) return;
  const { error } = await sb.from("proofs").delete().eq("id", fileId);
  if (error) return toast(cleanErr(error), true);
  await sb.storage.from("proofs").remove([f.path]);
  t.proofs = t.proofs.filter(x => x.id !== fileId);
  toast("File removed"); renderTaskSheet(); safeRender();
}

/* ================= create / edit form ================= */
const REPEATS = { none: null, daily: [0, 1, 2, 3, 4, 5, 6], monsat: [1, 2, 3, 4, 5, 6], monfri: [1, 2, 3, 4, 5], custom: null };
function openTaskForm({ task = null, routine = null, assignee = null, date = null, repeat = "none" } = {}) {
  const editing = task || routine;
  const src = task || routine || {};
  const who = src.assignee || assignee || (isAdmin() ? (members()[0]?.id || S.me.id) : S.me.id);
  let rep = routine ? "custom" : repeat;
  if (routine) { const s = [...routine.days].sort().join(","); rep = Object.keys(REPEATS).find(k => REPEATS[k] && REPEATS[k].join(",") === s) || "custom"; }
  let days = routine ? [...routine.days] : (REPEATS[rep] || [1, 2, 3, 4, 5, 6]);
  let prio = src.priority || "medium";
  const people = isAdmin() ? S.profiles : [S.me];
  const startVal = task ? startOf(task) : routine ? routine.start_date : (date && date < today() ? date : today());
  const endVal = task ? task.due_date : (date && date > startVal ? date : startVal);
  const title = task ? "Edit task" : routine ? "Edit routine" : rep !== "none" ? "New routine" : isAdmin() ? "Assign a task" : "Add a task";
  openSheet(`
    <div class="shead"><div class="grow"><h2>${title}</h2></div><button class="btn ghost icon" data-x aria-label="Close">${I.x}</button></div>
    <form id="tf" style="margin-top:16px">
      <label class="field"><span>Task</span><input class="input" name="ttl" list="titleHints" required maxlength="160" value="${esc(src.title || "")}" placeholder="e.g. Call new leads and send follow-up emails"></label>
      ${titleDatalist(isAdmin() ? null : S.me.id)}
      ${isAdmin() ? `<label class="field"><span>Assign to</span><select class="select" name="assignee">${people.map(p => `<option value="${p.id}" ${p.id === who ? "selected" : ""}>${esc(p.full_name)}${p.id === S.me.id ? " (you)" : ""}</option>`).join("")}</select></label>` : ""}
      ${task ? "" : `<label class="field"><span>Repeat</span><select class="select" name="repeat" ${routine ? "" : ""}>
        ${!routine ? `<option value="none" ${rep === "none" ? "selected" : ""}>Does not repeat</option>` : ""}
        <option value="daily" ${rep === "daily" ? "selected" : ""}>Every day</option>
        <option value="monsat" ${rep === "monsat" ? "selected" : ""}>Every working day (Mon – Sat)</option>
        <option value="monfri" ${rep === "monfri" ? "selected" : ""}>Weekdays (Mon – Fri)</option>
        <option value="custom" ${rep === "custom" ? "selected" : ""}>Custom days…</option></select></label>
        <div class="field ${rep === "custom" ? "" : "hide"}" id="dayField"><span>On these days</span><div class="daychips">${[1, 2, 3, 4, 5, 6, 0].map(d => `<button type="button" data-d="${d}" class="${days.includes(d) ? "on" : ""}">${DOW[d]}</button>`).join("")}</div></div>`}
      <div class="row3">
        <label class="field"><span id="dateLbl">${rep !== "none" && !task ? "Starts on" : "Start date"}</span><input class="input" type="date" name="date" required value="${startVal}"></label>
        <label class="field ${rep !== "none" && !task ? "hide" : ""}" id="endField"><span>End date</span><input class="input" type="date" name="end" value="${endVal}" min="${startVal}"></label>
        <label class="field"><span>Due time</span><input class="input" type="time" name="time" required value="${src.due_time || "18:00"}"></label>
      </div>
      <div class="field"><span>Priority</span><div class="seg" id="prioSeg">${["low", "medium", "high"].map(v => `<button type="button" data-p="${v}" class="${prio === v ? "on" : ""}">${v[0].toUpperCase() + v.slice(1)}</button>`).join("")}</div></div>
      <label class="field"><span>Details <small style="font-weight:400;color:var(--muted)">optional</small></span><textarea class="textarea" name="notes" maxlength="1500" placeholder="What does done look like? Targets, links, who to contact…">${esc(src.notes || "")}</textarea></label>
      <div class="sactions">
        ${routine ? `<button type="button" class="btn danger" data-delr style="margin-right:auto">Delete routine</button>` : ""}
        <button type="button" class="btn" data-x>Cancel</button>
        <button class="btn primary" id="tfSave">${editing ? "Save changes" : rep !== "none" ? "Create routine" : isAdmin() ? "Assign task" : "Add task"}</button>
      </div>
    </form>`);
  const f = $("#tf");
  setTimeout(() => f.ttl.focus(), 60);
  $$("[data-x]").forEach(b => b.onclick = () => task ? openTask(task.id) : closeSheet());
  $$("#prioSeg button").forEach(b => b.onclick = () => { prio = b.dataset.p; $$("#prioSeg button").forEach(x => x.classList.toggle("on", x === b)); });
  $$("[data-d]").forEach(b => b.onclick = () => { const d = +b.dataset.d; days = days.includes(d) ? days.filter(x => x !== d) : [...days, d]; b.classList.toggle("on"); });
  if (f.repeat) f.repeat.onchange = () => {
    rep = f.repeat.value; if (REPEATS[rep]) { days = [...REPEATS[rep]]; $$("[data-d]").forEach(b => b.classList.toggle("on", days.includes(+b.dataset.d))); }
    $("#dayField").classList.toggle("hide", rep !== "custom");
    $("#dateLbl").textContent = rep !== "none" ? "Starts on" : "Start date";
    $("#endField").classList.toggle("hide", rep !== "none");
    $("#tfSave").textContent = editing ? "Save changes" : rep !== "none" ? "Create routine" : isAdmin() ? "Assign task" : "Add task";
  };
  $("[data-delr]")?.addEventListener("click", () => deleteRoutine(routine));
  f.date.addEventListener("change", () => { f.end.min = f.date.value; if (f.end.value < f.date.value) f.end.value = f.date.value; });
  f.onsubmit = async e => {
    e.preventDefault();
    const data = { title: f.ttl.value.trim(), notes: f.notes.value.trim(), assignee: f.assignee ? f.assignee.value : S.me.id, due_time: f.time.value, priority: prio };
    if (!data.title) return;
    const startD = f.date.value, endD = f.end.value || startD;
    if ((task || rep === "none") && endD < startD) return toast("End date can't be before the start date.", true);
    $("#tfSave").disabled = true;
    let error;
    if (task) {
      ({ error } = await sb.from("tasks").update({ ...data, start_date: startD, due_date: endD }).eq("id", task.id));
      if (!error) { Object.assign(task, data, { start_date: startD, due_date: endD }); toast("Task updated"); safeRender(); openTask(task.id); return; }
    } else if (rep !== "none") {
      if (!days.length) { $("#tfSave").disabled = false; return toast("Pick at least one day.", true); }
      const r = { ...data, days: [...days].sort(), start_date: f.date.value };
      if (routine) {
        ({ error } = await sb.from("routines").update(r).eq("id", routine.id));
        if (!error) await sb.from("tasks").delete().eq("routine_id", routine.id).gt("due_date", today()).eq("progress", 0);
      } else {
        ({ error } = await sb.from("routines").insert({ ...r, created_by: S.me.id }));
      }
      if (!error) {
        await sb.rpc("generate_routine_tasks", { from_date: today(), to_date: addDays(today(), 7) });
        await Promise.all([loadTasks(), loadRoutines()]);
        closeSheet(); toast(routine ? "Routine updated" : `Routine created · ${daysText(days)}`); safeRender(); return;
      }
    } else {
      ({ error } = await sb.from("tasks").insert({ ...data, start_date: startD, due_date: endD, created_by: S.me.id }));
      if (!error) { await loadTasks(); closeSheet(); toast(isAdmin() && data.assignee !== S.me.id ? `Assigned to ${person(data.assignee).full_name}` : "Task added"); safeRender(); return; }
    }
    $("#tfSave").disabled = false;
    toast(cleanErr(error), true);
  };
}
async function toggleRoutine(id) {
  const r = S.routines.find(x => x.id === id); if (!r) return;
  const { error } = await sb.from("routines").update({ active: !r.active }).eq("id", id);
  if (error) return toast(cleanErr(error), true);
  r.active = !r.active;
  if (!r.active) await sb.from("tasks").delete().eq("routine_id", id).gt("due_date", today()).eq("progress", 0);
  else await sb.rpc("generate_routine_tasks", { from_date: today(), to_date: addDays(today(), 7) });
  await loadTasks(); toast(r.active ? "Routine resumed" : "Routine paused"); safeRender();
}
async function deleteRoutine(r) {
  if (!confirm(`Delete the routine “${r.title}”? Past tasks and proofs stay; future untouched tasks are removed.`)) return;
  await sb.from("tasks").delete().eq("routine_id", r.id).gt("due_date", today()).eq("progress", 0);
  const { error } = await sb.from("routines").delete().eq("id", r.id);
  if (error) return toast(cleanErr(error), true);
  await Promise.all([loadTasks(), loadRoutines()]); closeSheet(); toast("Routine deleted"); safeRender();
}

/* ================= password ================= */
function openPassword() {
  openSheet(`
    <div class="shead"><div class="grow"><h2>Change password</h2></div><button class="btn ghost icon" data-x aria-label="Close">${I.x}</button></div>
    <form id="pwf" style="margin-top:16px">
      <label class="field"><span>New password</span><input class="input" type="password" name="p1" minlength="8" required autocomplete="new-password"></label>
      <label class="field"><span>Repeat new password</span><input class="input" type="password" name="p2" minlength="8" required autocomplete="new-password"></label>
      <p class="hint">At least 8 characters.</p>
      <div class="sactions"><button type="button" class="btn" data-x>Cancel</button><button class="btn primary">Update password</button></div>
    </form>`);
  $$("[data-x]").forEach(b => b.onclick = closeSheet);
  $("#pwf").onsubmit = async e => {
    e.preventDefault(); const f = e.target;
    if (f.p1.value !== f.p2.value) return toast("Passwords don't match.", true);
    const { error } = await sb.auth.updateUser({ password: f.p1.value });
    if (error) return toast(cleanErr(error), true);
    closeSheet(); toast("Password updated");
  };
}

/* ================= clocks ================= */
function tick() {
  $$("[data-live]").forEach(el => {
    const t = S.tasks.get(el.dataset.live); if (!t) return;
    const txt = fmtSecs(liveSpent(t), true);
    if (el.classList.contains("clock")) el.textContent = txt; else if (t.timer_started_at) el.innerHTML = `${I.clock} ${txt}`;
  });
}
function minuteTick() {
  if (S.view !== "reports") safeRender();
  if (!S.me) return;
  const now = Date.now();
  for (const t of S.tasks.values()) {
    if (t.assignee !== S.me.id || t.progress >= 100 || S.notified.has(t.id)) continue;
    const left = dueAt(t) - now;
    if (left > 0 && left <= 15 * 60e3) {
      S.notified.add(t.id);
      toast(`“${t.title}” is due in ${fmtDur(left)}`);
      try { if (Notification.permission === "granted") new Notification("Task due soon", { body: `${t.title} · due ${fmtTime(t.due_time)}` }); } catch { }
    }
  }
}

boot();
})();