'use strict';
/* ==========================================================================
   万象工坊 · 界面层（二）：地图、势力关系、小队推演
   ========================================================================== */
const locById = (id) => state.locs.find((l) => l.id === id);
const facById = (id) => state.factions.find((f) => f.id === id);

/* ---------- 持久化与初始化 ---------- */
function saveUniverse() {
  STORE.set('factions', state.factions); STORE.set('frel', state.frel); STORE.set('crel', state.crel);
  STORE.set('locs', state.locs); STORE.set('routes', state.routes);
  REG.factions = state.factions;
}
const validFac = (f) => !!(f && f.id && f.name && typeof f.hue === 'number' && typeof f.power === 'number');
const validLoc = (l) => !!(l && l.id && l.name && LOC_BY_ID[l.type] && typeof l.x === 'number' && typeof l.y === 'number' && l.off);
function initUniverse() {
  const fs = STORE.get('factions'); state.factions = Array.isArray(fs) && fs.length && fs.every(validFac) ? fs : clone(FACTION_DEFAULTS);
  const fr = STORE.get('frel'); state.frel = Array.isArray(fr) ? fr : clone(FREL_DEFAULT);
  const cr = STORE.get('crel'); state.crel = Array.isArray(cr) ? cr.filter((e) => e && e.a && e.b && REL_BY_ID[e.kind]) : [];
  const ls = STORE.get('locs'), rs = STORE.get('routes');
  if (Array.isArray(ls) && ls.length && ls.every(validLoc) && Array.isArray(rs)) { state.locs = ls; state.routes = rs; }
  else { const m = genMap(state.world, 'init' + Date.now(), 9); state.locs = m.locs; state.routes = m.routes; assignHomes(state.factions, state.locs); }
  state.selLoc = state.locs[0] ? state.locs[0].id : ''; state.selFac = state.factions[0] ? state.factions[0].id : '';
  saveUniverse();
}

/* ---------- 角色的势力 / 驻地 ---------- */
function fillAffilSelects() {
  const ch = state.char, fac = facById(ch.factionId);
  $('#selFac').innerHTML = `<option value="">${T('无所属势力', 'No faction')}</option>` + state.factions.map((f) => `<option value="${f.id}">${esc(tf(f.name))}</option>`).join('');
  $('#selFac').value = fac ? fac.id : '';
  { const rl = tb(RANKS).slice(); if (ch.rank && !rl.includes(ch.rank)) rl.unshift(ch.rank); $('#selRank').innerHTML = rl.map((r) => `<option value="${esc(r)}">${esc(r)}</option>`).join(''); }
  $('#selRank').value = ch.rank || tb(RANKS)[1]; $('#selRank').disabled = !fac;
  $('#selLoc').innerHTML = `<option value="">${T('未指定', 'Unassigned')}</option>` + state.locs.map((l) => `<option value="${l.id}">${esc(l.name)}</option>`).join('');
  $('#selLoc').value = locById(ch.locId) ? ch.locId : '';
  $('#facDesc').textContent = !fac ? T('不隶属任何势力，没有额外加成。', 'Belongs to no faction; no extra bonus.') : !fac.favored ? T(`${tf(fac.kind)}，没有偏好体系。`, `${tf(fac.kind)}. No favored system.`) : fac.favored === ch.system ? T(`${tf(fac.kind)}。使用偏好的「${tf(SYSTEMS[fac.favored].name)}」体系，威力 +5%。`, `${tf(fac.kind)}. Using its favored "${tf(SYSTEMS[fac.favored].name)}" system: power +5%.`) : T(`${tf(fac.kind)}。偏好「${tf(SYSTEMS[fac.favored].name)}」体系，你的体系不同，没有加成。`, `${tf(fac.kind)}. Favors the "${tf(SYSTEMS[fac.favored].name)}" system; yours differs, so no bonus.`);
}
function affilText(ch, d) {
  const l = locById(ch.locId);
  const f = d.fac ? T(`${esc(tf(d.fac.name))}（${esc(ch.rank || tb(RANKS)[1])}）${d.facBonus ? '，本体系威力 +5%' : ''}`, `${esc(tf(d.fac.name))} (${esc(ch.rank || tb(RANKS)[1])})${d.facBonus ? ', +5% power in this system' : ''}`) : T('无所属势力', 'No faction');
  return f + (l ? T(`；驻于${esc(l.name)}`, `; based at ${esc(l.name)}`) : '');
}
function relText(ch) {
  if (!ch.uid) return T('存入名册后才能建立关系', 'Save to the roster to form relationships');
  const list = state.crel.filter((e) => e.a === ch.uid || e.b === ch.uid).map((e) => {
    const o = state.roster.find((c) => c.uid === (e.a === ch.uid ? e.b : e.a));
    return o ? `${tf(REL_BY_ID[e.kind].name)}${T('：', ': ')}${esc(o.name)}` : null;
  }).filter(Boolean);
  return list.length ? list.slice(0, 5).join(T('；', '; ')) + (list.length > 5 ? T(`等 ${list.length} 人`, ` and ${list.length - 5} more`) : '') : T('暂无', 'None');
}

/* ==========================================================================
   地图
   ========================================================================== */
