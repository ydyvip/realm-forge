'use strict';
/* ==========================================================================
   万象工坊 · 界面层（三）：角色成长展示 + 远征（行军 / 遭遇 / 战争 / 领土）
   ========================================================================== */

/* ---------- 角色卡：成长与经历 ---------- */
function vstat(ch, key, max, label) {
  const cd = ch.cond, cur = cd && cd[key] != null ? Math.round(max * clamp(cd[key], 0, 1)) : max;
  const hurt = cur < max - 0.5;
  return `<div class="stat${hurt ? ' hurt' : ''}"><b class="num">${cur}${hurt ? `<em>/${max}</em>` : ''}</b><span>${label}</span></div>`;
}
function growthHTML(ch, d) {
  const need = xpNeed(ch.tier), xp = clamp(ch.xp || 0, 0, need), atCap = ch.tier >= 9;
  const marks = ch.marks || [], hist = ch.hist || [];
  const taint = ch.taint || 0;
  return `<h4>${T('成长与经历', 'Growth & History')}<small>${atCap ? T('已至位阶上限', 'At tier cap') : T(`距晋升还差 ${need - xp} 经验`, `${need - xp} XP to next tier`)}</small></h4>
    ${atCap ? '' : `<div class="xpbar"><i style="width:${(xp / need * 100).toFixed(1)}%"></i></div><p class="small">${T(`位阶 ${ch.tier} → ${ch.tier + 1}　${Math.round(xp)} / ${need}`, `Tier ${ch.tier} → ${ch.tier + 1}  ${Math.round(xp)} / ${need}`)}</p>`}
    ${taint > 0 ? `<p class="small">${T(`额外异化侵蚀：${taint}%（计入异化度）`, `Extra anomalous drift: ${taint}% (counted into Corruption)`)}</p>` : ''}
    ${marks.length ? `<div class="marks"><b>${T('身上的烙印', 'Marks Carried')}</b><ul>${marks.map((m) => `<li>${esc(m)}</li>`).join('')}</ul></div>` : ''}
    ${hist.length ? `<div class="histlog"><b>${T('经历', 'History')}</b><ul>${hist.slice(0, 6).map((h) => `<li><em>${T(`第 ${h.t} 旬`, `Turn ${h.t}`)}</em>${esc(h.x)}</li>`).join('')}</ul></div>` : `<p class="small">${T('这名角色还没有踏上过远征。', 'This character has never been on an expedition.')}</p>`}`;
}

/* ---------- 状态与持久化 ---------- */
function campCtx() { return { world: state.world, roster: state.roster, factions: state.factions, frel: state.frel, crel: state.crel, locs: state.locs, routes: state.routes }; }
function persistCamp() { STORE.set('camp', state.camp); saveRoster(); saveUniverse(); }
function validCamp(c) { return !!(c && c.party && Array.isArray(c.party.ids) && typeof c.turn === 'number' && Array.isArray(c.wars) && Array.isArray(c.chron) && Array.isArray(c.battles)); }
function initCamp() {
  const c = STORE.get('camp');
  state.camp = validCamp(c) ? c : newCamp();
  state.camp.party.ids = state.camp.party.ids.filter((id) => state.roster.some((r) => r.uid === id));
  if (!locById(state.camp.party.loc)) state.camp.party.loc = state.locs[0] ? state.locs[0].id : '';
  if (state.camp.party.route && !locById(state.camp.party.route.to)) { state.camp.party.route = null; state.camp.party.path = []; }
  if (state.camp.quest && !locById(state.camp.quest.target)) state.camp.quest = null;
  state.campSel = [];
}
function fixCampAfterMapChange() {
  const c = state.camp; if (!c) return;
  if (!locById(c.party.loc)) c.party.loc = state.locs[0] ? state.locs[0].id : '';
  c.party.route = null; c.party.path = []; c.pending = null;
  if (c.quest && !locById(c.quest.target)) c.quest = null;
  persistCamp();
}

