'use strict';
/* ==========================================================================
   万象工坊 · 界面层
   ========================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clone = (o) => JSON.parse(JSON.stringify(o));
const STORE = {
  get(k) { try { const v = localStorage.getItem('realmforge:v1:' + k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem('realmforge:v1:' + k, JSON.stringify(v)); } catch (e) { /* 存储不可用时静默 */ } },
};
const SHORT = { zh: { gravity: '重力', time: '时间', space: '空间', entropy: '熵律', aether: '灵能', anomaly: '异常', causality: '因果', mind: '心念' }, en: { gravity: 'Grav', time: 'Time', space: 'Space', entropy: 'Entropy', aether: 'Aether', anomaly: 'Anomaly', causality: 'Cause', mind: 'Mind' } };
const state = { tab: 'guide', world: null, char: null, roster: [], events: [], factions: [], frel: [], crel: [], locs: [], routes: [], selLoc: '', selFac: '', netSel: '', net: { f: true, c: true, m: true }, sim: { mode: 'duel', a: '__current', b: '__random', opp: null, res: null, loc: '', squad: { a: [], b: [] } } };
const reduceMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

function validChar(c) { return !!(c && c.seed && c.attrs && c.abilities && c.abilities.length >= 4 && SYSTEMS[c.system] && ORIGIN_BY_ID[c.origin] && c.persona && c.look && c.bg && c.nonce && ARCH_BY_ID[c.archetype]); }
function validWorld(w) { return !!(w && w.dials && DIALS.every((d) => typeof w.dials[d.id] === 'number')); }
let toastTimer;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 1800); }

/* ---------- SVG：量规、雷达、印记、三角、时间线 ---------- */
function gaugeHTML({ min = 0, max = 100, value, mode = 'fill', base = 0, attrs = '', label = '', tone = '' }) {
  const f = (value - min) / (max - min);
  const a = mode === 'dev' ? Math.min(f, base) : 0, b = mode === 'dev' ? Math.max(f, base) : f;
  return `<div class="gauge" data-mode="${mode}" data-tone="${tone}" data-base="${base}" style="--a:${a};--b:${b};--base:${base}"><span class="trk"></span>${mode === 'dev' ? '<span class="tick"></span>' : ''}<span class="fill"></span><input type="range" min="${min}" max="${max}" step="1" value="${value}" ${attrs} aria-label="${esc(label)}"></div>`;
}
function syncGauge(g) {
  const i = g.querySelector('input'), min = +i.min, max = +i.max, f = (+i.value - min) / (max - min), base = +g.dataset.base || 0, dev = g.dataset.mode === 'dev';
  g.style.setProperty('--a', dev ? Math.min(f, base) : 0); g.style.setProperty('--b', dev ? Math.max(f, base) : f);
}

function radarSVG(vals, labels, max, opts = {}) {
  const size = opts.size || 300, pad = opts.pad || 46, c = size / 2, R = size / 2 - pad, n = vals.length, ink = opts.ink ? ' ink' : '';
  const pt = (i, v) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [c + R * v / max * Math.cos(a), c + R * v / max * Math.sin(a)]; };
  const ring = (f) => Array.from({ length: n }, (_, i) => pt(i, max * f).map((x) => x.toFixed(1)).join(',')).join(' ');
  let s = `<svg viewBox="0 0 ${size} ${size}" class="radar" role="img" aria-label="${esc(opts.aria || T('雷达图', 'Radar chart'))}">`;
  [0.25, 0.5, 0.75, 1].forEach((f) => { s += `<polygon class="rd-grid${f === 1 ? ' base' : ''}" points="${ring(f)}"/>`; });
  for (let i = 0; i < n; i++) { const [x, y] = pt(i, max); s += `<line class="rd-axis" x1="${c}" y1="${c}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`; }
  const pts = vals.map((v, i) => pt(i, clamp(v, 0, max)).map((x) => x.toFixed(1)).join(',')).join(' ');
  s += `<polygon class="rd-area${ink}" points="${pts}"/>`;
  vals.forEach((v, i) => { const [x, y] = pt(i, clamp(v, 0, max)); s += `<circle class="rd-dot${ink}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3"/>`; });
  labels.forEach((l, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; s += `<text class="rd-label" x="${(c + (R + pad * 0.42) * Math.cos(a)).toFixed(1)}" y="${(c + (R + pad * 0.42) * Math.sin(a) + 4).toFixed(1)}">${esc(l)}</text>`; });
  return s + '</svg>';
}
function drawRadar(el, vals, labels, max, opts) { if (el._raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(el._raf); el._vals = vals; el.innerHTML = radarSVG(vals, labels, max, opts); }
function animateRadar(el, to, labels, max, opts) {
  const from = el._vals || to.map(() => 0);
  if (reduceMotion() || typeof requestAnimationFrame !== 'function') { drawRadar(el, to, labels, max, opts); return; }
  if (el._raf) cancelAnimationFrame(el._raf);
  el._vals = to;
  const t0 = performance.now(), dur = 460;
  const step = (now) => {
    const t = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - t, 3);
    el.innerHTML = radarSVG(from.map((v, i) => v + (to[i] - v) * e), labels, max, opts);
    if (t < 1) el._raf = requestAnimationFrame(step);
  };
  el._raf = requestAnimationFrame(step);
}

function sigilSVG(ch) {
  const r = makeRng(ch.seed + '|sigil'), n = [3, 4, 5, 6, 7, 8, 9][r.int(0, 6)], rot = r.range(0, Math.PI * 2), rings = 1 + Math.round(ch.tier / 3);
  const P = (rad, ang) => [60 + rad * Math.cos(ang), 60 + rad * Math.sin(ang)];
  const f1 = (v) => v.toFixed(1);
  const poly = (rad, k, off) => Array.from({ length: k }, (_, i) => P(rad, off + i * 2 * Math.PI / k).map(f1).join(',')).join(' ');
  let s = `<circle cx="60" cy="60" r="56" class="sg-a"/>`;
  for (let i = 0; i < rings; i++) s += `<circle cx="60" cy="60" r="${48 - i * 7}" class="${i % 2 ? 'sg-b' : 'sg-a'}"/>`;
  const tk = n * r.int(2, 4);
  for (let i = 0; i < tk; i++) { const a = rot + i * 2 * Math.PI / tk, p1 = P(56, a), p2 = P(51, a); s += `<line class="sg-a" x1="${f1(p1[0])}" y1="${f1(p1[1])}" x2="${f1(p2[0])}" y2="${f1(p2[1])}"/>`; }
  s += `<polygon class="sg-a" points="${poly(34, n, rot)}"/>`;
  if (n >= 5) { const k = n % 2 ? 2 : (n % 3 ? 3 : 1); s += `<polygon class="sg-b" points="${Array.from({ length: n }, (_, i) => P(34, rot + (i * k % n) * 2 * Math.PI / n).map(f1).join(',')).join(' ')}"/>`; }
  for (let i = 0; i < n; i++) { const p = P(34, rot + i * 2 * Math.PI / n); s += `<circle class="sg-f" cx="${f1(p[0])}" cy="${f1(p[1])}" r="2.2"/>`; }
  if (ch.system === 'magic') s += `<polygon class="sg-a" points="${poly(13, 3, rot)}"/><polygon class="sg-a" points="${poly(13, 3, rot + Math.PI)}"/>`;
  else if (ch.system === 'anomaly') s += `<circle class="sg-a" cx="60" cy="60" r="11"/><circle class="sg-b" cx="64" cy="57" r="11"/>`;
  else if (ch.system === 'psi') s += `<circle class="sg-a" cx="60" cy="60" r="5"/><circle class="sg-b" cx="60" cy="60" r="10"/><circle class="sg-a" cx="60" cy="60" r="15" style="stroke-dasharray:6 4"/>`;
  else s += `<polygon class="sg-a" points="60,44 50,62 70,62"/><line class="sg-a" x1="46" y1="68" x2="74" y2="68"/><circle class="sg-f" cx="60" cy="56" r="2"/>`;
  return `<svg class="sigil" viewBox="0 0 120 120" role="img" aria-label="${esc(T(`${ch.name}的印记`, `${ch.name}'s sigil`))}">${s}</svg>`;
}