const mx = (l) => l.x * MAP_W / 100, my = (l) => l.y * MAP_H / 100;
function glyphSVG(g) {
  const P = (pts) => `<polygon points="${pts}"/>`;
  switch (g) {
    case 'hex': return P('0,-12 10.4,-6 10.4,6 0,12 -10.4,6 -10.4,-6');
    case 'diamond': return P('0,-13 11,0 0,13 -11,0');
    case 'ring': return '<circle r="11"/><circle r="5"/>';
    case 'tri': return P('0,-12 11,9 -11,9');
    case 'itri': return P('0,12 11,-9 -11,-9');
    case 'oval': return '<ellipse rx="13" ry="8"/>';
    case 'cross': return '<rect x="-10" y="-10" width="20" height="20"/><path d="M-10 -10L10 10M10 -10L-10 10"/>';
    case 'square': return '<rect x="-10" y="-10" width="20" height="20"/>';
    case 'oct': return P('-5,-12 5,-12 12,-5 12,5 5,12 -5,12 -12,5 -12,-5');
    case 'circle2': return '<circle r="11"/><path d="M0 -16V-11M0 11V16M-16 0H-11M11 0H16"/>';
    default: return '<circle r="11"/>';
  }
}
function blobPath(cx, cy, r, rng) {
  const n = 9, pts = Array.from({ length: n }, (_, i) => { const a = i * 2 * Math.PI / n, rad = r * (0.7 + 0.5 * rng.next()); return [cx + rad * Math.cos(a), cy + rad * 0.68 * Math.sin(a)]; });
  const mids = pts.map((p, i) => { const q = pts[(i + 1) % n]; return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; });
  const f = (v) => v.map((x) => x.toFixed(1)).join(' ');
  return `M${f(mids[n - 1])} ` + pts.map((p, i) => `Q${f(p)} ${f(mids[i])}`).join(' ') + 'Z';
}
function renderMapSvg() {
  const svg = $('#mapSvg'), rr = makeRng('terrain|' + state.world.name);
  let s = '';
  for (let i = 0; i < 5; i++) { const cx = rr.range(80, MAP_W - 80), cy = rr.range(70, MAP_H - 70), r = rr.range(70, 150); [1, 0.68, 0.4].forEach((k) => { s += `<path class="mp-c" d="${blobPath(cx, cy, r * k, rr)}"/>`; }); }
  state.routes.forEach(([a, b]) => {
    const A = locById(a), B = locById(b); if (!A || !B) return;
    s += `<line class="mp-r${state.selLoc === a || state.selLoc === b ? ' hot' : ''}" x1="${mx(A).toFixed(1)}" y1="${my(A).toFixed(1)}" x2="${mx(B).toFixed(1)}" y2="${my(B).toFixed(1)}"/>`;
  });
  const C = 2 * Math.PI * 21;
  state.locs.forEach((l) => {
    const t = LOC_BY_ID[l.type], idx = abnormality(localWorld(state.world, l)), f = facById(l.ctrl), sel = l.id === state.selLoc;
    const cnt = state.roster.filter((c) => c.locId === l.id).length;
    s += `<g class="lnode${sel ? ' sel' : ''}" data-loc="${l.id}" transform="translate(${mx(l).toFixed(1)},${my(l).toFixed(1)})" tabindex="0" role="button" aria-label="${esc(T(`${l.name}，${tf(t.name)}，违常指数 ${Math.round(idx)}${f ? '，由' + tf(f.name) + '控制' : ''}`, `${l.name}, ${tf(t.name)}, Abnormality ${Math.round(idx)}${f ? ', controlled by ' + tf(f.name) : ''}`))}">
      ${f ? `<circle r="36" class="mp-halo" style="fill:${facColor(f)};stroke:${facColor(f)}"/>` : ''}
      <circle r="21" class="mp-ringbg"/><circle r="21" class="mp-ring" stroke-dasharray="${(idx / 100 * C).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90)"/>
      <g class="lg">${glyphSVG(t.glyph)}</g>
      ${sel ? '<circle r="29" class="mp-sel"/>' : ''}
      <text class="mp-n" y="-27" text-anchor="middle">${Math.round(idx)}</text>
      <text class="mp-t" y="41" text-anchor="middle">${esc(l.name)}</text>
      ${cnt ? `<g transform="translate(18,-18)"><circle r="8" class="mp-badge"/><text class="mp-bt" y="4" text-anchor="middle">${cnt}</text></g>` : ''}
    </g>`;
  });
  svg.innerHTML = s;
}
function renderMapKey() {
  $('#mapKey').innerHTML = LOC_TYPES.map((t) => `<span class="mk"><svg viewBox="-17 -17 34 34" class="mk-g" aria-hidden="true"><g class="lg">${glyphSVG(t.glyph)}</g></svg>${tf(t.name)}</span>`).join('') + `<span class="mk-note">${T('外圈红弧 = 局部违常指数，色晕 = 控制势力，右上数字 = 驻扎角色', 'Red arc = local Abnormality Index, halo color = controlling faction, top-right number = stationed characters')}</span>`;
}
function renderLocChips() {
  $('#locChips').innerHTML = state.locs.map((l) => `<button class="chip" type="button" data-locchip="${l.id}" aria-pressed="${l.id === state.selLoc}">${esc(l.name)}</button>`).join('');
}
function locLawHTML(l) {
  const lw = localWorld(state.world, l), m = worldMods(lw), act = PHENOMENA.filter((p) => p.on(lw.dials));
  const rows = DIALS.map((d) => { const off = (l.off && l.off[d.id]) || 0; return `<div class="lrow"><span>${tf(d.name)}</span><span class="rv">${dialReadout(d.id, lw.dials[d.id])}</span><em class="${off ? 'off' : ''}">${off ? (off > 0 ? '+' : '') + off : '—'}</em></div>`; }).join('');
  const mods = SYS_IDS.map((k) => `<div class="mod c-${k}"><span class="nm">${SYSTEMS[k].name}</span><div class="mini"><i style="width:${clamp(m.sys[k] / 1.9 * 100, 2, 100).toFixed(1)}%"></i><u></u></div><span class="mv">×${m.sys[k].toFixed(2)}</span></div>`).join('');
  return `<div class="wr-read"><div class="lrows">${rows}</div><div class="wr-num"><span class="num big">${Math.round(m.index)}</span><span class="small">${T('局部违常指数', 'Local Abnormality')}<br>${abnLabel(m.index)}</span></div></div>
    <div class="mods" style="margin-top:14px">${mods}</div>
    <p class="small" style="margin-top:12px">${T('局部异象：', 'Local phenomena: ')}${act.length ? act.map((p) => `<span class="tag">${tf(p.name)}</span>`).join(' ') : T('无', 'None')}</p>`;
}
const fmtOff = (v) => (v > 0 ? '+' : '') + v;
function renderLocPanel() {
  const el = $('#locPanel'), l = locById(state.selLoc);
  if (!l) { el.innerHTML = `<div class="empty">${T('地图上还没有地点，点「新增地点」。', 'No places on the map yet — click "Add a place."')}</div>`; return; }
  const t = LOC_BY_ID[l.type];
  const linked = (id) => state.routes.some((e) => (e[0] === l.id && e[1] === id) || (e[1] === l.id && e[0] === id));
  const here = state.roster.filter((c) => c.locId === l.id);
  el.innerHTML = `
  <div class="panel"><div class="panel-h"><h3>${T('地点档案', 'Place Profile')}</h3><small>${tf(t.name)}</small></div><div class="body">
    <label class="field"><span>${T('名称', 'Name')}</span><span class="inline"><input id="locName" type="text" maxlength="24" value="${esc(l.name)}" autocomplete="off"><button class="btn" type="button" data-loc-act="rename">${T('随机名', 'Randomize')}</button></span></label>
    <label class="field"><span>${T('类型', 'Type')}</span><select id="locType">${LOC_TYPES.map((x) => `<option value="${x.id}"${x.id === l.type ? ' selected' : ''}>${tf(x.name)}</option>`).join('')}</select><p class="small">${tf(t.desc)}</p></label>
    <label class="field"><span>${T('控制势力', 'Controlling Faction')}</span><select id="locCtrl"><option value="">${T('无人控制', 'Uncontrolled')}</option>${state.factions.map((f) => `<option value="${f.id}"${f.id === l.ctrl ? ' selected' : ''}>${esc(tf(f.name))}</option>`).join('')}</select></label>
    <div class="btnrow tight"><button class="btn primary" type="button" data-loc-act="sim">${T('在此推演', 'Simulate here')}</button><button class="btn" type="button" data-loc-act="del">${T('删除地点', 'Delete place')}</button></div>
  </div></div>
  <div class="panel"><div class="panel-h"><h3>${T('局部法则', 'Local Physics')}</h3><small>${T('世界旋钮 + 该地偏移', 'World dials + this place\'s offset')}</small></div><div class="body">
    <div id="locLaw">${locLawHTML(l)}</div>
    <details class="offs"><summary>${T('微调局部偏移', 'Fine-tune local offsets')}</summary>${DIALS.map((d) => { const v = (l.off && l.off[d.id]) || 0; return `<div class="offrow"><span class="lab">${tf(d.name)}</span>${gaugeHTML({ min: -40, max: 40, value: v, mode: 'dev', tone: 'ink', base: 0.5, attrs: `data-off="${d.id}"`, label: tf(d.name) + T('偏移', ' offset') })}<span class="val" data-offv="${d.id}">${fmtOff(v)}</span></div>`; }).join('')}<div class="btnrow tight"><button class="btn" type="button" data-loc-act="resetoff">${T('恢复类型默认偏移', 'Restore type defaults')}</button></div></details>
  </div></div>
  <div class="panel"><div class="panel-h"><h3>${T('路线与驻扎', 'Routes & Garrison')}</h3><small>${T('点击切换是否与本地相连', 'Click to toggle a route to this place')}</small></div><div class="body">
    <div class="chips" style="margin-top:0">${state.locs.filter((x) => x.id !== l.id).map((o) => `<button class="chip" type="button" data-route="${o.id}" aria-pressed="${linked(o.id)}">${esc(o.name)}</button>`).join('') || `<span class="small">${T('没有其他地点。', 'No other places.')}</span>`}</div>
    <p class="small" style="margin-top:12px">${T('驻扎角色：', 'Stationed characters: ')}${here.length ? here.map((c) => `<span class="tag hue c-${c.system}">${esc(c.name)}</span>`).join(' ') : T('无（在角色工坊里设置「驻地」）', 'None (set a "Home Base" in the Characters tab)')}</p>
  </div></div>`;
}
function renderMap() { renderMapSvg(); renderMapKey(); renderLocChips(); renderLocPanel(); }
function selectLoc(id) { state.selLoc = id; renderMapSvg(); renderLocChips(); renderLocPanel(); }