/* ---------- 小工具 ---------- */
function checkPreview(attr, dc) {
  const mem = partyOf(campCtx(), state.camp).filter((c) => condOf(c).hp > 0.05);
  if (!mem.length) return null;
  const v = mem.map((c) => derive(c).a[attr]).sort((a, b) => b - a);
  const score = v[0] + 0.25 * (v[1] || 0);
  return clamp(0.5 + (score - dc) * 0.05, 0.08, 0.95);
}
const CHRON_LABEL = { zh: { march: '行军', event: '遭遇', war: '战争', dip: '外交', grow: '成长' }, en: { march: 'March', event: 'Encounter', war: 'War', dip: 'Diplomacy', grow: 'Growth' } };
function reachableLocs() {
  const from = state.camp.party.loc;
  return state.locs.map((l) => ({ l, path: l.id === from ? [] : bfsPath(state.routes, from, l.id) })).filter((x) => x.l.id === from || x.path);
}

/* ---------- 渲染：调度 ---------- */
function renderCamp() {
  const started = state.camp.party.ids.length > 0 || state.camp.turn > 0;
  $('#campNoParty').hidden = started;
  $('#campActive').hidden = !started;
  if (!started) { renderCampBuilder(); return; }
  renderCampStatus();
  renderCampEncounter();
  renderCampControls();
  renderCampParty();
  renderCampQuest();
  renderCampMapSvg();
  renderCampTerritory();
  renderCampChron();
}