function triangleSVG() {
  const N = { magic: [180, 52], anomaly: [316, 252], psi: [44, 252] }, R = 38, C = [180, 186];
  const pairs = [['magic', 'anomaly'], ['anomaly', 'psi'], ['psi', 'magic']];
  let s = `<svg viewBox="0 0 360 310" role="img" aria-label="${esc(T('魔法克制异常，异常克制超能力，超能力克制魔法，权能位于中央', 'Magic counters Anomaly, Anomaly counters Psionics, Psionics counters Magic; Dominion sits at the center'))}"><defs><marker id="arw" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" class="tri-h"/></marker></defs>`;
  Object.keys(N).forEach((k) => { s += `<line class="tri-d" x1="${C[0]}" y1="${C[1]}" x2="${N[k][0]}" y2="${N[k][1]}"/>`; });
  pairs.forEach(([a, b]) => {
    const p = N[a], q = N[b], dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
    const s0 = [p[0] + ux * (R + 6), p[1] + uy * (R + 6)], e0 = [q[0] - ux * (R + 12), q[1] - uy * (R + 12)];
    s += `<line class="tri-l" x1="${s0[0].toFixed(1)}" y1="${s0[1].toFixed(1)}" x2="${e0[0].toFixed(1)}" y2="${e0[1].toFixed(1)}" marker-end="url(#arw)"/>`;
    const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, nx = mx - C[0], ny = my - C[1], nl = Math.hypot(nx, ny);
    s += `<text class="tri-s" x="${(mx + nx / nl * 18).toFixed(1)}" y="${(my + ny / nl * 18 + 4).toFixed(1)}" text-anchor="middle">×1.25</text>`;
  });
  Object.keys(N).forEach((k) => { s += `<circle class="tri-n" cx="${N[k][0]}" cy="${N[k][1]}" r="${R}" style="stroke:var(--${k})"/><text class="tri-t" x="${N[k][0]}" y="${N[k][1] + 5}" text-anchor="middle" style="fill:var(--${k})">${tf(SYSTEMS[k].name)}</text>`; });
  s += `<circle class="tri-n" cx="${C[0]}" cy="${C[1]}" r="27" style="stroke:var(--dominion)"/><text class="tri-t" x="${C[0]}" y="${C[1] + 5}" text-anchor="middle" style="fill:var(--dominion)">${tf(SYSTEMS.dominion.name)}</text><text class="tri-s" x="${C[0]}" y="${C[1] + 46}" text-anchor="middle">${T('对三者 ×1.15，受戒律约束', '×1.15 vs. all three, bound by precept')}</text></svg>`;
  return s;
}