function addLoc() {
  if (state.locs.length >= 16) { toast(T('地点最多 16 个', 'Maximum 16 places')); return; }
  const r = makeRng('add|' + Math.random()), type = r.weighted(LOC_TYPES, (t) => t.w(state.world.dials));
  let x = 50, y = 50, best = -1;
  for (let i = 0; i < 80; i++) {
    const cx = r.range(7, 93), cy = r.range(10, 90);
    const md = Math.min(999, ...state.locs.map((l) => Math.hypot((l.x - cx) * MAP_W / 100, (l.y - cy) * MAP_H / 100)));
    if (md > best) { best = md; x = cx; y = cy; }
  }
  const loc = { id: 'L' + uid8(), name: genLocName(r, type, new Set(state.locs.map((l) => l.name))), type: type.id, x: +x.toFixed(1), y: +y.toFixed(1), off: { ...type.off }, ctrl: '' };
  const near = state.locs.map((l) => [Math.hypot((l.x - loc.x) * MAP_W / 100, (l.y - loc.y) * MAP_H / 100), l.id]).sort((a, b) => a[0] - b[0])[0];
  state.locs.push(loc); if (near) state.routes.push([loc.id, near[1]]);
  state.selLoc = loc.id; saveUniverse(); renderMap(); toast(T('已新增地点：', 'Added place: ') + loc.name);
}
function delLoc(id) {
  state.locs = state.locs.filter((l) => l.id !== id);
  state.routes = state.routes.filter((e) => e[0] !== id && e[1] !== id);
  state.factions.forEach((f) => { if (f.home === id) f.home = ''; });
  state.roster.forEach((c) => { if (c.locId === id) c.locId = ''; });
  if (state.char.locId === id) state.char.locId = '';
  if (state.sim.loc === id) state.sim.loc = '';
  state.selLoc = state.locs[0] ? state.locs[0].id : '';
  saveUniverse(); saveRoster(); saveChar(); fixCampAfterMapChange(); renderMap();
}
function regenMap() {
  const m = genMap(state.world, 'r' + Date.now() + Math.random(), 9);
  state.locs = m.locs; state.routes = m.routes; assignHomes(state.factions, state.locs);
  state.roster.forEach((c) => { const f = facById(c.factionId); c.locId = f && f.home ? f.home : ''; });
  const f = facById(state.char.factionId); state.char.locId = f && f.home ? f.home : '';
  state.sim.loc = ''; state.selLoc = state.locs[0].id;
  saveUniverse(); saveRoster(); saveChar(); fixCampAfterMapChange(); renderMap(); toast(T('已按当前世界重新生成地图', 'Map regenerated for the current world'));
}
function svgPoint(svg, e) {
  if (!svg.createSVGPoint || !svg.getScreenCTM) return null;
  const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
  const m = svg.getScreenCTM(); return m ? pt.matrixTransform(m.inverse()) : null;
}
function bindMap() {
  const svg = $('#mapSvg');
  let drag = null;
  const move = (e) => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
    const p = svgPoint(svg, e), l = locById(drag.id); if (!p || !l) return;
    drag.moved = true;
    l.x = +clamp(p.x / MAP_W * 100, 5, 95).toFixed(1); l.y = +clamp(p.y / MAP_H * 100, 8, 92).toFixed(1);
    renderMapSvg();
  };
  const up = () => {
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
    if (!drag) return; const d = drag; drag = null;
    if (d.moved) saveUniverse(); else selectLoc(d.id);
  };
  svg.addEventListener('pointerdown', (e) => {
    const g = e.target.closest('.lnode'); if (!g) return;
    drag = { id: g.dataset.loc, sx: e.clientX, sy: e.clientY, moved: false };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  });
  svg.addEventListener('keydown', (e) => { if (e.key !== 'Enter' && e.key !== ' ') return; const g = e.target.closest('.lnode'); if (g) { e.preventDefault(); selectLoc(g.dataset.loc); } });
  $('#locChips').addEventListener('click', (e) => { const b = e.target.closest('[data-locchip]'); if (b) selectLoc(b.dataset.locchip); });
  $('#btnGenMap').addEventListener('click', regenMap);
  $('#btnAddLoc').addEventListener('click', addLoc);

  const lp = $('#locPanel');
  lp.addEventListener('input', (e) => {
    const i = e.target, l = locById(state.selLoc); if (!l) return;
    if (i.id === 'locName') { l.name = i.value.slice(0, 24); saveUniverse(); renderMapSvg(); renderLocChips(); return; }
    if (i.dataset.off) {
      syncGauge(i.closest('.gauge')); l.off[i.dataset.off] = +i.value; $(`[data-offv="${i.dataset.off}"]`).textContent = fmtOff(+i.value);
      $('#locLaw').innerHTML = locLawHTML(l); saveUniverse(); renderMapSvg();
    }
  });
  lp.addEventListener('change', (e) => {
    const i = e.target, l = locById(state.selLoc); if (!l) return;
    if (i.id === 'locType') { l.type = i.value; l.off = { ...LOC_BY_ID[i.value].off }; saveUniverse(); renderMapSvg(); renderLocPanel(); }
    else if (i.id === 'locCtrl') { l.ctrl = i.value; if (i.value) { const f = facById(i.value); if (f && !locById(f.home)) f.home = l.id; } saveUniverse(); renderMapSvg(); }
  });
  lp.addEventListener('click', (e) => {
    const l = locById(state.selLoc); if (!l) return;
    const ro = e.target.closest('[data-route]');
    if (ro) {
      const o = ro.dataset.route, i = state.routes.findIndex((r) => (r[0] === l.id && r[1] === o) || (r[1] === l.id && r[0] === o));
      if (i >= 0) state.routes.splice(i, 1); else state.routes.push([l.id, o]);
      saveUniverse(); renderMapSvg(); renderLocPanel(); return;
    }
    const a = e.target.closest('[data-loc-act]'); if (!a) return;
    if (a.dataset.locAct === 'rename') { l.name = genLocName(makeRng('rn|' + Math.random()), LOC_BY_ID[l.type], new Set(state.locs.map((x) => x.name))); saveUniverse(); renderMap(); }
    else if (a.dataset.locAct === 'resetoff') { l.off = { ...LOC_BY_ID[l.type].off }; saveUniverse(); renderMapSvg(); renderLocPanel(); }
    else if (a.dataset.locAct === 'sim') { state.sim.loc = l.id; setTab('sim'); }
    else if (a.dataset.locAct === 'del') { if (state.locs.length <= 1) { toast(T('至少保留一个地点', 'Keep at least one place')); return; } delLoc(l.id); toast(T('已删除地点', 'Place deleted')); }
  });
}