function renderCampBuilder() {
  const opts = state.roster.map((c) => `<option value="${c.uid}">${esc(c.name)}（${tf(SYSTEMS[c.system].name)}，${T(`位阶 ${c.tier}`, `Tier ${c.tier}`)}）</option>`).join('');
  const sel = state.campSel || [];
  $('#campBuilder').innerHTML = `
    <ul class="members">${sel.map((uid) => { const c = state.roster.find((x) => x.uid === uid); if (!c) return ''; return `<li class="c-${c.system}"><span class="tag hue">${tf(SYSTEMS[c.system].name)}</span><b>${esc(c.name)}</b><span class="small">${T(`位阶 ${c.tier}`, `Tier ${c.tier}`)}</span><button class="btn" type="button" data-campselrm="${uid}">${T('移出', 'Remove')}</button></li>`; }).join('') || `<li class="none">${T('还没有成员。', 'No members yet.')}</li>`}</ul>
    <div class="inline"><select id="campBuildSel" aria-label="${T('选择角色', 'Choose a character')}">${state.roster.length ? `<option value="">${T('选择要加入的角色…', 'Choose a character to add…')}</option>` + opts : `<option value="">${T('名册是空的', 'The roster is empty')}</option>`}</select><button class="btn" type="button" id="btnCampBuildAdd">${T('加入', 'Add')}</button></div>
    ${!state.roster.length ? `<p class="small">${T('名册还是空的：先到「角色工坊」创建角色，或到「势力关系」页一键生成群像。', 'The roster is empty: create a character in the Character Forge, or generate a cast on the Factions page.')}</p>` : ''}`;
  $('#campStartLoc').innerHTML = state.locs.map((l) => `<option value="${l.id}">${esc(l.name)}（${tf(LOC_BY_ID[l.type].name)}）</option>`).join('');
  $('#btnCampStart').disabled = !sel.length;
}
function campLawHTML(lw) {
  const m = worldMods(lw), idx = m.index, act = PHENOMENA.filter((p) => p.on(lw.dials));
  const mods = SYS_IDS.map((k) => `<div class="mod c-${k}"><span class="nm">${tf(SYSTEMS[k].name)}</span><div class="mini"><i style="width:${clamp(m.sys[k] / 1.9 * 100, 2, 100).toFixed(1)}%"></i></div><span class="mv">×${m.sys[k].toFixed(2)}</span></div>`).join('');
  return `<div class="wr-read"><div><p class="small">${describeWorld(lw)}</p><div class="mods" style="margin-top:8px">${mods}</div></div><div class="wr-num"><span class="num big">${Math.round(idx)}</span><span class="small">${T('局部违常指数', 'Local Abnormality')}<br>${abnLabel(idx)}${act.length ? `<br>${act.map((p) => tf(p.name)).join(T('、', ', '))}` : ''}</span></div></div>`;
}
function currentLawWorld() {
  const P = state.camp.party, here = locById(P.loc);
  if (P.route) { const to = locById(P.route.to); if (to) return midWorld(campCtx(), here, to); }
  return localWorld(state.world, here);
}
function renderCampStatus() {
  const P = state.camp.party, here = locById(P.loc), f = here && here.ctrl ? facById(here.ctrl) : null;
  $('#campLocName').textContent = P.route ? T(`行军途中，前往「${(locById(P.route.to) || {}).name || ''}」`, `On the march to "${(locById(P.route.to) || {}).name || ''}"`) : T(`驻扎于「${esc(here ? here.name : '未知之地')}」`, `Camped at "${esc(here ? here.name : 'an unknown place')}"`);
  const rep = f ? state.camp.rep[f.id] || 0 : 0;
  $('#campMeta').textContent = T(`第 ${state.camp.turn} 旬${here ? `　${tf(LOC_BY_ID[here.type].name)}` : ''}${f ? `　由${tf(f.name)}控制（声望 ${signed(rep)}）` : ''}${isSafe(state.camp, here) && !P.route ? '　安全地带' : ''}`,
    `Turn ${state.camp.turn}${here ? `  ${tf(LOC_BY_ID[here.type].name)}` : ''}${f ? `  Controlled by ${tf(f.name)} (Reputation ${signed(rep)})` : ''}${isSafe(state.camp, here) && !P.route ? '  Safe zone' : ''}`);
  $('#campLocLaw').innerHTML = campLawHTML(currentLawWorld());
  const bar = $('#campSupplyBar'); bar.style.width = clamp(P.supply, 0, 100).toFixed(1) + '%';
  const lbl = bar.closest('.field').querySelector('span'); if (lbl) lbl.textContent = T(`补给（${Math.round(P.supply)} / 100）`, `Supply (${Math.round(P.supply)} / 100)`);
}
function renderCampEncounter() {
  const sc = state.camp.pending, box = $('#campEncounter'), controls = $('#campControls');
  box.hidden = !sc; controls.hidden = !!sc;
  if (!sc) return;
  $('#encTitle').textContent = sc.title;
  $('#encText').textContent = sc.text;
  $('#encOpts').innerHTML = sc.opts.map((op, i) => {
    const p = op.check ? checkPreview(op.check.attr, op.check.dc) : null;
    return `<button type="button" class="encbtn" data-encopt="${i}"><b>${esc(op.label)}</b>${op.hint ? `<span>${esc(op.hint)}${p != null ? T(`　预计成功率 ${Math.round(p * 100)}%`, `  est. success ${Math.round(p * 100)}%`) : ''}</span>` : ''}</button>`;
  }).join('');
}
function partyMetaText(mem) {
  if (!mem.length) return T('队伍已经散了', 'The party has disbanded');
  const tierAvg = (sum(mem.map((c) => c.tier)) / mem.length).toFixed(1), hpAvg = Math.round(sum(mem.map((c) => condOf(c).hp)) / mem.length * 100);
  return T(`${mem.length} 人，平均位阶 ${tierAvg}，平均生命 ${hpAvg}%`, `${mem.length} members, avg. tier ${tierAvg}, avg. HP ${hpAvg}%`);
}
function renderCampControls() {
  const P = state.camp.party, mem = partyOf(campCtx(), state.camp);
  const list = reachableLocs();
  $('#campDest').innerHTML = list.map(({ l, path }) => `<option value="${l.id}"${l.id === P.loc ? ' disabled' : ''}>${esc(l.name)}${l.id === P.loc ? T('（当前位置）', ' (current)') : path ? T(`（约 ${path.reduce((s, id, i) => s + edgeTurns(state.locs, i === 0 ? P.loc : path[i - 1], id), 0)} 旬）`, ` (~${path.reduce((s, id, i) => s + edgeTurns(state.locs, i === 0 ? P.loc : path[i - 1], id), 0)} turns)`) : ''}</option>`).join('');
  if (P.route) $('#campDest').value = P.route.to;
  $('#campRouteNote').textContent = P.route ? T(`距「${(locById(P.route.to) || {}).name}」还需 ${P.route.left} 旬`, `${P.route.left} turns to "${(locById(P.route.to) || {}).name}"`) : mem.length ? T('尚未设定目的地', 'No destination set') : T('队伍是空的，无法行动', 'The party is empty and cannot act');
  const noMem = !mem.length;
  $('#btnMarchOne').disabled = !P.route || noMem; $('#btnMarchAuto').disabled = !P.route || noMem;
  $('#btnRest').disabled = noMem; $('#btnWait1').disabled = noMem; $('#btnWait5').disabled = noMem;
  const last = state.camp.last;
  $('#campLast').innerHTML = last ? `<b>${esc(last.title)}</b><ul>${last.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>${last.battle ? `<button class="btn" type="button" id="btnCampBattleLog" style="margin-top:8px">${T(`查看战报（${last.battle.rounds} 回合）`, `View battle report (${last.battle.rounds} rounds)`)}</button><ol class="log" id="campBattleLog" hidden>${last.battle.log.map((x) => `<li class="${x.t}${x.i === 0 ? ' ia' : x.i === 1 ? ' ib' : ''}">${x.t === 'r' ? x.x : esc(x.x)}</li>`).join('')}</ol>` : ''}` : `<p class="small">${T('还没有发生什么。', 'Nothing has happened yet.')}</p>`;
}
function renderCampQuest() {
  const q = state.camp.quest, el = $('#campQuestPanel');
  if (!q) { el.innerHTML = ''; return; }
  const f = facById(q.fid), left = q.deadline - state.camp.turn;
  el.innerHTML = `<div class="panel-h"><h3>${T('当前委托', 'Current Commission')}</h3><small>${f ? tf(f.name) : ''}</small></div><div class="body"><p><b>${esc(q.title)}</b></p><p class="small">${T(`目标地点：${esc((locById(q.target) || {}).name || '')}　还剩 ${left} 旬　报酬：经验 ${q.reward.xp}${q.reward.supply ? `，补给 ${q.reward.supply}` : ''}`, `Target: ${esc((locById(q.target) || {}).name || '')}  ${left} turns left  Reward: ${q.reward.xp} XP${q.reward.supply ? `, ${q.reward.supply} supply` : ''}`)}</p></div>`;
}
function renderCampParty() {
  const mem = partyOf(campCtx(), state.camp);
  $('#campPartyMeta').textContent = partyMetaText(mem);
  $('#campPartyList').innerHTML = mem.map((c) => { const cd = condOf(c); return `<li class="c-${c.system} pmember"><div class="pmh"><span class="tag hue">${tf(SYSTEMS[c.system].name)}</span><b>${esc(c.name)}</b><span class="small">${T(`位阶 ${c.tier}`, `Tier ${c.tier}`)}</span><button class="btn" type="button" data-camprm="${c.uid}">${T('移出', 'Remove')}</button></div>${meterHTML(T('生命', 'HP'), cd.hp * 100, 100)}${meterHTML(T('稳定度', 'Stability'), cd.stb * 100, 100, cd.stb < 0.3)}</li>`; }).join('') || `<p class="small">${T('队伍是空的。', 'The party is empty.')}</p>`;
  const busy = new Set(mem.map((c) => c.uid));
  $('#campAddSel').innerHTML = `<option value="">${T('加入新成员…', 'Add a new member…')}</option>` + state.roster.filter((c) => !busy.has(c.uid)).map((c) => `<option value="${c.uid}">${esc(c.name)}（${tf(SYSTEMS[c.system].name)}，${T(`位阶 ${c.tier}`, `Tier ${c.tier}`)}）</option>`).join('');
}
function renderCampTerritory() {
  const wars = state.camp.wars.map((w) => { const A = facById(w.a), B = facById(w.b); return A && B ? `<span class="tag" style="border-color:${facColor(A)}">${esc(tf(A.name))} ⚔ ${esc(tf(B.name))}</span>` : ''; }).filter(Boolean).join(' ');
  $('#campWarNote').textContent = state.camp.wars.length ? T(`${state.camp.wars.length} 场战争进行中`, `${state.camp.wars.length} wars underway`) : T('目前没有战争', 'No wars right now');
  $('#campTerritory').innerHTML = state.factions.map((f) => `<span class="tag" style="border-color:${facColor(f)};color:${facColor(f)}">${esc(tf(f.name))} · ${ownOf(campCtx(), f.id).length}</span>`).join('') + (wars ? '<br><br>' + wars : '') + (state.locs.some((l) => !l.ctrl) ? ` <span class="tag">${T('无主', 'Unclaimed')} · ${state.locs.filter((l) => !l.ctrl).length}</span>` : '');
}
function renderCampChron() {
  $('#campChron').innerHTML = state.camp.chron.slice(0, 40).map((c) => `<li class="ck-${c.k}"><em>${T(`第 ${c.t} 旬`, `Turn ${c.t}`)}</em><b>${CHRON_LABEL[LANG][c.k] || ''}</b>${esc(c.x)}</li>`).join('') || `<li class="none">${T('还没有记录。', 'No records yet.')}</li>`;
}

