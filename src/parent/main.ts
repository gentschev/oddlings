import '../font.css';
import './style.css';
import { startOfflineSupport } from '../platform/offline';
import { offlineStatus } from '../platform/offlineStatus';
import { BUILD_VERSION } from '../platform/version';
import { offlineSettingsText, storageNotice } from './offlineInfo';
import { createSave, exportSave, importSave } from '../core/save';
import type { Save } from '../core/types';
import { copyProgressFromMain, getRestoreStatus, loadSave, storeSave } from '../platform/storage';
import { CHANNEL } from '../platform/channel';
import { homeScreenPromptNeeded } from '../platform/homeScreen';
import { channelCopyControls, homeScreenSection } from './platformInfo';
import { recoveryBanner } from './recovery';
import { LEVELS, parentModel } from './model';
import type { FactView, ParentModel } from './model';

const main = document.querySelector<HTMLElement>('#main')!;
let model: ParentModel;
let pendingImport: Save | null = null;
let busy = false;
let currentSave: Save;
document.querySelector('#build-version')!.textContent = `Build ${BUILD_VERSION}`;
if (CHANNEL === 'next') {
  document.querySelector('#parent-mode')!.textContent = 'Test version';
  document.title = `Test version · ${document.title}`;
}
function showOfflineStatus(): void {
  const line = document.querySelector<HTMLElement>('#offline-status');
  if (!line) return;
  line.textContent = offlineSettingsText(offlineStatus.get()); line.hidden = !line.textContent;
}
offlineStatus.subscribe(showOfflineStatus);