function timelineSVG(tl) {
  const W = 560, H = 176, L = 38, Rr = 12, TT = 12, B = 26, n = tl.length;
  const x = (i) => L + (W - L - Rr) * (n === 1 ? 0 : i / (n - 1)), y = (v) => TT + (H - TT - B) * (1 - v);
  const path = (k) => tl.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p[k]).toFixed(1)}`).join(' ');
  let s = `<svg viewBox="0 0 ${W} ${H}" class="tl" role="img" aria-label="${esc(T('双方生存率随回合变化的折线图', 'Line chart of both sides\' survival rate over rounds'))}">`;
  [0, 0.5, 1].forEach((v) => { s += `<line class="g" x1="${L}" x2="${W - Rr}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text x="${L - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${Math.round(v * 100)}%</text>`; });
  const step = Math.max(1, Math.ceil(n / 8));
  for (let i = 0; i < n; i += step) s += `<text x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="middle">${i}</text>`;
  s += `<text x="${W - Rr}" y="${H - 8}" text-anchor="end" style="opacity:0">${T('回合', 'round')}</text><path class="la" d="${path(0)}"/><path class="lb" d="${path(1)}"/></svg>`;
  return s;
}

/* ==========================================================================
   世界
   ========================================================================== */
function currentPreset() { return PRESETS.find((p) => DIALS.every((d) => p.d[d.id] === state.world.dials[d.id])); }
function presetChips(id) {
  const cur = currentPreset();
  $(id).innerHTML = PRESETS.map((p) => `<button class="chip" type="button" data-preset="${p.id}" aria-pressed="${!!cur && cur.id === p.id}" title="${esc(tf(p.note))}">${esc(tf(p.name))}</button>`).join('');
}
function buildDials() {
  const groups = [['phys', T('物理常数', 'Physical Constants'), T('重力与时间以 50 为常态，其余以 0 为常态；偏离越远，世界越不正常。', 'Gravity and Time are neutral at 50; the rest are neutral at 0. The further from neutral, the less mundane the world.')], ['anom', T('异象浓度', 'Anomalous Density'), T('驱动魔法、异常、超能力与权能的世界级燃料。', 'The world-level fuel driving Magic, Anomaly, Psionics, and Dominion.')]];
  $('#dials').innerHTML = groups.map(([g, t, s]) => `<div class="dial-group"><h4>${t}</h4><p>${s}</p>` + DIALS.filter((d) => d.group === g).map((d) => {
    const v = state.world.dials[d.id];
    return `<div class="dial" data-dial-row="${d.id}"><div class="dial-h"><b>${tf(d.name)}</b><span class="ro" data-ro="${d.id}"></span></div>${gaugeHTML({ value: v, mode: 'dev', base: d.center ? 0.5 : 0, attrs: `data-dial="${d.id}"`, label: tf(d.name) })}<div class="dial-f"><span>${tf(d.lo)}</span><span>${tf(d.hi)}</span></div><p class="hint">${tf(d.hint)}</p></div>`;
  }).join('') + '</div>').join('');
}
function syncDials() {
  DIALS.forEach((d) => { const i = $(`[data-dial="${d.id}"]`); if (i) { i.value = state.world.dials[d.id]; syncGauge(i.closest('.gauge')); } });
  $('#worldName').value = state.world.name;
}
function renderWorldAll(animate) {
  const w = state.world, d = w.dials, m = worldMods(w), idx = m.index, lab = abnLabel(idx);
  const vals = devVector(w), labels = DIALS.map((x) => SHORT[LANG][x.id]);
  DIALS.forEach((dl) => {
    const ro = $(`[data-ro="${dl.id}"]`); if (ro) ro.textContent = dialReadout(dl.id, d[dl.id]);
    const row = $(`[data-dial-row="${dl.id}"]`); if (row) row.classList.toggle('off', devOf(dl, d[dl.id]) >= 25);
  });
  const opts = { aria: T('八个法则旋钮偏离常识物理的程度', 'How far the eight law dials deviate from mundane physics'), size: 300 };
  if (animate) { animateRadar($('#heroRadar'), vals, labels, 100, opts); animateRadar($('#worldRadar'), vals, labels, 100, opts); }
  else { drawRadar($('#heroRadar'), vals, labels, 100, opts); drawRadar($('#worldRadar'), vals, labels, 100, opts); }
  const idxTxt = Math.round(idx);
  ['#heroIdx', '#worldIdx', '#tbIndex'].forEach((s) => { $(s).textContent = idxTxt; });
  $('#heroLab').textContent = lab; $('#abnLabel').textContent = lab;
  ['#heroWorld', '#tbWorld'].forEach((s) => { $(s).textContent = w.name || T('未命名世界', 'Unnamed World'); });
  const desc = describeWorld(w); $('#heroDesc').textContent = desc; $('#worldDesc').textContent = desc;

  const cols = { magic: 'magic', anomaly: 'anomaly', psi: 'psi', dominion: 'dominion' };
  $('#mods').className = 'mods';
  $('#mods').innerHTML = SYS_IDS.map((k) => { const v = m.sys[k]; return `<div class="mod c-${cols[k]}"><span class="nm">${tf(SYSTEMS[k].name)}</span><div class="mini"><i style="width:${clamp(v / 1.9 * 100, 2, 100).toFixed(1)}%"></i><u></u></div><span class="mv">×${v.toFixed(2)}</span></div>`; }).join('');
  $('#worldStats').innerHTML = [
    T(`环境侵蚀 −${m.ambientStb.toFixed(1)} 稳定度/回合`, `Ambient erosion −${m.ambientStb.toFixed(1)} Stability/round`), T(`因果偏转 ${(m.twist * 100).toFixed(0)}%`, `Causal deflection ${(m.twist * 100).toFixed(0)}%`), T(`机动修正 ×${m.mobility.toFixed(2)}`, `Mobility ×${m.mobility.toFixed(2)}`),
    T('反噬率 ', 'Backlash rate ') + SYS_IDS.map((k) => `${tf(SYSTEMS[k].name)} ${(m.backlash(k) * 100).toFixed(0)}%`).join(' / '),
  ].map((t) => `<span class="tag">${t}</span>`).join('');
  const act = PHENOMENA.filter((p) => p.on(d));
  $('#phen').innerHTML = act.length ? act.map((p) => `<li><b>${tf(p.name)}</b><p>${tf(p.desc)}</p></li>`).join('') : `<li class="none">${T('目前没有明显的异象，这是一个平静得有点无聊的世界。', 'No notable phenomena right now — a world calm enough to be a little boring.')}</li>`;
  $('#phenCount').textContent = act.length ? T(`${act.length} 项生效`, `${act.length} active`) : T('无', 'None');
  presetChips('#presets'); presetChips('#heroPresets');
  renderSimHeader();
  if (state.tab === 'char') renderWorldNote();
}
function setWorld(w, animate) { state.world = w; STORE.set('world', w); syncDials(); renderWorldAll(animate); }
function renderEvents() {
  $('#evlog').innerHTML = state.events.map((e) => `<li><b>${e.sev}${e.name}</b>${esc(e.text)}</li>`).join('');
}
function rollEvent() {
  const d = state.world.dials, act = PHENOMENA.filter((p) => p.on(d)), idx = abnormality(state.world);
  if (!act.length) state.events.unshift({ sev: '', name: T('平静', 'Calm'), text: T('街道上什么也没有发生。在这样的世界里，这本身就有点不对劲。', 'Nothing happens on the streets. In a world like this, that itself feels a little off.') });
  else {
    const p = act[Math.floor(Math.random() * act.length)];
    const sevBank = tb(SEVERITY), sev = sevBank[clamp(Math.floor(idx / 25 + Math.random() * 1.6), 0, 3)];
    const places = tb(PLACES);
    state.events.unshift({ sev: T(sev, sev + ' · '), name: tf(p.name), text: tf(p.ev).replace('{place}', places[Math.floor(Math.random() * places.length)]) });
  }
  state.events = state.events.slice(0, 5); renderEvents();
}

/* ==========================================================================
   总览页的静态生成部分
   ========================================================================== */
function renderGuideStatic() {
  const dt = (zh, en) => T(zh, en);
  $('#sysCards').innerHTML = SYS_IDS.map((k) => {
    const s = SYSTEMS[k];
    return `<article class="sys c-${k}"><h3>${tf(s.name)}<small>${tf(s.tag)}</small></h3><p>${tf(s.summary)}</p><dl class="kv">
      <div><dt>${dt('力量来源', 'Source')}</dt><dd>${tf(s.source)}</dd></div><div><dt>${dt('代价', 'Cost')}</dt><dd>${tf(s.cost)}</dd></div><div><dt>${dt('限制', 'Limit')}</dt><dd>${tf(s.limit)}</dd></div>
      <div><dt>${dt('失控', 'Backlash')}</dt><dd>${tf(s.backlash)}</dd></div><div><dt>${dt('长处', 'Strength')}</dt><dd>${tf(s.strong)}</dd></div><div><dt>${dt('短板', 'Weakness')}</dt><dd>${tf(s.weak)}</dd></div>
      <div><dt>${dt('依赖旋钮', 'Key Dial')}</dt><dd>${tf(s.dial)}</dd></div><div><dt>${dt('主属性', 'Main Stat')}</dt><dd>${T(`${tf(s.powerStat)}，资源名为「${tf(s.resource)}」`, `${tf(s.powerStat)}; resource is called "${tf(s.resource)}"`)}</dd></div></dl></article>`;
  }).join('');
  $('#triangle').innerHTML = triangleSVG();
  $('#tierTable').innerHTML = `<thead><tr><th>${dt('位阶', 'Tier')}</th><th>${dt('称谓', 'Title')}</th><th>${dt('大致含义', 'Meaning')}</th><th>${dt('解锁的能力域', 'Domains Unlocked')}</th></tr></thead><tbody>` + TIERS.slice(1).map((t, i) => {
    const tier = i + 1, doms = DOMAINS.filter((d) => d.minTier === tier).map((d) => tf(d.name)).join(T('、', ', '));
    return `<tr><td class="n">${tier}</td><td>${tf(t.n)}</td><td>${tf(t.d)}</td><td>${doms || T('（沿用已解锁的域）', '(carries over already-unlocked domains)')}</td></tr>`;
  }).join('') + '</tbody>';
}

/* ==========================================================================
   角色
   ========================================================================== */
function buildCharControls() {
  $('#tierGauge').innerHTML = gaugeHTML({ min: 1, max: 9, value: state.char.tier, attrs: 'data-k="tier"', label: T('位阶', 'Tier') });
  $('#sysPick').innerHTML = SYS_IDS.map((k) => `<button type="button" class="c-${k}" data-sys="${k}" aria-pressed="false"><b>${tf(SYSTEMS[k].name)}</b><span>${tf(SYSTEMS[k].tag)}</span></button>`).join('');
  $('#selOrigin').innerHTML = ORIGINS.map((o) => `<option value="${o.id}">${tf(o.name)}</option>`).join('');
  $('#selArch').innerHTML = ARCHETYPES.map((a) => `<option value="${a.id}">${tf(a.name)}</option>`).join('');
  $('#attrCtl').innerHTML = ATTRS.map((a) => `<div class="arow"><span class="lab" title="${esc(tf(a.d))}">${tf(a.n)}</span>${gaugeHTML({ min: 1, max: 20, value: 10, attrs: `data-attr="${a.k}"`, label: tf(a.n) })}<span class="val" data-val="${a.k}"></span></div>`).join('');
  $('#personaCtl').innerHTML = BIG5.map((b) => `<div class="prow"><div class="pn"><span>${tf(b.n)}</span><em data-pval="${b.id}"></em></div><div class="arow p"><span class="l">${tf(b.lo)}</span>${gaugeHTML({ min: 0, max: 100, value: 50, mode: 'dev', tone: 'ink', base: 0.5, attrs: `data-persona="${b.id}"`, label: tf(b.n) })}<span class="r">${tf(b.hi)}</span></div></div>`).join('');
}
function refreshAttrVals() {
  const ch = state.char, d = derive(ch), o = ORIGIN_BY_ID[ch.origin];
  ATTR_KEYS.forEach((k) => {
    const mod = o.mods[k] || 0;
    $(`[data-val="${k}"]`).innerHTML = `${d.a[k]}${mod ? `<em>${mod > 0 ? '+' : ''}${mod}</em>` : ''}`;
  });
  const b = $('#budgetLab');
  b.innerHTML = T(`已分配 ${d.used} / ${d.budget}`, `Allocated ${d.used} / ${d.budget}`) + (d.over ? ` <span class="over">${T(`超支 ${d.over}，稳定度上限 −${d.over * 2}`, `Over by ${d.over}: Stability cap −${d.over * 2}`)}</span>` : '');
}
function syncCharControls() {
  const ch = state.char, o = ORIGIN_BY_ID[ch.origin];
  $('#chName').value = ch.name;
  const tg = $('#tierGauge input'); tg.value = ch.tier; syncGauge(tg.closest('.gauge'));
  $('#tierLab').textContent = `${ch.tier}　${tf(TIERS[ch.tier].n)}`; $('#tierDesc').textContent = tf(TIERS[ch.tier].d);
  $$('#sysPick button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.sys === ch.system ? 'true' : 'false'));
  $('#sysDesc').textContent = tf(SYSTEMS[ch.system].summary);
  $('#selOrigin').value = ch.origin; $('#originDesc').textContent = T(`${tf(o.trait.n)}：${tf(o.trait.d)}`, `${tf(o.trait.n)}: ${tf(o.trait.d)}`); $('#selArch').value = ch.archetype;
  ATTR_KEYS.forEach((k) => { const i = $(`[data-attr="${k}"]`); i.value = ch.attrs[k]; syncGauge(i.closest('.gauge')); });
  BIG5.forEach((b) => { const i = $(`[data-persona="${b.id}"]`); i.value = ch.persona[b.id]; syncGauge(i.closest('.gauge')); $(`[data-pval="${b.id}"]`).textContent = ch.persona[b.id]; });
  refreshAttrVals(); fillAffilSelects();
}
function statHTML(v, l, hot) { return `<div class="stat${hot ? ' hot' : ''}"><b class="num">${v}</b><span>${l}</span></div>`; }
function abilityHTML(a) {
  if (a.slot === 'passive') return `<div class="ab"><div class="ab-h"><b>${a.name}</b><span>${tf(SLOT_NAME.passive)}</span></div><p>${a.desc}${T('。', '.')}</p></div>`;
  const dom = DOMAIN_BY_ID[a.domain], eff = EFFECT_BY_ID[a.effect];
  return `<div class="ab"><div class="ab-h"><b>${a.name}</b><span>${tf(SLOT_NAME[a.slot])}${T(`　阶 ${a.rank}`, ` · Rank ${a.rank}`)}</span></div>
    <div class="tags"><span class="tag">${dom ? T(`${tf(dom.name)}域`, `${tf(dom.name)} domain`) : ''}</span><span class="tag">${eff ? tf(eff.name) : ''}</span><span class="tag">${a.form}</span><span class="tag">${a.range}</span></div>
    <p>${T(`${a.desc}。触发方式：${a.trigger}。`, `${a.desc.charAt(0).toUpperCase() + a.desc.slice(1)}. Trigger: ${a.trigger}.`)}</p>${a.cost ? `<div class="cl"><b>${T('代价', 'Cost')}</b>${a.cost}</div>` : ''}${a.limit ? `<div class="cl"><b>${T('限制', 'Limit')}</b>${a.limit}</div>` : ''}</div>`;
}
function renderWorldNote() {
  const el = $('#worldNote'); if (!el) return;
  const ch = state.char, sys = SYSTEMS[ch.system], m = worldMods(state.world), v = m.sys[ch.system];
  const cmt = v >= 1.3 ? T('这里几乎是为这种力量准备的土壤。', 'This place is practically tailor-made for this kind of power.') : v < 0.8 ? T('这里的规则在压制这种力量。', 'The rules here actively suppress this kind of power.') : T('环境对这种力量的影响有限。', 'The environment has little effect on this power.');
  el.innerHTML = T(`在「${esc(state.world.name)}」中，${tf(sys.name)}体系效率为 <b>×${v.toFixed(2)}</b>，环境侵蚀每回合 −${m.ambientStb.toFixed(1)} 稳定度。${cmt}`, `In "${esc(state.world.name)}", the ${tf(sys.name)} system runs at <b>×${v.toFixed(2)}</b> efficiency, with ambient erosion of −${m.ambientStb.toFixed(1)} Stability per round. ${cmt}`);
}
function renderCard() {
  const ch = state.char, d = derive(ch), sys = SYSTEMS[ch.system], o = ORIGIN_BY_ID[ch.origin], tier = TIERS[ch.tier], p = ch.persona;
  const attrRows = ATTRS.map((a) => { const mod = o.mods[a.k] || 0; return `<div class="arow"><span class="lab" title="${esc(tf(a.d))}">${tf(a.n)}</span><div class="mini"><i style="width:${(d.a[a.k] / 24 * 100).toFixed(1)}%"></i></div><span class="val">${d.a[a.k]}${mod ? `<em>${mod > 0 ? '+' : ''}${mod}</em>` : ''}</span></div>`; }).join('');
  const pRows = BIG5.map((b) => `<div class="arow p"><span class="l">${tf(b.lo)}</span><div class="mini"><i style="width:${p[b.id]}%"></i></div><span class="r">${tf(b.hi)}</span></div>`).join('');
  const price = `<dl class="price"><div><dt>${T('体系反噬', 'System Backlash')}</dt><dd>${tf(sys.backlash)}</dd></div><div><dt>${T('弱点', 'Weakness')}</dt><dd>${esc(ch.weakness)}</dd></div>${ch.precept ? `<div><dt>${T('戒律', 'Precept')}</dt><dd>${T(`${ch.precept}（违背即失效）`, `${ch.precept} (breaking it ends the power)`)}</dd></div>` : ''}<div><dt>${T('出身弱点', 'Origin Weakness')}</dt><dd>${tf(o.weak)}</dd></div></dl>`;
  const corrTxt = d.corruption >= 40 ? T('，已相当严重', ' — quite severe') : d.corruption >= 20 ? T('，有可见的改变', ' — visibly altered') : T('，基本无碍', ' — largely harmless');
  $('#charCard').innerHTML = `<div class="panel c-${ch.system}"><div class="panel-h"><h3>${T('角色卡', 'Character Sheet')}</h3><small>${T('种子', 'Seed')} ${esc(ch.seed)}</small></div><div class="body">
    <div class="card-head">${sigilSVG(ch)}<div class="who"><h2>${esc(ch.name)}</h2><p class="ttl">${titleOf(ch)}</p>
      <div class="tags"><span class="tag hue">${tf(sys.name)}</span><span class="tag">${T(`位阶 ${ch.tier} ${tf(tier.n)}`, `Tier ${ch.tier} ${tf(tier.n)}`)}</span><span class="tag">${tf(o.name)}</span><span class="tag">${tf(ARCH_BY_ID[ch.archetype].name)}</span><span class="tag">${alignOf(p)}</span></div></div></div>
    <div class="stats">${vstat(ch, 'hp', d.hp, T('生命', 'HP'))}${vstat(ch, 'en', d.en, tf(sys.resource))}${vstat(ch, 'stb', d.stb, T('稳定度', 'Stability'))}${statHTML(d.init, T('先攻', 'Initiative'))}${statHTML(d.def, T('防御', 'Defense'))}${statHTML(d.score, T('综合战力', 'Power Rating'), true)}</div>
    <div class="worldnote c-${ch.system}" id="worldNote"></div>
    <div class="cblock"><h4>${T('属性', 'Stats')}<small>${T('分配值 + 出身修正', 'Allocated + origin modifier')}</small></h4><div class="attr-split"><div class="radar-wrap">${radarSVG(ATTR_KEYS.map((k) => d.a[k]), ATTRS.map((a) => tf(a.n)), 24, { ink: true, size: 230, pad: 34, aria: T('六维属性雷达图', 'Six-stat radar chart') })}</div><div class="attr-list">${attrRows}</div></div></div>
    <div class="cblock"><h4>${T('构造与出身', 'Physiology & Origin')}<small>${tf(o.name)}</small></h4><dl class="kv"><div><dt>${T('身体构造', 'Body')}</dt><dd>${tf(o.body)}</dd></div><div><dt>${T('先天特质', 'Innate Trait')}</dt><dd><b>${tf(o.trait.n)}</b>${T('：', ': ')}${tf(o.trait.d)}</dd></div><div><dt>${T('异化度', 'Corruption')}</dt><dd>${d.corruption}%${corrTxt}</dd></div><div><dt>${T('势力与驻地', 'Faction & Base')}</dt><dd>${affilText(ch, d)}</dd></div><div><dt>${T('关系', 'Relations')}</dt><dd>${relText(ch)}</dd></div></dl></div>
    <div class="cblock">${growthHTML(ch, d)}</div>
    <div class="cblock"><h4>${T('能力', 'Abilities')}<small>${T('域 × 效果 × 形态', 'Domain × Effect × Form')}</small></h4>${ch.abilities.map(abilityHTML).join('')}<h4 style="margin-top:18px">${T('代价与弱点', 'Cost & Weakness')}<small>${T('违常必有价', 'Every break has a price')}</small></h4>${price}</div>
    <div class="cblock"><h4>${T('性格', 'Personality')}<small>${alignOf(p)}</small></h4><p>${personaText(ch)}${T('。', '.')}</p>${pRows}<dl class="kv" style="margin-top:10px"><div><dt>${T('核心动机', 'Core Motivation')}</dt><dd>${ch.motivation}</dd></div><div><dt>${T('缺陷', 'Flaw')}</dt><dd>${ch.flaw}</dd></div><div><dt>${T('说话方式', 'Speech')}</dt><dd>${ch.speech}</dd></div><div><dt>${T('习惯', 'Quirk')}</dt><dd>${ch.quirk}</dd></div></dl></div>
    <div class="cblock"><h4>${T('外观', 'Appearance')}<small>${T('能力会在身体上留下痕迹', 'Power leaves its mark on the body')}</small></h4><p>${lookSummary(ch, d)}</p><dl class="kv"><div><dt>${T('异象特征', 'Anomalous Tell')}</dt><dd>${manifestOf(ch)}</dd></div><div><dt>${T('出身特征', 'Origin Trait')}</dt><dd>${originLookOf(ch)}</dd></div></dl></div>
    <div class="cblock"><h4>${T('背景', 'Background')}</h4><p>${esc(bgText(ch, d.fac))}</p></div>
  </div></div>`;
  renderWorldNote();
}
function saveChar() { STORE.set('char', state.char); }
function saveRoster() { STORE.set('roster', state.roster); }
function refreshChar(full) { if (full) syncCharControls(); else refreshAttrVals(); renderCard(); saveChar(); }

function renderRoster() {
  const el = $('#roster');
  if (!state.roster.length) { el.innerHTML = `<div class="empty">${T('名册还是空的。创建一个喜欢的角色后点「存入名册」，或到「势力关系」页一键生成群像。', 'The roster is empty. Create a character you like and click "Save to roster," or head to the Factions tab and generate a cast.')}</div>`; return; }
  el.innerHTML = state.roster.map((c) => {
    const s = SYSTEMS[c.system], d = derive(c), f = state.factions.find((x) => x.id === c.factionId), l = state.locs.find((x) => x.id === c.locId);
    return `<div class="rcard c-${c.system}">${sigilSVG(c)}<div><b>${esc(c.name)}</b><p class="small">${T(`${tf(s.name)}，位阶 ${c.tier} ${tf(TIERS[c.tier].n)}，战力 ${d.score}`, `${tf(s.name)}, Tier ${c.tier} ${tf(TIERS[c.tier].n)}, Power ${d.score}`)}<br>${tf(ORIGIN_BY_ID[c.origin].name)}${f ? T('，', ', ') + esc(tf(f.name)) : ''}${l ? T('，驻于', ', based at ') + esc(l.name) : ''}</p></div><div class="acts"><button class="btn" type="button" data-load="${c.uid}">${T('载入', 'Load')}</button><button class="btn" type="button" data-fight="${c.uid}">${T('作为对手', 'As opponent')}</button><button class="btn" type="button" data-sqadd="a:${c.uid}">${T('入甲队', 'To Team A')}</button><button class="btn" type="button" data-sqadd="b:${c.uid}">${T('入乙队', 'To Team B')}</button><button class="btn" type="button" data-del="${c.uid}">${T('删除', 'Delete')}</button></div></div>`;
  }).join('');
}

/* ==========================================================================
   推演
   ========================================================================== */
function ensureOpp() {
  if (!state.sim.opp) state.sim.opp = newCharacter({ tier: clamp(state.char.tier + Math.floor(Math.random() * 3) - 1, 1, 9) });
  return state.sim.opp;
}
function resolveFighter(id) {
  if (id === '__random') return ensureOpp();
  if (id === '__current') return state.char;
  return state.roster.find((r) => r.uid === id) || state.char;
}
function renderSimSelects() {
  const opts = (withRandom) => (withRandom ? [`<option value="__random">${T(`随机对手：${esc(ensureOpp().name)}（${tf(SYSTEMS[ensureOpp().system].name)}，位阶 ${ensureOpp().tier}）`, `Random opponent: ${esc(ensureOpp().name)} (${tf(SYSTEMS[ensureOpp().system].name)}, Tier ${ensureOpp().tier})`)}</option>`] : []).concat([`<option value="__current">${T('当前工坊角色：', 'Current workshop character: ')}${esc(state.char.name)}</option>`]).concat(state.roster.map((r) => `<option value="${r.uid}">${T(`${esc(r.name)}（${tf(SYSTEMS[r.system].name)}，位阶 ${r.tier}）`, `${esc(r.name)} (${tf(SYSTEMS[r.system].name)}, Tier ${r.tier})`)}</option>`)).join('');
  const valid = (id) => id === '__random' || id === '__current' || state.roster.some((r) => r.uid === id);
  if (!valid(state.sim.a)) state.sim.a = '__current'; if (!valid(state.sim.b)) state.sim.b = '__random';
  $('#simA').innerHTML = opts(true); $('#simB').innerHTML = opts(true);
  $('#simA').value = state.sim.a; $('#simB').value = state.sim.b;
}
function meterHTML(label, cur, max, red) { const pct = clamp(cur / max * 100, 0, 100); return `<div class="meter"><div><span>${label}</span><span>${Math.round(cur)} / ${Math.round(max)}</span></div><div class="mini"><i${red ? ' class="red"' : ''} style="width:${pct.toFixed(1)}%"></i></div></div>`; }
function simWorld() {
  const loc = state.locs.find((l) => l.id === state.sim.loc);
  if (!loc) return state.world;
  return { name: `${loc.name}${T('（', ' (')}${state.world.name}${T('）', ')')}`, dials: localWorld(state.world, loc).dials };
}
function renderSimHeader() {
  const el = $('#simWorld'); if (!el) return;
  const w = simWorld(); el.textContent = T(`${w.name}，违常指数 ${Math.round(abnormality(w))}`, `${w.name}, Abnormality ${Math.round(abnormality(w))}`);
}
function renderSimLoc() {
  if (!state.locs.some((l) => l.id === state.sim.loc)) state.sim.loc = '';
  $('#simLoc').innerHTML = `<option value="">${T('全局世界：', 'Global world: ')}${esc(state.world.name)}</option>` + state.locs.map((l) => `<option value="${l.id}">${T(`${esc(l.name)}（${tf(LOC_BY_ID[l.type].name)}，违常 ${Math.round(abnormality(localWorld(state.world, l)))}）`, `${esc(l.name)} (${tf(LOC_BY_ID[l.type].name)}, Abn. ${Math.round(abnormality(localWorld(state.world, l)))})`)}</option>`).join('');
  $('#simLoc').value = state.sim.loc;
  const m = worldMods(simWorld());
  $('#simLocNote').textContent = T('此处体系效率：', 'System efficiency here: ') + SYS_IDS.map((k) => `${tf(SYSTEMS[k].name)} ×${m.sys[k].toFixed(2)}`).join(T('，', ', ')) + T(`；环境侵蚀每回合 −${m.ambientStb.toFixed(1)} 稳定度。`, `; ambient erosion −${m.ambientStb.toFixed(1)} Stability per round.`);
}
function revealSim() {
  const el = $('#simOut .banner'); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
}
function runSim() {
  const A = clone(resolveFighter(state.sim.a)), B = clone(resolveFighter(state.sim.b)), world = clone(simWorld()), rel = makeRel(state.crel);
  const res = duel(A, B, world, { log: true, rel, rng: mulberry32((Math.random() * 4294967296) >>> 0) });
  const wr = winRate(A, B, world, 300, rel);
  state.sim.res = { kind: 'duel', A, B, world, res, wr };
  renderSimOut(); revealSim();
}
function renderSimOut() {
  const S0 = state.sim.res, out = $('#simOut');
  const S = S0 && (S0.kind || 'duel') === state.sim.mode ? S0 : null;
  if (!S) { out.innerHTML = `<div class="empty" style="margin-top:16px">${state.sim.mode === 'squad' ? T('组好两支小队后点「开始推演」。', 'Form two squads, then click "Run simulation."') : T('选好双方后点「开始推演」。', 'Pick both sides, then click "Run simulation."')}</div>`; return; }
  if (S.kind === 'squad') { renderSquadOut(S); return; }
  const { A, B, world, res, wr } = S, m = worldMods(world), F = [A, B];
  const win = res.winner === 'A' ? A : res.winner === 'B' ? B : null;
  const why = res.winner === 'draw' ? T('双方势均力敌，未分胜负。', 'An even match — no clear winner.') : res.reason === 'stb' ? T('败者的稳定度耗尽，被现实抹去。', "The loser's Stability ran out and reality erased them.") : res.reason === 'hp' ? T('败者的生命耗尽。', "The loser's HP ran out.") : T('回合耗尽，按剩余状态判定。', 'Rounds ran out; judged by remaining status.');
  const pct = (x) => Math.round(x * 100);
  const duelist = (ch, i) => {
    const e = res.end[i], s = SYSTEMS[ch.system], d = derive(ch);
    return `<div class="panel duelist ${i ? 'sb' : 'sa'} c-${ch.system}"><h4><span class="side">${i ? T('乙方', 'Side B') : T('甲方', 'Side A')}</span>${esc(ch.name)}</h4><div class="tags"><span class="tag hue">${tf(s.name)}</span><span class="tag">${T(`位阶 ${ch.tier} ${tf(TIERS[ch.tier].n)}`, `Tier ${ch.tier} ${tf(TIERS[ch.tier].n)}`)}</span><span class="tag">${tf(ORIGIN_BY_ID[ch.origin].name)}</span></div>
      ${meterHTML(T('生命', 'HP'), e.hp, e.hpMax)}${meterHTML(tf(s.resource), e.en, e.enMax)}${meterHTML(T('稳定度', 'Stability'), e.stb, e.stbMax, e.stb / e.stbMax < 0.3)}
      <p class="small" style="margin-top:8px">${T(`本世界中的体系效率 ×${m.sys[ch.system].toFixed(2)}，先攻 ${d.init}，综合战力 ${d.score}。`, `System efficiency in this world ×${m.sys[ch.system].toFixed(2)}, Initiative ${d.init}, Power Rating ${d.score}.`)}</p></div>`;
  };
  out.innerHTML = `<div class="simgrid">
    <div class="banner ${win ? 'c-' + win.system : ''}"><h3>${win ? T(`${esc(win.name)} 获胜`, `${esc(win.name)} wins`) : T('平局', 'Draw')}</h3><p>${T(`战场：${esc(world.name)}。共 ${res.rounds} 回合。${why}`, `Battlefield: ${esc(world.name)}. ${res.rounds} rounds. ${why}`)}</p></div>
    <div class="duelists">${duelist(A, 0)}${duelist(B, 1)}</div>
    <div class="panel"><div class="panel-h"><h3>${T('胜率估算', 'Win Rate Estimate')}</h3><small>${T('同一世界、同样的双方，另外模拟 300 场', 'Same world, same combatants — 300 extra simulated matches')}</small></div><div class="body">
      <div class="wr" role="img" aria-label="${T(`甲方胜率 ${pct(wr.a)}%，平局 ${pct(wr.d)}%，乙方胜率 ${pct(wr.b)}%`, `Side A win rate ${pct(wr.a)}%, draw ${pct(wr.d)}%, Side B win rate ${pct(wr.b)}%`)}"><div class="wa" style="flex:${Math.max(wr.a, 0.001)}">${pct(wr.a) >= 8 ? pct(wr.a) + '%' : ''}</div><div class="wd" style="flex:${Math.max(wr.d, 0.001)}">${pct(wr.d) >= 8 ? pct(wr.d) + '%' : ''}</div><div class="wb" style="flex:${Math.max(wr.b, 0.001)}">${pct(wr.b) >= 8 ? pct(wr.b) + '%' : ''}</div></div>
      <div class="wr-legend"><span>${T('甲方', 'A')} ${esc(A.name)} ${pct(wr.a)}%</span><span>${T('平局', 'Draw')} ${pct(wr.d)}%</span><span>${T('乙方', 'B')} ${esc(B.name)} ${pct(wr.b)}%</span></div>
      <p class="small" style="margin-top:8px">${T(`平均 ${wr.rounds.toFixed(1)} 回合分出胜负。${Math.abs(wr.a - wr.b) < 0.12 ? '这是一场势均力敌的对局。' : wr.a > wr.b ? '甲方明显占优。' : '乙方明显占优。'}`, `Averages ${wr.rounds.toFixed(1)} rounds to decide. ${Math.abs(wr.a - wr.b) < 0.12 ? 'A closely matched fight.' : wr.a > wr.b ? 'Side A has a clear edge.' : 'Side B has a clear edge.'}`)}</p></div></div>
    <div class="panel"><div class="panel-h"><h3>${T('生存率曲线', 'Survival Curve')}</h3><small>${T('取生命与稳定度中较低者，越接近 0 越接近倒下', 'Lower of HP and Stability — closer to 0 means closer to falling')}</small></div><div class="body">${timelineSVG(res.tl)}<div class="legend"><span><i></i>${T('甲方', 'A')} ${esc(A.name)}</span><span><i class="b"></i>${T('乙方', 'B')} ${esc(B.name)}</span></div></div></div>
    <div class="panel"><div class="panel-h"><h3>${T('战报', 'Battle Report')}</h3><small>${T('蓝线为甲方行动，红线为乙方行动', 'Blue = Side A actions, red = Side B actions')}</small></div><div class="body"><ol class="log">${res.log.map((l) => `<li class="${l.t}${l.i === 0 ? ' ia' : l.i === 1 ? ' ib' : ''}">${l.t === 'r' ? l.x : esc(l.x)}</li>`).join('')}</ol></div></div>
  </div>`;
}
function renderSim() {
  const sq = state.sim.mode === 'squad';
  $$('#simMode .chip').forEach((b) => b.setAttribute('aria-pressed', b.dataset.mode === state.sim.mode ? 'true' : 'false'));
  $('#duelPick').hidden = sq; $('#squadPick').hidden = !sq; $('#btnOpp').hidden = sq;
  $('#simHint').textContent = sq ? T('小队最多 5 人，队员是加入时的快照。队友之间的关系会带来默契或拖累，宿敌之间会互相多打几分；关系可以在「势力关系」页编辑。', 'Squads hold up to 5, and members are snapshots taken when they join. Relationships between teammates bring synergy or friction, and nemeses hit each other harder; edit relationships on the Factions tab.') : T('每次推演都会用新的随机数打一场完整的对局，并另外模拟数百场来估算胜率。', 'Each run plays a full match with fresh randomness, then simulates hundreds more in the background to estimate the win rate.');
  renderSimHeader(); renderSimLoc();
  if (sq) renderSquads(); else renderSimSelects();
  renderSimOut();
}

/* ==========================================================================
   导航与事件
   ========================================================================== */
function setTab(t) {
  state.tab = t;
  $$('.tabpanel[id^="tab-"]').forEach((p) => { p.hidden = p.id !== 'tab-' + t; });
  $$('.tabs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === t ? 'true' : 'false'));
  if (t === 'char') { fillAffilSelects(); renderCard(); renderRoster(); }
  if (t === 'sim') renderSim();
  if (t === 'map') renderMap();
  if (t === 'fac') renderFacAll();
  if (t === 'camp') renderCamp();
  if (t === 'world') renderWorldAll(false);
  try { window.scrollTo({ top: 0 }); } catch (e) { /* noop */ }
}
function saveToRoster() {
  const ch = state.char;
  if (!ch.uid) ch.uid = ch.seed + '-' + Date.now().toString(36);
  const i = state.roster.findIndex((r) => r.uid === ch.uid);
  if (i >= 0) { state.roster[i] = clone(ch); toast(T('已更新名册中的这个角色', 'Updated this character in the roster')); }
  else { if (state.roster.length >= 30) { toast(T('名册已满（30 个），请先删除一些', 'The roster is full (30) — delete some first')); return; } state.roster.push(clone(ch)); toast(T('已存入名册', 'Saved to roster')); }
  saveRoster(); saveChar(); renderRoster();
}
function bind() {
  $$('.tabs button').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
  $('#tblock').addEventListener('click', () => setTab('world'));
  document.addEventListener('click', (e) => { const g = e.target.closest('[data-go]'); if (g) setTab(g.dataset.go); });
  document.addEventListener('click', (e) => { const p = e.target.closest('[data-preset]'); if (p) setWorld(presetToWorld(PRESETS.find((x) => x.id === p.dataset.preset)), true); });

  $('#dials').addEventListener('input', (e) => { const i = e.target; if (!i.dataset.dial) return; syncGauge(i.closest('.gauge')); state.world.dials[i.dataset.dial] = +i.value; STORE.set('world', state.world); renderWorldAll(false); });
  $('#worldName').addEventListener('input', (e) => { state.world.name = e.target.value.slice(0, 32); STORE.set('world', state.world); ['#heroWorld', '#tbWorld'].forEach((s) => { $(s).textContent = state.world.name || T('未命名世界', 'Unnamed World'); }); });
  $('#btnWorldName').addEventListener('click', () => { state.world.name = randomWorldName(); STORE.set('world', state.world); $('#worldName').value = state.world.name; renderWorldAll(false); });
  $('#btnRandWorld').addEventListener('click', () => setWorld(randomWorld(), true));
  $('#btnEvent').addEventListener('click', rollEvent);

  const tc = $('#tab-char');
  tc.addEventListener('input', (e) => {
    const i = e.target, ch = state.char;
    if (i.dataset.k === 'tier') { syncGauge(i.closest('.gauge')); $('#tierLab').textContent = `${i.value}　${tf(TIERS[+i.value].n)}`; $('#tierDesc').textContent = tf(TIERS[+i.value].d); return; }
    if (i.dataset.attr) { syncGauge(i.closest('.gauge')); ch.attrs[i.dataset.attr] = +i.value; refreshChar(false); return; }
    if (i.dataset.persona) { syncGauge(i.closest('.gauge')); ch.persona[i.dataset.persona] = +i.value; $(`[data-pval="${i.dataset.persona}"]`).textContent = i.value; refreshChar(false); return; }
    if (i.id === 'chName') { ch.name = i.value.slice(0, 28); renderCard(); saveChar(); }
  });
  tc.addEventListener('change', (e) => {
    const i = e.target, ch = state.char;
    if (i.dataset.k === 'tier') { ch.tier = +i.value; regen(ch, 'attrs'); regen(ch, 'abil'); refreshChar(true); }
    else if (i.id === 'selOrigin') { ch.origin = i.value; refreshChar(true); }
    else if (i.id === 'selArch') { ch.archetype = i.value; regen(ch, 'attrs'); refreshChar(true); }
    else if (i.id === 'selFac') { ch.factionId = i.value; if (i.value && !ch.rank) ch.rank = tb(RANKS)[1]; refreshChar(true); }
    else if (i.id === 'selRank') { ch.rank = i.value; refreshChar(true); }
    else if (i.id === 'selLoc') { ch.locId = i.value; refreshChar(true); }
  });
  tc.addEventListener('click', (e) => {
    const ch = state.char;
    const sb = e.target.closest('[data-sys]'); if (sb) { ch.system = sb.dataset.sys; regen(ch, 'abil'); refreshChar(true); return; }
    const rr = e.target.closest('[data-reroll]'); if (rr) { reroll(ch, rr.dataset.reroll); refreshChar(true); return; }
    const ld = e.target.closest('[data-load]'); if (ld) { const r = state.roster.find((x) => x.uid === ld.dataset.load); if (r) { state.char = clone(r); refreshChar(true); toast(T('已载入：', 'Loaded: ') + r.name); window.scrollTo({ top: 0 }); } return; }
    const ft = e.target.closest('[data-fight]'); if (ft) { state.sim.b = ft.dataset.fight; state.sim.res = null; setTab('sim'); return; }
    const dl = e.target.closest('[data-del]'); if (dl) { state.roster = state.roster.filter((x) => x.uid !== dl.dataset.del); state.crel = state.crel.filter((e) => e.a !== dl.dataset.del && e.b !== dl.dataset.del); state.camp.party.ids = state.camp.party.ids.filter((id) => id !== dl.dataset.del); saveUniverse(); saveRoster(); STORE.set('camp', state.camp); renderRoster(); toast(T('已删除', 'Deleted')); }
  });
  $('#btnNewChar').addEventListener('click', () => { state.char = newCharacter({ tier: state.char.tier }); refreshChar(true); });
  $('#btnSave').addEventListener('click', saveToRoster);
  $('#btnExport').addEventListener('click', () => { $('#ioBox').value = JSON.stringify(state.roster); toast(T('已生成导出内容，请复制保存', 'Export text generated — copy it to save')); });
  $('#btnImport').addEventListener('click', () => {
    try {
      const arr = JSON.parse($('#ioBox').value), list = (Array.isArray(arr) ? arr : [arr]).filter(validChar);
      if (!list.length) { toast(T('没有识别到可导入的角色', 'No importable characters found')); return; }
      list.forEach((c) => { c.uid = c.uid && !state.roster.some((r) => r.uid === c.uid) ? c.uid : c.seed + '-' + Math.random().toString(36).slice(2, 6); state.roster.push(c); });
      state.roster = state.roster.slice(0, 30); saveRoster(); renderRoster(); toast(T(`已导入 ${list.length} 个角色`, `Imported ${list.length} characters`));
    } catch (err) { toast(T('内容无法解析，请确认粘贴完整', 'Could not parse that — make sure the paste is complete')); }
  });

  $('#simA').addEventListener('change', (e) => { state.sim.a = e.target.value; });
  $('#simB').addEventListener('change', (e) => { state.sim.b = e.target.value; });
  $('#btnRun').addEventListener('click', () => (state.sim.mode === 'squad' ? runSquad() : runSim()));
  $('#btnOpp').addEventListener('click', () => { state.sim.opp = null; ensureOpp(); state.sim.b = '__random'; renderSimSelects(); toast(T('已换了一个随机对手', 'Picked a new random opponent')); });
  bindUniverse();
  bindCamp();
  bindLangToggle();
}

function init() {
  const lg = STORE.get('lang'); if (lg === 'en' || lg === 'zh') setLang(lg);
  const w = STORE.get('world'); state.world = validWorld(w) ? w : presetToWorld(PRESETS[1]);
  const c = STORE.get('char'); state.char = validChar(c) ? c : newCharacter({ tier: 3 });
  const r = STORE.get('roster'); state.roster = Array.isArray(r) ? r.filter(validChar) : [];
  initUniverse();
  initCamp();
  applyI18n();
  buildDials(); buildCharControls(); renderGuideStatic(); syncCharControls(); syncDials(); bind();
  renderWorldAll(false); renderCard(); renderRoster(); renderEvents(); saveChar();
}