/* ---------- 地图（含队伍标记与路线高亮） ---------- */
function renderCampMapSvg() {
  const svg = $('#campMapSvg'), rr = makeRng('terrain|' + state.world.name), P = state.camp.party;
  let s = '';
  for (let i = 0; i < 5; i++) { const cx = rr.range(80, MAP_W - 80), cy = rr.range(70, MAP_H - 70), r = rr.range(70, 150); [1, 0.68, 0.4].forEach((k) => { s += `<path class="mp-c" d="${blobPath(cx, cy, r * k, rr)}"/>`; }); }
  const pathArr = [P.loc].concat(P.path || []);
  state.routes.forEach(([a, b]) => {
    const A = locById(a), B = locById(b); if (!A || !B) return;
    const ia = pathArr.indexOf(a), ib = pathArr.indexOf(b), on = ia >= 0 && ib >= 0 && Math.abs(ia - ib) === 1;
    s += `<line class="mp-r${on ? ' path' : ''}" x1="${mx(A).toFixed(1)}" y1="${my(A).toFixed(1)}" x2="${mx(B).toFixed(1)}" y2="${my(B).toFixed(1)}"/>`;
  });
  state.locs.forEach((l) => {
    const t = LOC_BY_ID[l.type], idx = abnormality(localWorld(state.world, l)), f = facById(l.ctrl), here = l.id === P.loc, onRoute = pathArr.includes(l.id) && !here;
    const bf = state.camp.battles.find((b) => b.loc === l.id);
    s += `<g class="lnode static${here ? ' here' : ''}${onRoute ? ' onroute' : ''}" data-camploc="${l.id}" transform="translate(${mx(l).toFixed(1)},${my(l).toFixed(1)})" tabindex="0" role="button" aria-label="${esc(T(`前往${l.name}`, `Travel to ${l.name}`))}">
      ${f ? `<circle r="36" class="mp-halo" style="fill:${facColor(f)};stroke:${facColor(f)}"/>` : ''}
      <circle r="21" class="mp-ringbg"/><circle r="21" class="mp-ring" stroke-dasharray="${(idx / 100 * 2 * Math.PI * 21).toFixed(1)} 999" transform="rotate(-90)"/>
      <g class="lg">${glyphSVG(t.glyph)}</g>
      ${bf ? '<text class="mp-bf" y="6" text-anchor="middle">⚔</text>' : ''}
      ${here ? '<circle r="30" class="camp-pulse"/><path d="M0 -30 L-6 -20 L6 -20 Z" class="camp-flag"/>' : ''}
      <text class="mp-n" y="-27" text-anchor="middle">${Math.round(idx)}</text>
      <text class="mp-t" y="41" text-anchor="middle">${esc(l.name)}</text>
    </g>`;
  });
  svg.innerHTML = s;
}