// All imported or saved text is escaped before insertion, including profile names.
function esc(value: string | number): string {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}
function badge(item: { className: string; symbol: string; state: string }): string {
  return `<span class="badge ${item.className}">${item.symbol} ${esc(item.state)}</span>`;
}
function factButton(fact: FactView): string {
  return `<button class="fact-chip ${fact.className}" data-fact="${esc(fact.id)}">${esc(fact.name)} <small>${fact.symbol} ${fact.state}${fact.needsReview ? ' · Needs review' : ''}</small></button>`;
}
function legend(): string {
  return '<div class="legend" aria-label="State key">' + LEVELS.map((state, level) =>
    `<span class="badge state-${level}">${['○', '◐', '✓', '★'][level]} ${state}</span>`).join('') + '<span class="badge review-key">↻ Needs review after a lapse</span></div>';
}
function renderTree(tree: ParentModel['tree']): string {
  return `<div class="scroll" tabindex="0" aria-label="Scrollable skill prerequisite graph">
    <svg class="tree" width="${tree.width}" height="${tree.height}" viewBox="0 0 ${tree.width} ${tree.height}" role="group" aria-label="Skill prerequisites, top to bottom">
      <defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="none" stroke="currentColor"/></marker></defs>
      ${tree.edges.map(e => `<path class="edge ${e.strength}" d="${e.path}" marker-end="url(#arrow)"><title>${esc(e.reason)}</title></path>`).join('')}
      ${tree.nodes.map(n => `<g class="skill ${n.className}" role="button" tabindex="0" data-skill="${n.id}" aria-label="${esc(n.name)}, ${esc(n.codes)}, ${n.state}" aria-controls="skill-detail" aria-expanded="false">
        <rect x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}" rx="16"/>
        <text x="${n.x + 18}" y="${n.y + 30}">${n.lines.map((line, i) => `<tspan x="${n.x + 18}" dy="${i ? 23 : 0}">${esc(line)}</tspan>`).join('')}</text>
        <text class="skill-code" x="${n.x + 18}" y="${n.y + 108}">${esc(n.codes || 'Foundation skill')}</text>
        <text class="skill-state" x="${n.x + 18}" y="${n.y + 130}">${n.symbol} ${n.state}</text>
      </g>`).join('')}
    </svg></div>`;
}
function renderGrid(grid: ParentModel['addition']): string {
  const isAdd = grid.operation === 'add';
  return `<div class="scroll" tabindex="0" aria-label="Scrollable ${isAdd ? 'addition' : 'subtraction'} grid"><table class="fact-grid">
    <caption>${isAdd ? 'Addition: row + column' : 'Subtraction: row − column'}</caption>
    <thead><tr><th scope="col">${isAdd ? '+' : '−'}</th>${grid.columns.map(n => `<th scope="col">${n}</th>`).join('')}</tr></thead>
    <tbody>${grid.rows.map(row => `<tr><th scope="row">${row.number}</th>${row.cells.map(cell => {
      if (!cell.valid) return '<td class="invalid"><span class="sr-only">Negative answer, outside this grid</span></td>';
      if (!cell.fact) return '<td class="outside"><span title="Answer above 10, outside the current curriculum">Outside<br>curriculum</span></td>';
      const f = cell.fact;
      return `<td><button class="grid-cell ${f.className}${f.needsReview ? ' needs-review' : ''}" data-fact="${esc(f.id)}" aria-label="${esc(f.name)}, ${f.state}${f.needsReview ? ', needs review' : ''}" aria-controls="fact-detail">
        <span aria-hidden="true">${f.symbol}</span><small>${f.state}</small>${f.needsReview ? '<small>↻ Needs review</small>' : ''}</button></td>`;
    }).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function renderSessions(vm: ParentModel): string {
  return `<svg class="chart" viewBox="0 0 780 200" role="img" aria-labelledby="chart-title chart-description">
    <title id="chart-title">Questions per day, last 14 days</title>
    <desc id="chart-description">${vm.days.map(d => `${d.date}: ${d.questions}`).join('; ')}. Sessions are assigned to their start date in UTC.</desc>
    <path d="M16 152 H760" class="chart-axis"/>
    ${vm.days.map(d => `<g><title>${d.date}: ${d.questions} questions</title><rect x="${d.x}" y="${d.y}" width="${d.width}" height="${d.height}" rx="4"/><text x="${d.x + 16}" y="${d.y - 8}">${d.questions}</text><text x="${d.x + 16}" y="178">${d.label}</text></g>`).join('')}
    </svg>
    <div class="scroll" tabindex="0" aria-label="Scrollable recent sessions"><table class="sessions"><caption>Last 14 sessions</caption>
      <thead><tr>${['Started (UTC)', 'Minutes', 'Questions', 'First-try accuracy', 'Entered review', 'Became fluent'].map(h => `<th scope="col">${h}</th>`).join('')}</tr></thead>
      <tbody>${vm.sessions.length ? vm.sessions.map(s => `<tr><th scope="row">${esc(s.date)}</th><td>${s.minutes}</td><td>${s.questions}</td><td>${s.accuracy}</td><td>${factList(s.enteredReview)}</td><td>${factList(s.becameFluent)}</td></tr>`).join('') : '<tr><td colspan="6">No sessions yet. Progress will appear after playing.</td></tr>'}</tbody>
    </table></div>`;
}
function factList(names: string[]): string {
  return names.length ? `<details><summary>${names.length} ${names.length === 1 ? 'fact' : 'facts'}</summary><ul>${names.map(name => `<li>${esc(name)}</li>`).join('')}</ul></details>` : 'None';
}
function render(vm: ParentModel): void {
  const restored = getRestoreStatus();
  main.innerHTML = `${recoveryBanner(restored?.date)}<section class="overview" aria-labelledby="overview-title"><p class="eyebrow">A little practice. Real progress.</p><h1 id="overview-title">${esc(vm.name)}’s progress</h1>
    <p class="summary">${esc(vm.summary)}</p><p class="muted">As of ${vm.asOf}. Counts are separate: fluent facts are not counted again as accurate. Provisional placement facts are counted as learning.</p>
    <p class="muted">The 7-day totals include sessions that started in the past 7 days. Minutes use saved session duration. Report dates use UTC.</p>
    <nav aria-label="On this page"><a href="#skills">Skill tree</a><a href="#facts">Fact grids</a><a href="#learning">Being learned now</a><a href="#sessions">Sessions</a><a href="#settings">Settings & data</a></nav></section>
    <section id="skills" aria-labelledby="skills-title"><h2 id="skills-title">The skill tree</h2><p>Tap a skill for its fact sets and curriculum evidence. Arrows point from a prerequisite to the skill it supports.</p>
    ${legend()}<p class="muted">Solid line: hard prerequisite. Dashed line: supporting (soft) prerequisite. Skill levels use the lowest level of all their fact sets, including later areas.</p>
    ${renderTree(vm.tree)}<div id="skill-detail" class="detail" role="region" aria-label="Selected skill" aria-live="polite">Choose a skill above to see more.</div></section>
    <section id="facts" aria-labelledby="facts-title"><h2 id="facts-title">Fact grids</h2><p>Tap a cell to see the saved evidence for that fact. Scroll sideways on smaller screens.</p>${legend()}
      <div id="fact-detail" class="detail" role="region" aria-label="Selected fact history" aria-live="polite">Choose a fact to see its history.</div>
      <details open class="grid-panel"><summary>Addition · 0 to 10</summary>${renderGrid(vm.addition)}</details>
      <details class="grid-panel"><summary>Subtraction · 0 to 20 minus 0 to 10</summary><p>Negative answers are blank. Facts with answers above 10 are outside the current curriculum and are not tracked.</p>${renderGrid(vm.subtraction)}</details>
    </section>
    <section id="learning" aria-labelledby="learning-title"><h2 id="learning-title">Being learned now</h2>
      <h3>Current learning window</h3><div class="fact-chips">${vm.learning.length ? vm.learning.map(factButton).join('') : '<p>No facts in the learning window right now.</p>'}</div>
      ${vm.placement ? `<p><strong>Placement in progress:</strong> ${esc(vm.placement.name)}. The game is finding a comfortable starting point.</p>` : ''}
      <h3>Sets in introduction</h3>${vm.introductions.length ? `<ul class="set-list">${vm.introductions.map(s => `<li><strong>${esc(s.name)}</strong> ${badge(s)}<span>${s.count} facts · ${s.introduction}</span></li>`).join('')}</ul>` : '<p>No sets are currently in introduction.</p>'}
    </section>
    <section id="sessions" aria-labelledby="sessions-title"><h2 id="sessions-title">Recent sessions</h2><p>First-try accuracy counts answers without a hint. Daily question totals are grouped by the session’s start date, using the full session log.</p>${renderSessions(vm)}</section>
    <section id="settings" aria-labelledby="settings-title"><h2 id="settings-title">Settings & data</h2><p>Your save stays on this device. Export a copy before moving to a different browser or device.</p>
      <p id="offline-status" role="status" aria-live="polite" hidden></p>
      <p id="action-status" role="status" aria-live="polite"></p>
      <label class="sound-control"><input id="sound" type="checkbox" ${vm.sound ? 'checked' : ''}/> Sound <span id="sound-label">${vm.sound ? 'on' : 'off'}</span></label>
      <div class="data-actions"><button id="export">Export save as JSON</button><label class="file-label" for="import">Choose a save to import<input id="import" type="file" accept=".json,application/json"/></label></div>
      ${channelCopyControls(CHANNEL)}
      <div id="import-preview" hidden class="detail"></div>
      <details class="reset-panel"><summary>Reset progress</summary><p>This replaces all progress, sessions and settings with a fresh save. Export first if you want to keep a copy.</p><form id="reset-form"><label for="reset-word">Type RESET to enable the reset button</label><input id="reset-word" autocomplete="off" autocapitalize="characters" spellcheck="false"/><button id="reset" class="danger" type="submit" disabled>Reset all progress</button></form></details>
    </section>${homeScreenSection(homeScreenPromptNeeded())}${storageNotice()}`;
  showOfflineStatus();
}
function showStatus(message: string, error = false): void {
  const status = document.querySelector<HTMLElement>('#action-status')!;
  status.textContent = message;
  status.classList.toggle('error', error);
}
function showFact(id: string): void {
  const f = [...model.addition.rows, ...model.subtraction.rows].flatMap(r => r.cells).find(c => c.fact?.id === id)?.fact
    ?? model.learning.find(f => f.id === id);
  if (!f) return;
  const detail = document.querySelector<HTMLElement>('#fact-detail')!;
  detail.innerHTML = `<h3>${esc(f.name)}</h3>${badge(f)} ${f.needsReview ? '<strong>↻ Needs review after a lapse</strong>' : ''}${f.provisional ? '<p>Placement estimate, awaiting individual confirmation.</p>' : ''}
    <dl><div><dt>Times seen</dt><dd>${f.seen}</dd></div><div><dt>First-try accuracy</dt><dd>${f.accuracy}</dd></div><div><dt>Median response time</dt><dd>${f.medianLatency}</dd></div><div><dt>Next review</dt><dd>${f.nextReview}</dd></div><div><dt>Lapses</dt><dd>${f.lapses}</dd></div></dl>
    <p class="muted">The median uses the last five recorded first-try correct timings. Hidden responses and responses over 20 seconds are excluded.</p>
    <h4>Last five responses (newest first)</h4>${f.recentResponses.length ? `<ul>${f.recentResponses.map(r => `<li>${r.date}: ${r.latency} · ${r.result}</li>`).join('')}</ul>` : '<p>No responses in the retained log.</p>'}<p class="muted">The response log keeps the last 2,000 answers across all facts. Lifetime counts remain available.</p>`;
  detail.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function showSkill(id: string): void {
  const skill = model.tree.nodes.find(n => n.id === id);
  if (!skill) return;
  document.querySelectorAll('[data-skill]').forEach(n => n.setAttribute('aria-expanded', String(n.getAttribute('data-skill') === id)));
  const detail = document.querySelector<HTMLElement>('#skill-detail')!;
  detail.innerHTML = `<h3>${esc(skill.name)}</h3>${badge(skill)}<p>${esc(skill.codes)}</p><p>${esc(skill.description)}</p><h4>Evidence of this skill</h4><ul>${skill.evidence.map(e => `<li>${esc(e)}</li>`).join('')}</ul><h4>Fact sets</h4><ul class="set-list">${skill.sets.map(s => `<li><strong>${esc(s.name)}</strong> ${badge(s)}<span>${s.count} facts</span></li>`).join('')}</ul>`;
  detail.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
async function refresh(): Promise<void> {
  currentSave = await loadSave(false);
  model = parentModel(currentSave, Date.now());
  render(model);
}
async function writeSave(next: Save, message: string): Promise<void> {
  await storeSave(next);
  currentSave = next;
  pendingImport = null;
  model = parentModel(next, Date.now());
  render(model);
  showStatus(message);
  document.querySelector('#settings')!.scrollIntoView({ block: 'start' });
}
async function action(run: () => Promise<void>): Promise<void> {
  if (busy) return;
  busy = true;
  main.setAttribute('aria-busy', 'true');
  main.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button, input').forEach(el => { el.disabled = true; });
  try { await run(); }
  catch (error) { showStatus(`Could not complete this action. ${error instanceof Error ? error.message : 'Please try again.'}`, true); }
  finally {
    busy = false;
    main.removeAttribute('aria-busy');
    main.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button, input').forEach(el => { el.disabled = false; });
    updateReset();
  }
}
function updateReset(): void {
  const word = document.querySelector<HTMLInputElement>('#reset-word');
  const button = document.querySelector<HTMLButtonElement>('#reset');
  if (button) button.disabled = busy || word?.value !== 'RESET';
}
main.addEventListener('click', event => {
  if (busy) return;
  const target = (event.target as Element).closest<HTMLElement>('[data-fact], [data-skill], button');
  if (!target) return;
  if (target.dataset.fact) showFact(target.dataset.fact);
  if (target.dataset.skill) showSkill(target.dataset.skill);
  if (CHANNEL === 'next' && target.id === 'copy-main') document.querySelector<HTMLElement>('#copy-main-preview')!.hidden = false;
  if (CHANNEL === 'next' && target.id === 'cancel-copy-main') document.querySelector<HTMLElement>('#copy-main-preview')!.hidden = true;
  if (CHANNEL === 'next' && target.id === 'confirm-copy-main') void action(async () => {
    document.querySelector<HTMLElement>('#copy-main-preview')!.hidden = true;
    const copied = await copyProgressFromMain();
    if (!copied) { showStatus('There is no progress to copy from the main game.'); return; }
    await refresh(); showStatus('Progress copied from the main game. The main game was not changed.');
    document.querySelector('#settings')!.scrollIntoView({ block: 'start' });
  });
  if (target.id === 'export') void action(async () => {
    const latest = await loadSave(false);
    const url = URL.createObjectURL(new Blob([exportSave(latest)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = model.exportFilename;
    document.body.append(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showStatus('Save exported. Keep the JSON file somewhere safe.');
  });
  if (target.id === 'cancel-import') {
    pendingImport = null;
    document.querySelector<HTMLElement>('#import-preview')!.hidden = true;
    document.querySelector<HTMLInputElement>('#import')!.value = '';
    showStatus('Import cancelled.');
  }
  if (target.id === 'confirm-import' && pendingImport) {
    const next = pendingImport;
    void action(() => writeSave(next, 'Save imported.'));
  }
});
main.addEventListener('keydown', event => {
  const target = (event.target as Element).closest<HTMLElement>('[data-skill]');
  if (!busy && target && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); showSkill(target.dataset.skill!); }
});
main.addEventListener('input', updateReset);
main.addEventListener('change', event => {
  const input = event.target as HTMLInputElement;
  if (busy) return;
  if (input.id === 'sound') {
    const enabled = input.checked;
    void action(async () => {
      const latest = await loadSave(false);
      latest.settings.sound = enabled;
      await storeSave(latest);
      currentSave = latest;
      model = parentModel(latest, Date.now());
      document.querySelector('#sound-label')!.textContent = enabled ? 'on' : 'off';
      showStatus(`Sound ${enabled ? 'on' : 'off'}.`);
    }).then(() => { input.checked = model.sound; });
  }
  if (input.id === 'import') {
    const file = input.files?.[0];
    pendingImport = null;
    document.querySelector<HTMLElement>('#import-preview')!.hidden = true;
    if (!file) return;
    void action(async () => {
      const candidate = importSave(await file.text());
      const preview = parentModel(candidate, Date.now());
      pendingImport = candidate;
      const panel = document.querySelector<HTMLElement>('#import-preview')!;
      panel.innerHTML = `<h3>Review this import</h3><p>File: ${esc(file.name)}</p><p>${esc(preview.name)}</p><p>${esc(preview.summary)}</p><p>Importing replaces the current save on this device, including progress and settings. Close the game in other tabs before replacing its save.</p><button id="confirm-import" class="danger">Replace current save</button><button id="cancel-import">Cancel</button>`;
      panel.hidden = false;
      showStatus('Save validated. Review it below before replacing your progress.');
    });
  }
});
main.addEventListener('submit', event => {
  if ((event.target as HTMLElement).id !== 'reset-form') return;
  event.preventDefault();
  if (!busy && document.querySelector<HTMLInputElement>('#reset-word')!.value === 'RESET') {
    void action(() => writeSave(createSave(), 'Progress reset. A fresh save is ready.'));
  }
});
void refresh().then(() => startOfflineSupport(Promise.resolve(), () => currentSave)).catch(() => {
  main.innerHTML = '<p role="alert">Could not load progress. Please reload the page.</p>';
});
