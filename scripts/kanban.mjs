#!/usr/bin/env node
/**
 * Kanban CLI. Source of truth: kanban/tasks.json. Generates kanban/index.html
 * (self-contained, opens from file://) and mirrors tasks to GitHub Issues.
 *
 *   node scripts/kanban.mjs add --title "..." --milestone M1 --role developer [--status todo] [--desc "..."]
 *   node scripts/kanban.mjs move T-012 doing [--by developer-1]
 *   node scripts/kanban.mjs note T-012 "Implemented travel tick; 14 tests passing"
 *   node scripts/kanban.mjs list [--milestone M1] [--status doing]
 *   node scripts/kanban.mjs milestone M1 active|done|planned
 *   node scripts/kanban.mjs build            # regenerate kanban/index.html
 *   node scripts/kanban.mjs sync             # create/close GitHub issues via gh
 *   node scripts/kanban.mjs open             # build and open in default browser
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'kanban', 'tasks.json');
const HTML = path.join(ROOT, 'kanban', 'index.html');
const STATUSES = ['backlog', 'todo', 'doing', 'review', 'done', 'blocked'];
const ROLES = ['program-manager', 'developer', 'tester', 'designer', 'writer', 'graphics', 'sound'];

const load = () => JSON.parse(readFileSync(DATA, 'utf8'));
const save = (db) => {
  db.updated = new Date().toISOString();
  writeFileSync(DATA, JSON.stringify(db, null, 2) + '\n');
};
const now = () => new Date().toISOString();

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else flags[key] = true;
    } else positional.push(a);
  }
  return { positional, flags };
}

function nextId(db) {
  const max = db.tasks.reduce((m, t) => Math.max(m, Number(t.id.split('-')[1])), 0);
  return `T-${String(max + 1).padStart(3, '0')}`;
}

function findTask(db, id) {
  const t = db.tasks.find((x) => x.id === id);
  if (!t) throw new Error(`No task ${id}`);
  return t;
}

const commands = {
  add({ flags }) {
    const db = load();
    if (!flags.title || !flags.milestone || !flags.role) throw new Error('add needs --title --milestone --role');
    if (!ROLES.includes(flags.role)) throw new Error(`role must be one of ${ROLES.join(', ')}`);
    if (!db.milestones.some((m) => m.id === flags.milestone)) throw new Error(`unknown milestone ${flags.milestone}`);
    const status = flags.status ?? 'backlog';
    if (!STATUSES.includes(status)) throw new Error(`status must be one of ${STATUSES.join(', ')}`);
    const task = {
      id: flags.id ?? nextId(db),
      title: flags.title,
      desc: flags.desc ?? '',
      milestone: flags.milestone,
      role: flags.role,
      status,
      assignee: flags.assignee ?? null,
      issue: null,
      created: now(),
      updated: now(),
      notes: [],
    };
    db.tasks.push(task);
    save(db);
    console.log(`${task.id} added (${task.status})`);
    return db;
  },
  move({ positional, flags }) {
    const [id, status] = positional;
    if (!STATUSES.includes(status)) throw new Error(`status must be one of ${STATUSES.join(', ')}`);
    const db = load();
    const t = findTask(db, id);
    const from = t.status;
    t.status = status;
    t.updated = now();
    if (flags.by) t.assignee = flags.by;
    t.notes.push({ ts: now(), by: flags.by ?? t.assignee ?? 'pm', text: `${from} -> ${status}` });
    save(db);
    console.log(`${id}: ${from} -> ${status}`);
    return db;
  },
  note({ positional, flags }) {
    const [id, ...rest] = positional;
    const text = rest.join(' ');
    if (!text) throw new Error('note needs text');
    const db = load();
    const t = findTask(db, id);
    t.notes.push({ ts: now(), by: flags.by ?? t.assignee ?? 'pm', text });
    t.updated = now();
    save(db);
    console.log(`${id}: note added`);
    return db;
  },
  list({ flags }) {
    const db = load();
    const rows = db.tasks.filter(
      (t) => (!flags.milestone || t.milestone === flags.milestone) && (!flags.status || t.status === flags.status),
    );
    for (const t of rows) {
      const who = t.assignee ? `  [${t.assignee}]` : '';
      console.log(`${t.id}  ${t.status.padEnd(8)} ${t.milestone}  ${t.role.padEnd(16)} ${t.title}${who}`);
    }
    console.log(`${rows.length} task(s)`);
  },
  milestone({ positional }) {
    const [id, status] = positional;
    const db = load();
    const m = db.milestones.find((x) => x.id === id);
    if (!m) throw new Error(`unknown milestone ${id}`);
    m.status = status;
    save(db);
    console.log(`${id}: ${status}`);
    return db;
  },
  build() {
    const db = load();
    writeFileSync(HTML, renderHtml(db));
    console.log(`wrote ${path.relative(ROOT, HTML)}`);
  },
  open() {
    commands.build();
    const opener =
      process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '', HTML]]
        : process.platform === 'darwin'
          ? ['open', [HTML]]
          : ['xdg-open', [HTML]];
    execFileSync(opener[0], opener[1], { stdio: 'ignore' });
  },
  sync({ flags }) {
    const db = load();
    const repo = flags.repo ?? db.repo;
    if (!repo) throw new Error('sync needs --repo owner/name or repo in tasks.json');
    const gh = (args) => execFileSync('gh', args, { encoding: 'utf8' }).trim();
    // Ensure labels exist (idempotent).
    const labels = [
      ...ROLES.map((r) => [`role:${r}`, 'c5def5']),
      ...db.milestones.map((m) => [`milestone:${m.id}`, 'fbca04']),
    ];
    for (const [name, color] of labels) {
      try {
        gh(['label', 'create', name, '--repo', repo, '--color', color, '--force']);
      } catch {
        /* label exists or offline; ignore */
      }
    }
    let changed = false;
    for (const t of db.tasks) {
      if (t.issue === null && t.status !== 'backlog') {
        const body = `${t.desc || '(no description)'}\n\nMilestone: ${t.milestone}\nRole: ${t.role}\n\nTracked in kanban/tasks.json as ${t.id}.`;
        const url = gh([
          'issue', 'create', '--repo', repo,
          '--title', `[${t.id}] ${t.title}`,
          '--body', body,
          '--label', `role:${t.role},milestone:${t.milestone}`,
        ]);
        t.issue = Number(url.split('/').pop());
        t.issueClosed = false;
        changed = true;
        console.log(`${t.id} -> issue #${t.issue}`);
      }
      if (t.issue !== null && t.status === 'done' && !t.issueClosed) {
        const last = t.notes.filter((n) => !n.text.includes('->')).pop();
        gh(['issue', 'close', String(t.issue), '--repo', repo, '--comment', last ? last.text : 'Done.']);
        t.issueClosed = true;
        changed = true;
        console.log(`${t.id} -> closed #${t.issue}`);
      }
    }
    if (changed) save(db);
    else console.log('nothing to sync');
  },
};

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