/* ---------- 行动 ---------- */
function startCampaign(ids, locId) {
  state.camp = newCamp(); state.camp.party.ids = ids.slice(0, 6); state.camp.party.loc = locId; state.camp.party.supply = 100;
  state.campSel = []; persistCamp(); renderCamp(); toast(T('远征开始！', 'The expedition begins!'));
}
function resetCampaign() { state.camp = newCamp(); state.camp.party.loc = state.locs[0] ? state.locs[0].id : ''; state.campSel = []; persistCamp(); renderCamp(); toast(T('已重新组队', 'Party re-formed')); }
function afterCampAction() {
  persistCamp(); renderCamp();
  const el = !$('#campEncounter').hidden ? $('#campEncounter') : $('#campLast');
  if (el && el.scrollIntoView) el.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
}
function doMarch(auto) {
  const ctx = campCtx(); if (!state.camp.party.route) return;
  let n = 0;
  do { stepTurn(ctx, state.camp, 'march'); n++; } while (auto && n < 12 && state.camp.party.route && !state.camp.pending);
  afterCampAction();
}
function doRest() { stepTurn(campCtx(), state.camp, 'rest'); afterCampAction(); }
function doWait(n) { const ctx = campCtx(); if (n === 1) stepTurn(ctx, state.camp, 'wait'); else waitTurns(ctx, state.camp, n); afterCampAction(); }
function doSetDest(id) { if (!id || id === state.camp.party.loc) return; if (!setDest(campCtx(), state.camp, id)) { toast(T('到不了那里：中间没有连通的路线', "Can't get there: no connected route")); return; } persistCamp(); renderCampControls(); renderCampMapSvg(); }
function doResolveEncounter(idx) { resolveEncounter(campCtx(), state.camp, idx); afterCampAction(); }
function addPartyMember(uid) {
  if (!uid) return;
  if (state.camp.party.ids.length >= 6) { toast(T('远征队最多 6 人', 'A party holds at most 6')); return; }
  state.camp.party.ids.push(uid); persistCamp(); renderCampParty(); toast(T('已加入远征队', 'Added to the party'));
}
function removePartyMember(uid) { state.camp.party.ids = state.camp.party.ids.filter((x) => x !== uid); persistCamp(); renderCamp(); }