/* ==========================================================================
   势力与关系网
   ========================================================================== */
function renderFacAll() { renderFacList(); renderFacEdit(); renderNetFilter(); renderNetwork(); renderRelEdit(); }
function renderFacList() {
  $('#facCount').textContent = T(`${state.factions.length} 个势力`, `${state.factions.length} factions`);
  $('#facList').innerHTML = state.factions.map((f) => {
    const n = state.roster.filter((c) => c.factionId === f.id).length, home = locById(f.home);
    return `<button type="button" class="fcard${f.id === state.selFac ? ' on' : ''}" data-fac="${f.id}" style="--fc:${facColor(f)}"><span class="fdot"></span><span class="fbody"><b>${esc(tf(f.name))}</b><small>${tf(f.kind)}　${'●'.repeat(f.power)}${'○'.repeat(5 - f.power)}${f.favored ? '　' + tf(SYSTEMS[f.favored].name) : ''}　${T(`${n} 人`, n === 1 ? `${n} member` : `${n} members`)}${home ? '　' + esc(home.name) : ''}</small></span></button>`;
  }).join('') || `<div class="empty">${T('还没有势力。', 'No factions yet.')}</div>`;
}
function renderFacEdit() {
  const f = facById(state.selFac), el = $('#facEdit');
  if (!f) { el.innerHTML = `<div class="empty">${T('选择或新增一个势力。', 'Select or add a faction.')}</div>`; return; }
  const fv = factionRel(state.frel), members = state.roster.filter((c) => c.factionId === f.id).length;
  const sel = (id, list, cur) => { const L = list.slice(); if (cur && !L.some(([v]) => v === cur)) L.unshift([cur, cur]); return `<select id="${id}">${L.map(([v, n]) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>`; };
  el.innerHTML = `<div class="panel-h"><h3>${T('势力档案', 'Faction Profile')}</h3><small>${T(`名册中有 ${members} 名成员`, `${members} ${members === 1 ? 'member' : 'members'} in the roster`)}</small></div><div class="body">
    <label class="field"><span>${T('名称', 'Name')}</span><span class="inline"><input id="facName" type="text" maxlength="28" value="${esc(tf(f.name))}" autocomplete="off"><button class="btn" type="button" data-fac-act="rename">${T('随机名', 'Randomize')}</button></span></label>
    <div class="fgrid"><label class="field"><span>${T('类型', 'Type')}</span>${sel('facKind', tb(FACTION_KINDS).map((k) => [k, k]), tf(f.kind))}</label><label class="field"><span>${T('对异常的态度', 'Stance on Anomalies')}</span>${sel('facAtt', tb(ATTITUDES).map((k) => [k, k]), tf(f.attitude))}</label></div>
    <div class="fgrid"><label class="field"><span>${T('偏好体系', 'Favored System')}</span>${sel('facFav', [['', T('无偏好', 'None')], ...SYS_IDS.map((k) => [k, tf(SYSTEMS[k].name)])], f.favored || '')}</label><label class="field"><span>${T('总部', 'Headquarters')}</span>${sel('facHome', [['', T('无', 'None')], ...state.locs.map((l) => [l.id, l.name])], locById(f.home) ? f.home : '')}</label></div>
    <div class="field"><span>${T('势力等级', 'Faction Power')} <b id="facPowLab">${f.power}</b></span>${gaugeHTML({ min: 1, max: 5, value: f.power, attrs: 'data-facpow="1"', label: T('势力等级', 'Faction Power') })}</div>
    <label class="field"><span>${T('理念', 'Ideology')}</span><textarea id="facIdeo" rows="2" maxlength="160">${esc(tf(f.ideology))}</textarea></label>
    <p class="small">${f.favored ? T(`成员使用「${tf(SYSTEMS[f.favored].name)}」体系时，威力 +5%。`, `Members using the "${tf(SYSTEMS[f.favored].name)}" system get +5% power.`) : T('没有偏好体系，成员没有额外加成。', 'No favored system, so members get no extra bonus.')}</p>
    <h4 class="sub">${T('对其他势力的态度', 'Stance Toward Other Factions')}</h4>
    <div class="stance-list">${state.factions.filter((o) => o.id !== f.id).map((o) => `<div class="stance"><span class="fdot" style="--fc:${facColor(o)}"></span><span>${esc(tf(o.name))}</span><select data-frel="${o.id}" aria-label="${esc(T(`对${tf(o.name)}的态度`, `Stance toward ${tf(o.name)}`))}">${Object.entries(STANCES[LANG]).sort((a, b) => b[0] - a[0]).map(([v, n]) => `<option value="${v}"${+v === fv(f.id, o.id) ? ' selected' : ''}>${n}</option>`).join('')}</select></div>`).join('') || `<p class="small">${T('还没有其他势力。', 'No other factions yet.')}</p>`}</div>
    <div class="btnrow tight"><button class="btn" type="button" data-fac-act="del">${T('删除这个势力', 'Delete this faction')}</button></div></div>`;
}
function renderNetFilter() {
  const F = [['f', T('势力关系', 'Faction ties')], ['c', T('角色关系', 'Character ties')], ['m', T('隶属', 'Membership')]];
  $('#netFilter').innerHTML = F.map(([k, n]) => `<button class="chip" type="button" data-net="${k}" aria-pressed="${state.net[k]}">${n}</button>`).join('') + (state.netSel ? `<button class="chip" type="button" data-net="clear">${T('取消高亮', 'Clear highlight')}</button>` : '');
}
function netLayout(nodes, edges, W, H) {
  const pos = {}, n = nodes.length, facN = nodes.filter((x) => x.k === 'f'), rad = {};
  nodes.forEach((x) => { rad[x.id] = x.r; });
  facN.forEach((f, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / Math.max(1, facN.length); pos[f.id] = { x: W / 2 + Math.cos(a) * W * 0.3, y: H / 2 + Math.sin(a) * H * 0.3, vx: 0, vy: 0 }; });
  nodes.filter((x) => x.k === 'c').forEach((c) => { const r = makeRng('net|' + c.id), b = pos[c.fac] || { x: W / 2, y: H / 2 }; pos[c.id] = { x: b.x + r.range(-50, 50), y: b.y + r.range(-50, 50), vx: 0, vy: 0 }; });
  const L = { f: 230, c: 130, m: 70 }, iters = 240;
  for (let it = 0; it < iters; it++) {
    const cool = 1 - it / iters;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = pos[nodes[i].id], b = pos[nodes[j].id]; let dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
      if (d2 < 1) { dx = 1; dy = 0.5; d2 = 1.25; }
      const d = Math.sqrt(d2), minD = rad[nodes[i].id] + rad[nodes[j].id] + 28, f = 9000 / d2 + (d < minD ? (minD - d) * 0.5 : 0), fx = dx / d * f, fy = dy / d * f;
      a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
    }
    edges.forEach((e) => {
      const a = pos[e.a], b = pos[e.b]; if (!a || !b) return;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.max(1, Math.hypot(dx, dy)), f = (d - L[e.t]) * (e.t === 'm' ? 0.06 : 0.02), fx = dx / d * f, fy = dy / d * f;
      a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
    });
    nodes.forEach((nd) => {
      const p = pos[nd.id], m = 14 * cool + 1;
      p.vx += (W / 2 - p.x) * 0.004; p.vy += (H / 2 - p.y) * 0.004;
      p.x = clamp(p.x + clamp(p.vx, -m, m), 44, W - 44); p.y = clamp(p.y + clamp(p.vy, -m, m), 34, H - 48); p.vx *= 0.5; p.vy *= 0.5;
    });
  }
  /* 归一化：把布局拉伸到画布范围，避免挤在中间 */
  const xs = nodes.map((nd) => pos[nd.id].x), ys = nodes.map((nd) => pos[nd.id].y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const sx = Math.min(1.9, (W - 130) / Math.max(1, x1 - x0)), sy = Math.min(1.9, (H - 100) / Math.max(1, y1 - y0));
  nodes.forEach((nd) => { const p = pos[nd.id]; p.x = W / 2 + (p.x - (x0 + x1) / 2) * sx; p.y = H / 2 + (p.y - (y0 + y1) / 2) * sy; });
  return pos;
}
function renderNetwork() {
  const svg = $('#netSvg'), W = 720, H = 500, sel = state.netSel;
  const nodes = state.factions.map((f) => ({ id: f.id, k: 'f', r: 13 + f.power * 3, f })).concat(state.roster.map((c) => ({ id: c.uid, k: 'c', r: 8, c, fac: c.factionId })));
  const ids = new Set(nodes.map((x) => x.id)), edges = [];
  state.frel.forEach((e) => { if (e.v && ids.has(e.a) && ids.has(e.b)) edges.push({ a: e.a, b: e.b, t: 'f', v: e.v, tip: T(`${tf(facById(e.a).name)} 与 ${tf(facById(e.b).name)}：${STANCES[LANG][e.v]}`, `${tf(facById(e.a).name)} & ${tf(facById(e.b).name)}: ${STANCES[LANG][e.v]}`) }); });
  state.crel.forEach((e) => { const k = REL_BY_ID[e.kind]; if (ids.has(e.a) && ids.has(e.b)) edges.push({ a: e.a, b: e.b, t: 'c', v: k.v, tip: T(`${state.roster.find((c) => c.uid === e.a).name} 与 ${state.roster.find((c) => c.uid === e.b).name}：${tf(k.name)}`, `${state.roster.find((c) => c.uid === e.a).name} & ${state.roster.find((c) => c.uid === e.b).name}: ${tf(k.name)}`) }); });
  state.roster.forEach((c) => { if (c.factionId && ids.has(c.factionId)) edges.push({ a: c.uid, b: c.factionId, t: 'm', v: 0, tip: '' }); });
  const pos = netLayout(nodes, edges, W, H);
  const near = new Set(sel ? [sel] : []); if (sel) edges.forEach((e) => { if (e.a === sel) near.add(e.b); if (e.b === sel) near.add(e.a); });
  let s = '';
  edges.filter((e) => state.net[e.t]).forEach((e) => {
    const a = pos[e.a], b = pos[e.b], dim = sel && e.a !== sel && e.b !== sel, w = e.t === 'f' ? 1.6 + Math.abs(e.v) : e.t === 'c' ? 1.2 + 0.5 * Math.abs(e.v) : 1;
    s += `<line class="nt-e t${e.t} ${e.v > 0 ? 'pos' : e.v < 0 ? 'neg' : 'neu'}${dim ? ' dim' : ''}" x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke-width="${w}">${e.tip ? `<title>${esc(e.tip)}</title>` : ''}</line>`;
  });
  nodes.forEach((nd) => {
    const p = pos[nd.id], dim = sel && !near.has(nd.id);
    if (nd.k === 'f') {
      const f = nd.f;
      s += `<g class="nt-n f${dim ? ' dim' : ''}" data-nid="${f.id}" transform="translate(${p.x.toFixed(1)},${p.y.toFixed(1)})" tabindex="0" role="button" aria-label="${esc(T('势力 ', 'Faction ') + tf(f.name))}">${sel === f.id ? `<circle r="${nd.r + 6}" class="nt-sel"/>` : ''}<circle r="${nd.r}" style="fill:${facColor(f)};fill-opacity:.22;stroke:${facColor(f)}"/><text class="nt-ft" y="${nd.r + 15}" text-anchor="middle">${esc(tf(f.name))}</text></g>`;
    } else {
      const c = nd.c;
      s += `<g class="nt-n c${dim ? ' dim' : ''}" data-nid="${c.uid}" transform="translate(${p.x.toFixed(1)},${p.y.toFixed(1)})" tabindex="0" role="button" aria-label="${esc(T('角色 ', 'Character ') + c.name)}">${sel === c.uid ? `<circle r="14" class="nt-sel"/>` : ''}<circle r="8" style="fill:var(--${c.system})"/><text class="nt-ct" y="22" text-anchor="middle">${esc(c.name)}</text></g>`;
    }
  });
  svg.innerHTML = s;
}
function renderRelEdit() {
  const el = $('#relEdit'), R = state.roster;
  const head = `<div class="panel-h"><h3>${T('角色关系', 'Character Relationships')}</h3><small>${T(`${state.crel.length} 条`, `${state.crel.length} total`)}</small></div>`;
  if (R.length < 2) { el.innerHTML = head + `<div class="body"><p class="small">${T('名册里至少要有两名角色才能建立关系。可以在角色工坊里存入角色，或点左侧的「一键生成群像」。', 'You need at least two characters in the roster to form relationships. Save some from the Characters tab, or click "Generate a cast" on the left.')}</p></div>`; return; }
  const opts = R.map((c) => `<option value="${c.uid}">${esc(c.name)}</option>`).join('');
  const list = state.crel.map((e, i) => ({ e, i, a: R.find((c) => c.uid === e.a), b: R.find((c) => c.uid === e.b) })).filter((x) => x.a && x.b);
  el.innerHTML = head + `<div class="body">
    <div class="relform"><select id="relA" aria-label="${T('角色甲', 'Character A')}">${opts}</select><select id="relKind" aria-label="${T('关系类型', 'Relationship type')}">${REL_KINDS.map((k) => `<option value="${k.id}">${tf(k.name)}</option>`).join('')}</select><select id="relB" aria-label="${T('角色乙', 'Character B')}">${opts}</select></div>
    <div class="btnrow tight"><button class="btn primary" type="button" data-rel-act="add">${T('建立关系', 'Form relationship')}</button><button class="btn" type="button" data-rel-act="auto">${T('自动补全关系', 'Auto-fill relationships')}</button></div>
    <ul class="rel-list">${list.map(({ e, i, a, b }) => { const k = REL_BY_ID[e.kind]; return `<li class="${k.v > 0 ? 'pos' : k.v < 0 ? 'neg' : 'neu'}"><span class="tag hue c-${a.system}">${esc(a.name)}</span><em>${tf(k.name)}</em><span class="tag hue c-${b.system}">${esc(b.name)}</span><button class="btn" type="button" data-rel-del="${i}" aria-label="${T('删除这条关系', 'Delete this relationship')}">${T('删除', 'Delete')}</button></li>`; }).join('') || `<li class="none">${T('还没有关系。', 'No relationships yet.')}</li>`}</ul></div>`;
  $('#relB').selectedIndex = 1;
}
function setFrel(a, b, v) {
  const i = state.frel.findIndex((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a));
  if (v === 0) { if (i >= 0) state.frel.splice(i, 1); } else if (i >= 0) state.frel[i].v = v; else state.frel.push({ a, b, v });
}
function delFac(id) {
  state.factions = state.factions.filter((f) => f.id !== id);
  state.frel = state.frel.filter((e) => e.a !== id && e.b !== id);
  state.locs.forEach((l) => { if (l.ctrl === id) l.ctrl = ''; });
  state.roster.forEach((c) => { if (c.factionId === id) c.factionId = ''; });
  if (state.char.factionId === id) state.char.factionId = '';
  if (state.netSel === id) state.netSel = '';
  state.selFac = state.factions[0] ? state.factions[0].id : '';
  saveUniverse(); saveRoster(); saveChar();
}
function castCrowd() {
  const room = 30 - state.roster.length;
  if (room <= 0) { toast(T('名册已满（30 个），请先删除一些', 'The roster is full (30) — delete some first')); return; }
  const cast = genCast(Math.min(8, room), state.factions, state.locs, 4);
  cast.forEach((c) => state.roster.push(c));
  const extra = genRelations(state.roster, state.frel, state.crel);
  state.crel.push(...extra);
  saveRoster(); saveUniverse(); renderFacAll(); renderRoster();
  toast(T(`已加入 ${cast.length} 名角色，新增 ${extra.length} 条关系`, `Added ${cast.length} characters and ${extra.length} new relationships`));
}
function bindFac() {
  const t = $('#tab-fac');
  t.addEventListener('click', (e) => {
    const fc = e.target.closest('[data-fac]'); if (fc) { state.selFac = fc.dataset.fac; state.netSel = fc.dataset.fac; renderFacAll(); return; }
    const nn = e.target.closest('[data-nid]');
    if (nn) { const id = nn.dataset.nid; state.netSel = state.netSel === id ? '' : id; if (facById(id)) { state.selFac = id; renderFacList(); renderFacEdit(); } renderNetFilter(); renderNetwork(); return; }
    const nf = e.target.closest('[data-net]');
    if (nf) { if (nf.dataset.net === 'clear') state.netSel = ''; else state.net[nf.dataset.net] = !state.net[nf.dataset.net]; renderNetFilter(); renderNetwork(); return; }
    const fa = e.target.closest('[data-fac-act]');
    if (fa) {
      const f = facById(state.selFac); if (!f) return;
      if (fa.dataset.facAct === 'rename') { f.name = newFaction().name; saveUniverse(); renderFacAll(); }
      else if (fa.dataset.facAct === 'del') { if (state.factions.length <= 1) { toast(T('至少保留一个势力', 'Keep at least one faction')); return; } delFac(f.id); renderFacAll(); toast(T('已删除势力', 'Faction deleted')); }
      return;
    }
    const ra = e.target.closest('[data-rel-act]');
    if (ra) {
      if (ra.dataset.relAct === 'add') {
        const a = $('#relA').value, b = $('#relB').value, kind = $('#relKind').value;
        if (a === b) { toast(T('请选择两名不同的角色', 'Pick two different characters')); return; }
        const i = state.crel.findIndex((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
        if (i >= 0) state.crel[i] = { a, b, kind }; else state.crel.push({ a, b, kind });
        saveUniverse(); renderNetwork(); renderRelEdit(); toast(T('已建立关系', 'Relationship formed'));
      } else { const extra = genRelations(state.roster, state.frel, state.crel); state.crel.push(...extra); saveUniverse(); renderNetwork(); renderRelEdit(); toast(extra.length ? T(`已补全 ${extra.length} 条关系`, `Filled in ${extra.length} relationships`) : T('没有可以补全的关系了', 'Nothing left to fill in')); }
      return;
    }
    const rd = e.target.closest('[data-rel-del]'); if (rd) { state.crel.splice(+rd.dataset.relDel, 1); saveUniverse(); renderNetwork(); renderRelEdit(); }
  });
  t.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest('[data-nid]')) { e.preventDefault(); e.target.closest('[data-nid]').dispatchEvent(new MouseEvent('click', { bubbles: true })); } });
  t.addEventListener('input', (e) => {
    const i = e.target, f = facById(state.selFac); if (!f) return;
    if (i.id === 'facName') { f.name = i.value.slice(0, 28); saveUniverse(); renderFacList(); renderNetwork(); }
    else if (i.id === 'facIdeo') { f.ideology = i.value.slice(0, 160); saveUniverse(); }
    else if (i.dataset.facpow) { syncGauge(i.closest('.gauge')); f.power = +i.value; $('#facPowLab').textContent = i.value; saveUniverse(); renderFacList(); renderNetwork(); }
  });
  t.addEventListener('change', (e) => {
    const i = e.target, f = facById(state.selFac); if (!f) return;
    if (i.id === 'facKind') { f.kind = i.value; }
    else if (i.id === 'facAtt') { f.attitude = i.value; }
    else if (i.id === 'facFav') { f.favored = i.value; }
    else if (i.id === 'facHome') {
      state.locs.forEach((l) => { if (l.ctrl === f.id && l.id === f.home) l.ctrl = ''; });
      f.home = i.value; const l = locById(i.value); if (l) l.ctrl = f.id;
    } else if (i.dataset.frel) { setFrel(f.id, i.dataset.frel, +i.value); }
    else return;
    saveUniverse(); renderFacList(); renderNetwork(); if (i.id === 'facFav') renderFacEdit();
  });
  $('#btnAddFac').addEventListener('click', () => {
    if (state.factions.length >= 14) { toast(T('势力最多 14 个', 'Maximum 14 factions')); return; }
    const f = newFaction(); while (state.factions.some((x) => x.name === f.name)) f.name = newFaction().name;
    const free = state.locs.find((l) => !l.ctrl); if (free) { f.home = free.id; free.ctrl = f.id; }
    state.factions.push(f); state.selFac = f.id; state.netSel = f.id; saveUniverse(); renderFacAll(); toast(T('已新增势力：', 'Added faction: ') + tf(f.name));
  });
  $('#btnCast').addEventListener('click', castCrowd);
}