const ROLE_COLOR = {
  'program-manager': '#f1c40f',
  developer: '#3498db',
  tester: '#2ecc71',
  designer: '#9b59b6',
  writer: '#e67e22',
  graphics: '#e74c3c',
  sound: '#1abc9c',
};

const CSS = `
:root{--bg:#0d1117;--panel:#161b22;--line:#30363d;--fg:#e6edf3;--muted:#8b949e;--accent:#5cff5c}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.4 system-ui,Segoe UI,sans-serif}
header.top{display:flex;flex-wrap:wrap;gap:12px 24px;align-items:center;padding:14px 20px;border-bottom:1px solid var(--line);background:var(--panel)}
h1{font:700 18px/1 ui-monospace,Consolas,monospace;color:var(--accent);margin:0;letter-spacing:.08em}
.updated{color:var(--muted);font-size:12px}select{background:var(--bg);color:var(--fg);border:1px solid var(--line);border-radius:6px;padding:4px 8px}
.milestones{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:8px;padding:12px 20px}
.ms{display:grid;grid-template-columns:auto 1fr auto auto;grid-template-areas:"id title n status" "bar bar bar bar";gap:4px 10px;align-items:center;background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:8px 12px}
.ms-id{grid-area:id;font-weight:700;font-family:ui-monospace,monospace}.ms-title{grid-area:title;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ms-n{grid-area:n;font-variant-numeric:tabular-nums}.ms-status{grid-area:status;font-size:11px;text-transform:uppercase;color:var(--muted)}
.ms.active .ms-status{color:var(--accent)}.ms.done .ms-status{color:#2ecc71}
.bar{grid-area:bar;height:6px;background:var(--bg);border-radius:3px;overflow:hidden}.bar i{display:block;height:100%;background:var(--accent)}
.board{display:grid;grid-template-columns:repeat(6,minmax(220px,1fr));gap:12px;padding:0 20px 24px;overflow-x:auto}
.col{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:10px;min-height:200px}
.col h3{margin:0 0 10px;font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);display:flex;justify-content:space-between}
.col.doing h3{color:var(--accent)}.col.blocked h3{color:#e74c3c}.col.done h3{color:#2ecc71}
.card{background:var(--bg);border:1px solid var(--line);border-left:4px solid var(--role);border-radius:8px;padding:8px 10px;margin-bottom:8px}
.card header{display:flex;justify-content:space-between;font-size:11px;color:var(--muted);font-family:ui-monospace,monospace}
.card h4{margin:4px 0;font-size:14px;font-weight:600}.desc{margin:0 0 6px;color:var(--muted);font-size:12px}
.card footer{display:flex;gap:8px;font-size:11px;align-items:center}.role{color:var(--role);font-weight:600}.who{color:var(--muted)}.issue{color:#58a6ff;text-decoration:none}
details{margin-top:6px;font-size:11px}summary{cursor:pointer;color:var(--muted)}details ul{margin:4px 0 0;padding-left:14px}time{color:var(--muted);font-family:ui-monospace,monospace}
.card.hide{display:none}
@media (max-width:900px){.board{grid-template-columns:1fr}}
`;