function bindCamp() {
  const bBuild = $('#campNoParty');
  bBuild.addEventListener('click', (e) => {
    if (e.target.id === 'btnCampBuildAdd') {
      const v = $('#campBuildSel').value; if (!v) return;
      state.campSel = state.campSel || []; if (!state.campSel.includes(v) && state.campSel.length < 6) state.campSel.push(v);
      renderCampBuilder(); return;
    }
    const rm = e.target.closest('[data-campselrm]'); if (rm) { state.campSel = (state.campSel || []).filter((x) => x !== rm.dataset.campselrm); renderCampBuilder(); return; }
    if (e.target.id === 'btnCampStart') { const sel = state.campSel || []; if (!sel.length) { toast(T('至少选一名角色', 'Pick at least one character')); return; } startCampaign(sel, $('#campStartLoc').value); }
  });

  const active = $('#campActive');
  active.addEventListener('click', (e) => {
    if (e.target.id === 'btnMarchOne') return doMarch(false);
    if (e.target.id === 'btnMarchAuto') return doMarch(true);
    if (e.target.id === 'btnRest') return doRest();
    if (e.target.id === 'btnWait1') return doWait(1);
    if (e.target.id === 'btnWait5') return doWait(5);
    if (e.target.id === 'btnCampReset') return resetCampaign();
    if (e.target.id === 'btnCampAdd') return addPartyMember($('#campAddSel').value);
    if (e.target.id === 'btnCampBattleLog') { const lg = $('#campBattleLog'); if (lg) lg.hidden = !lg.hidden; return; }
    const rm = e.target.closest('[data-camprm]'); if (rm) return removePartyMember(rm.dataset.camprm);
    const opt = e.target.closest('[data-encopt]'); if (opt) return doResolveEncounter(+opt.dataset.encopt);
    const loc = e.target.closest('[data-camploc]'); if (loc) { if (state.camp.pending) { toast(T('先处理眼下的遭遇', 'Resolve the current encounter first')); return; } doSetDest(loc.dataset.camploc); }
  });
  active.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('[data-camploc]')) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); } });
  $('#campDest').addEventListener('change', (e) => doSetDest(e.target.value));
}