/* ==========================================================================
   小队
   ========================================================================== */
const squadKeys = () => ['a', 'b'].flatMap((sd) => state.sim.squad[sd].map(charKey));
function renderSquads() {
  const rel = makeRel(state.crel), facsWith = state.factions.filter((f) => state.roster.some((c) => c.factionId === f.id));
  ['a', 'b'].forEach((side) => {
    const team = state.sim.squad[side], syn = squadSynergy(team, rel);
    const avgT = team.length ? sum(team.map((c) => c.tier)) / team.length : 0, avgS = team.length > 1 ? sum(syn) / team.length : 1;
    const opts = `<option value="">${T('选择要加入的角色…', 'Choose a character to add…')}</option><option value="__current">${T('当前工坊角色：', 'Current workshop character: ')}${esc(state.char.name)}</option>` + state.roster.map((c) => `<option value="${c.uid}">${T(`${esc(c.name)}（${tf(SYSTEMS[c.system].name)}，位阶 ${c.tier}）`, `${esc(c.name)} (${tf(SYSTEMS[c.system].name)}, Tier ${c.tier})`)}</option>`).join('') + `<option value="__random">${T('随机生成一名', 'Generate a random one')}</option>`;
    $('#sq' + side.toUpperCase()).innerHTML = `<div class="panel sq-${side}"><div class="panel-h"><h3>${side === 'a' ? T('甲队', 'Team A') : T('乙队', 'Team B')}</h3><small>${T(`${team.length} / 5 人`, `${team.length} / 5`)}${team.length ? T(`，平均位阶 ${avgT.toFixed(1)}，默契 ${avgS >= 1 ? '+' : ''}${Math.round((avgS - 1) * 100)}%`, `, avg tier ${avgT.toFixed(1)}, synergy ${avgS >= 1 ? '+' : ''}${Math.round((avgS - 1) * 100)}%`) : ''}</small></div><div class="body">
      <ul class="members">${team.map((c, i) => `<li class="c-${c.system}"><span class="tag hue">${tf(SYSTEMS[c.system].name)}</span><b>${esc(c.name)}</b><span class="small">${T(`位阶 ${c.tier}`, `Tier ${c.tier}`)}${team.length > 1 ? T(`，默契 ×${syn[i].toFixed(2)}`, `, synergy ×${syn[i].toFixed(2)}`) : ''}</span><button class="btn" type="button" data-sqdel="${side}:${i}" aria-label="${T('移出小队', 'Remove from squad')}">${T('移出', 'Remove')}</button></li>`).join('') || `<li class="none">${T('还没有成员。', 'No members yet.')}</li>`}</ul>
      <div class="inline"><select data-sqsel="${side}" aria-label="${T('选择成员', 'Choose a member')}">${opts}</select><button class="btn" type="button" data-sqadd-btn="${side}">${T('加入', 'Add')}</button></div>
      <div class="btnrow tight"><button class="btn" type="button" data-sqrand="${side}">${T('随机补到 4 人', 'Fill to 4 randomly')}</button><button class="btn" type="button" data-sqclear="${side}">${T('清空', 'Clear')}</button></div>
      ${facsWith.length ? `<label class="field" style="margin:12px 0 0"><span class="small">${T('按势力填入（取名册中的成员）', 'Fill by faction (from roster members)')}</span><select data-sqfac="${side}"><option value="">${T('选择势力…', 'Choose a faction…')}</option>${facsWith.map((f) => `<option value="${f.id}">${esc(tf(f.name))}</option>`).join('')}</select></label>` : ''}
    </div></div>`;
  });
}
function addToSquad(side, val, quiet) {
  if (!val) { toast(T('请先选择要加入的角色', 'Choose a character to add first')); return false; }
  const team = state.sim.squad[side];
  if (team.length >= 5) { toast(T('小队最多 5 人', 'A squad holds at most 5')); return false; }
  let ch;
  if (val === '__random') { const t = team.length ? Math.round(sum(team.map((c) => c.tier)) / team.length) : state.char.tier; ch = newCharacter({ tier: clamp(t + Math.floor(Math.random() * 3) - 1, 1, 9) }); }
  else if (val === '__current') ch = clone(state.char);
  else { const r = state.roster.find((c) => c.uid === val); if (!r) return false; ch = clone(r); }
  if (squadKeys().includes(charKey(ch))) { toast(T('这名角色已经在某支小队中', 'That character is already in a squad')); return false; }
  team.push(ch); state.sim.res = null;
  if (!quiet) { renderSquads(); renderSimOut(); }
  return true;
}
function runSquad() {
  const A = state.sim.squad.a.map(clone), B = state.sim.squad.b.map(clone);
  if (!A.length || !B.length) { toast(T('两支小队都至少需要 1 名成员', 'Both squads need at least 1 member')); return; }
  const world = clone(simWorld()), rel = makeRel(state.crel);
  const res = skirmish(A, B, world, { log: true, rel, rng: mulberry32((Math.random() * 4294967296) >>> 0) });
  const wr = squadWinRate(A, B, world, 200, rel);
  state.sim.res = { kind: 'squad', A, B, world, res, wr };
  renderSimOut(); revealSim();
}
function renderSquadOut(S) {
  const { A, B, world, res, wr } = S, out = $('#simOut'), pct = (x) => Math.round(x * 100), nm = (i) => (i ? T('乙队', 'Team B') : T('甲队', 'Team A'));
  const win = res.winner === 'A' ? 0 : res.winner === 'B' ? 1 : -1;
  const why = res.winner === 'draw' ? T('双方同时倒下，或势均力敌。', 'Both sides fell together, or were evenly matched.') : res.reason === 'wipe' ? T('对方全员倒下或被现实抹去。', 'The opposing team was wiped out or erased by reality.') : T('回合耗尽，按全队剩余状态判定。', 'Rounds ran out; judged by the whole team\'s remaining status.');
  const mvp = res.F.slice().sort((a, b) => b.dmg - a.dmg)[0];
  const panel = (ti) => {
    const rows = res.F.filter((f) => f.ti === ti);
    return `<div class="panel duelist ${ti ? 'sb' : 'sa'}"><h4><span class="side">${nm(ti)}</span>${T(`${rows.filter((r) => r.alive).length} / ${rows.length} 人存活`, `${rows.filter((r) => r.alive).length} / ${rows.length} alive`)}</h4>${rows.map((f) => `<div class="mrow c-${f.sys}${f.alive ? '' : ' down'}"><div class="mh"><b>${esc(f.name)}</b><span class="tag hue">${tf(SYSTEMS[f.sys].name)}</span><span class="small">${f.alive ? T('存活', 'Alive') : f.dead === 'hp' ? T('倒下', 'Fallen') : T('被抹去', 'Erased')}</span></div>${meterHTML(T('生命', 'HP'), f.hp, f.hpMax)}${meterHTML(T('稳定度', 'Stability'), f.stb, f.stbMax, f.stb / f.stbMax < 0.3)}<p class="small">${T(`输出 ${f.dmg}，击倒 ${f.kills}，治疗 ${f.heal}${rows.length > 1 && f.syn !== 1 ? `，默契 ×${f.syn.toFixed(2)}` : ''}`, `Damage ${f.dmg}, KOs ${f.kills}, healing ${f.heal}${rows.length > 1 && f.syn !== 1 ? `, synergy ×${f.syn.toFixed(2)}` : ''}`)}</p></div>`).join('')}</div>`;
  };
  out.innerHTML = `<div class="simgrid">
    <div class="banner ${win === 0 ? 'ta' : win === 1 ? 'tb' : ''}"><h3>${win < 0 ? T('平局', 'Draw') : T(`${nm(win)} 获胜`, `${nm(win)} wins`)}</h3><p>${T(`战场：${esc(world.name)}。共 ${res.rounds} 回合。${why}`, `Battlefield: ${esc(world.name)}. ${res.rounds} rounds. ${why}`)}</p><p class="small">${T(`最高输出：${esc(mvp.name)}（${nm(mvp.ti)}），共造成 ${mvp.dmg} 点伤害。`, `Top damage: ${esc(mvp.name)} (${nm(mvp.ti)}), dealing ${mvp.dmg} total.`)}</p></div>
    <div class="duelists">${panel(0)}${panel(1)}</div>
    <div class="panel"><div class="panel-h"><h3>${T('胜率估算', 'Win Rate Estimate')}</h3><small>${T('同一战场、同样的两队，另外模拟 200 场', 'Same battlefield, same two teams — 200 extra simulated matches')}</small></div><div class="body">
      <div class="wr" role="img" aria-label="${T(`甲队胜率 ${pct(wr.a)}%，平局 ${pct(wr.d)}%，乙队胜率 ${pct(wr.b)}%`, `Team A win rate ${pct(wr.a)}%, draw ${pct(wr.d)}%, Team B win rate ${pct(wr.b)}%`)}"><div class="wa" style="flex:${Math.max(wr.a, 0.001)}">${pct(wr.a) >= 8 ? pct(wr.a) + '%' : ''}</div><div class="wd" style="flex:${Math.max(wr.d, 0.001)}">${pct(wr.d) >= 8 ? pct(wr.d) + '%' : ''}</div><div class="wb" style="flex:${Math.max(wr.b, 0.001)}">${pct(wr.b) >= 8 ? pct(wr.b) + '%' : ''}</div></div>
      <div class="wr-legend"><span>${T('甲队', 'Team A')} ${pct(wr.a)}%</span><span>${T('平局', 'Draw')} ${pct(wr.d)}%</span><span>${T('乙队', 'Team B')} ${pct(wr.b)}%</span></div>
      <p class="small" style="margin-top:8px">${T(`平均 ${wr.rounds.toFixed(1)} 回合分出胜负。${Math.abs(wr.a - wr.b) < 0.12 ? '这是一场势均力敌的对局。' : wr.a > wr.b ? '甲队明显占优。' : '乙队明显占优。'}`, `Averages ${wr.rounds.toFixed(1)} rounds to decide. ${Math.abs(wr.a - wr.b) < 0.12 ? 'A closely matched fight.' : wr.a > wr.b ? 'Team A has a clear edge.' : 'Team B has a clear edge.'}`)}</p></div></div>
    <div class="panel"><div class="panel-h"><h3>${T('全队生存率', 'Team Survival')}</h3><small>${T('每人取生命与稳定度中较低者，再对全队取平均', 'Each member\'s lower of HP and Stability, averaged across the team')}</small></div><div class="body">${timelineSVG(res.tl)}<div class="legend"><span><i></i>${T('甲队', 'Team A')}</span><span><i class="b"></i>${T('乙队', 'Team B')}</span></div></div></div>
    <div class="panel"><div class="panel-h"><h3>${T('战报', 'Battle Report')}</h3><small>${T('蓝线为甲队行动，红线为乙队行动', 'Blue = Team A actions, red = Team B actions')}</small></div><div class="body"><ol class="log">${res.log.map((l) => `<li class="${l.t}${l.i === 0 ? ' ia' : l.i === 1 ? ' ib' : ''}">${l.t === 'r' ? l.x : esc(l.x)}</li>`).join('')}</ol></div></div>
  </div>`;
}
function bindSquad() {
  $('#simMode').addEventListener('click', (e) => { const b = e.target.closest('[data-mode]'); if (!b) return; state.sim.mode = b.dataset.mode; renderSim(); });
  $('#simLoc').addEventListener('change', (e) => { state.sim.loc = e.target.value; state.sim.res = null; renderSimHeader(); renderSimLoc(); renderSimOut(); });
  $('#squadPick').addEventListener('click', (e) => {
    const ad = e.target.closest('[data-sqadd-btn]');
    if (ad) { const side = ad.dataset.sqaddBtn; addToSquad(side, $(`[data-sqsel="${side}"]`).value); return; }
    const dl = e.target.closest('[data-sqdel]');
    if (dl) { const [side, i] = dl.dataset.sqdel.split(':'); state.sim.squad[side].splice(+i, 1); state.sim.res = null; renderSquads(); renderSimOut(); return; }
    const rd = e.target.closest('[data-sqrand]');
    if (rd) { const side = rd.dataset.sqrand; while (state.sim.squad[side].length < 4) if (!addToSquad(side, '__random', true)) break; renderSquads(); renderSimOut(); return; }
    const cl = e.target.closest('[data-sqclear]'); if (cl) { state.sim.squad[cl.dataset.sqclear] = []; state.sim.res = null; renderSquads(); renderSimOut(); }
  });
  $('#squadPick').addEventListener('change', (e) => {
    const sf = e.target.dataset.sqfac; if (!sf || !e.target.value) return;
    const other = state.sim.squad[sf === 'a' ? 'b' : 'a'].map(charKey);
    state.sim.squad[sf] = state.roster.filter((c) => c.factionId === e.target.value && !other.includes(charKey(c))).slice(0, 5).map(clone);
    state.sim.res = null; renderSquads(); renderSimOut();
    if (!state.sim.squad[sf].length) toast(T('这个势力的成员都在另一支小队里了', "This faction's members are all on the other squad"));
  });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-sqadd]'); if (!b) return;
    const [side, uid] = b.dataset.sqadd.split(':');
    if (addToSquad(side, uid, true)) { toast(T(`已加入${side === 'a' ? '甲队' : '乙队'}`, `Added to Team ${side === 'a' ? 'A' : 'B'}`)); renderSquads(); renderSimOut(); }
  });
}

function bindUniverse() { bindMap(); bindFac(); bindSquad(); }