const SCRIPT = `
const fm=document.getElementById('fm'),fr=document.getElementById('fr');
try{fm.value=localStorage.getItem('kb.m')||'';fr.value=localStorage.getItem('kb.r')||'';}catch{}
function apply(){const m=fm.value,r=fr.value;
document.querySelectorAll('.card').forEach(c=>{c.classList.toggle('hide',(m&&c.dataset.m!==m)||(r&&c.dataset.r!==r));});
document.querySelectorAll('.col').forEach(col=>{col.querySelector('h3 span').textContent=col.querySelectorAll('.card:not(.hide)').length;});
try{localStorage.setItem('kb.m',m);localStorage.setItem('kb.r',r);}catch{}}
fm.onchange=fr.onchange=apply;apply();
`;

function renderCard(db, t) {
  const notes = t.notes.length
    ? `<details><summary>${t.notes.length} note${t.notes.length > 1 ? 's' : ''}</summary><ul>` +
      t.notes
        .slice(-8)
        .map((n) => `<li><time>${esc(n.ts.slice(0, 16).replace('T', ' '))}</time> <b>${esc(n.by)}</b> ${esc(n.text)}</li>`)
        .join('') +
      '</ul></details>'
    : '';
  const issue = t.issue
    ? `<a class="issue" href="https://github.com/${esc(db.repo)}/issues/${t.issue}" target="_blank">#${t.issue}</a>`
    : '';
  return `
    <article class="card" data-m="${esc(t.milestone)}" data-r="${esc(t.role)}" style="--role:${ROLE_COLOR[t.role] ?? '#888'}">
      <header><span class="id">${esc(t.id)}</span><span class="m">${esc(t.milestone)}</span></header>
      <h4>${esc(t.title)}</h4>
      ${t.desc ? `<p class="desc">${esc(t.desc)}</p>` : ''}
      <footer><span class="role">${esc(t.role)}</span>${t.assignee ? `<span class="who">${esc(t.assignee)}</span>` : ''}${issue}</footer>
      ${notes}
    </article>`;
}

function renderHtml(db) {
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, db.tasks.filter((t) => t.status === s)]));
  const milestoneBars = db.milestones
    .map((m) => {
      const ts = db.tasks.filter((t) => t.milestone === m.id);
      const done = ts.filter((t) => t.status === 'done').length;
      const pct = ts.length ? Math.round((100 * done) / ts.length) : 0;
      return `<div class="ms ${esc(m.status)}" title="${esc(m.title)}"><span class="ms-id">${esc(m.id)}</span><span class="ms-title">${esc(m.title)}</span><div class="bar"><i style="width:${pct}%"></i></div><span class="ms-n">${done}/${ts.length}</span><span class="ms-status">${esc(m.status)}</span></div>`;
    })
    .join('');
  const options = (vals) => vals.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
  const columns = STATUSES.map(
    (s) => `<section class="col ${s}"><h3>${s}<span>${byStatus[s].length}</span></h3>${byStatus[s].map((t) => renderCard(db, t)).join('')}</section>`,
  ).join('');
  const updated = esc(db.updated.replace('T', ' ').slice(0, 19));
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="30">
<title>Proxima Trail Kanban</title>
<style>${CSS}</style></head><body>
<header class="top"><h1>THE PROXIMA TRAIL &middot; KANBAN</h1>
<label>Milestone <select id="fm"><option value="">all</option>${options(db.milestones.map((m) => m.id))}</select></label>
<label>Role <select id="fr"><option value="">all</option>${options(ROLES)}</select></label>
<span class="updated">updated ${updated} UTC &middot; auto-refreshes every 30s &middot; <a style="color:#58a6ff" href="https://github.com/${esc(db.repo)}">repo</a></span></header>
<section class="milestones">${milestoneBars}</section>
<main class="board">${columns}</main>
<script>${SCRIPT}</script></body></html>`;
}

try {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const [cmd, ...rest] = positional;
  const fn = commands[cmd];
  if (!fn) {
    console.error(`Unknown command "${cmd ?? ''}". Commands: ${Object.keys(commands).join(', ')}`);
    process.exit(2);
  }
  const result = fn({ positional: rest, flags });
  // Any mutation regenerates the HTML so the board is always current.
  if (result && cmd !== 'build') writeFileSync(HTML, renderHtml(result));
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
