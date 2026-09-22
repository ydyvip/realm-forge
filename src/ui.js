"use strict";
/* ==========================================================================
   万象工坊 · 界面层
   ========================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clone = (o) => JSON.parse(JSON.stringify(o));
const STORE = {
  get(k) {
    try {
      const v = localStorage.getItem("realmforge:v1:" + k);
      return v ? JSON.parse(v) : null;
    } catch (e) {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem("realmforge:v1:" + k, JSON.stringify(v));
    } catch (e) {
      /* 存储不可用时静默 */
    }
  },
};
const SHORT = {
  gravity: "重力",
  time: "时间",
  space: "空间",
  entropy: "熵律",
  aether: "灵能",
  anomaly: "异常",
  causality: "因果",
  mind: "心念",
};
const state = {
  tab: "guide",
  world: null,
  char: null,
  roster: [],
  events: [],
  factions: [],
  frel: [],
  crel: [],
  locs: [],
  routes: [],
  selLoc: "",
  selFac: "",
  netSel: "",
  net: { f: true, c: true, m: true },
  sim: {
    mode: "duel",
    a: "__current",
    b: "__random",
    opp: null,
    res: null,
    loc: "",
    squad: { a: [], b: [] },
  },
};
const reduceMotion = () =>
  !!(
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

function validChar(c) {
  return !!(
    c &&
    c.seed &&
    c.attrs &&
    c.abilities &&
    c.abilities.length >= 4 &&
    SYSTEMS[c.system] &&
    ORIGIN_BY_ID[c.origin] &&
    c.persona &&
    c.look &&
    c.bg &&
    c.nonce &&
    ARCH_BY_ID[c.archetype]
  );
}
function validWorld(w) {
  return !!(
    w &&
    w.dials &&
    DIALS.every((d) => typeof w.dials[d.id] === "number")
  );
}
let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("on"), 1800);
}

/* ---------- SVG：量规、雷达、印记、三角、时间线 ---------- */
function gaugeHTML({
  min = 0,
  max = 100,
  value,
  mode = "fill",
  base = 0,
  attrs = "",
  label = "",
  tone = "",
}) {
  const f = (value - min) / (max - min);
  const a = mode === "dev" ? Math.min(f, base) : 0,
    b = mode === "dev" ? Math.max(f, base) : f;
  return `<div class="gauge" data-mode="${mode}" data-tone="${tone}" data-base="${base}" style="--a:${a};--b:${b};--base:${base}"><span class="trk"></span>${mode === "dev" ? '<span class="tick"></span>' : ""}<span class="fill"></span><input type="range" min="${min}" max="${max}" step="1" value="${value}" ${attrs} aria-label="${esc(label)}"></div>`;
}
function syncGauge(g) {
  const i = g.querySelector("input"),
    min = +i.min,
    max = +i.max,
    f = (+i.value - min) / (max - min),
    base = +g.dataset.base || 0,
    dev = g.dataset.mode === "dev";
  g.style.setProperty("--a", dev ? Math.min(f, base) : 0);
  g.style.setProperty("--b", dev ? Math.max(f, base) : f);
}

function radarSVG(vals, labels, max, opts = {}) {
  const size = opts.size || 300,
    pad = opts.pad || 46,
    c = size / 2,
    R = size / 2 - pad,
    n = vals.length,
    ink = opts.ink ? " ink" : "";
  const pt = (i, v) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [
      c + ((R * v) / max) * Math.cos(a),
      c + ((R * v) / max) * Math.sin(a),
    ];
  };
  const ring = (f) =>
    Array.from({ length: n }, (_, i) =>
      pt(i, max * f)
        .map((x) => x.toFixed(1))
        .join(","),
    ).join(" ");
  let s = `<svg viewBox="0 0 ${size} ${size}" class="radar" role="img" aria-label="${esc(opts.aria || t("雷达图"))}">`;
  [0.25, 0.5, 0.75, 1].forEach((f) => {
    s += `<polygon class="rd-grid${f === 1 ? " base" : ""}" points="${ring(f)}"/>`;
  });
  for (let i = 0; i < n; i++) {
    const [x, y] = pt(i, max);
    s += `<line class="rd-axis" x1="${c}" y1="${c}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`;
  }
  const pts = vals
    .map((v, i) =>
      pt(i, clamp(v, 0, max))
        .map((x) => x.toFixed(1))
        .join(","),
    )
    .join(" ");
  s += `<polygon class="rd-area${ink}" points="${pts}"/>`;
  vals.forEach((v, i) => {
    const [x, y] = pt(i, clamp(v, 0, max));
    s += `<circle class="rd-dot${ink}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3"/>`;
  });
  labels.forEach((l, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    s += `<text class="rd-label" x="${(c + (R + pad * 0.42) * Math.cos(a)).toFixed(1)}" y="${(c + (R + pad * 0.42) * Math.sin(a) + 4).toFixed(1)}">${esc(l)}</text>`;
  });
  return s + "</svg>";
}
function drawRadar(el, vals, labels, max, opts) {
  if (el._raf && typeof cancelAnimationFrame === "function")
    cancelAnimationFrame(el._raf);
  el._vals = vals;
  el.innerHTML = radarSVG(vals, labels, max, opts);
}
function animateRadar(el, to, labels, max, opts) {
  const from = el._vals || to.map(() => 0);
  if (reduceMotion() || typeof requestAnimationFrame !== "function") {
    drawRadar(el, to, labels, max, opts);
    return;
  }
  if (el._raf) cancelAnimationFrame(el._raf);
  el._vals = to;
  const t0 = performance.now(),
    dur = 460;
  const step = (now) => {
    const t = Math.min(1, (now - t0) / dur),
      e = 1 - Math.pow(1 - t, 3);
    el.innerHTML = radarSVG(
      from.map((v, i) => v + (to[i] - v) * e),
      labels,
      max,
      opts,
    );
    if (t < 1) el._raf = requestAnimationFrame(step);
  };
  el._raf = requestAnimationFrame(step);
}

function sigilSVG(ch) {
  const r = makeRng(ch.seed + "|sigil"),
    n = [3, 4, 5, 6, 7, 8, 9][r.int(0, 6)],
    rot = r.range(0, Math.PI * 2),
    rings = 1 + Math.round(ch.tier / 3);
  const P = (rad, ang) => [60 + rad * Math.cos(ang), 60 + rad * Math.sin(ang)];
  const f1 = (v) => v.toFixed(1);
  const poly = (rad, k, off) =>
    Array.from({ length: k }, (_, i) =>
      P(rad, off + (i * 2 * Math.PI) / k)
        .map(f1)
        .join(","),
    ).join(" ");
  let s = `<circle cx="60" cy="60" r="56" class="sg-a"/>`;
  for (let i = 0; i < rings; i++)
    s += `<circle cx="60" cy="60" r="${48 - i * 7}" class="${i % 2 ? "sg-b" : "sg-a"}"/>`;
  const tk = n * r.int(2, 4);
  for (let i = 0; i < tk; i++) {
    const a = rot + (i * 2 * Math.PI) / tk,
      p1 = P(56, a),
      p2 = P(51, a);
    s += `<line class="sg-a" x1="${f1(p1[0])}" y1="${f1(p1[1])}" x2="${f1(p2[0])}" y2="${f1(p2[1])}"/>`;
  }
  s += `<polygon class="sg-a" points="${poly(34, n, rot)}"/>`;
  if (n >= 5) {
    const k = n % 2 ? 2 : n % 3 ? 3 : 1;
    s += `<polygon class="sg-b" points="${Array.from({ length: n }, (_, i) =>
      P(34, rot + (((i * k) % n) * 2 * Math.PI) / n)
        .map(f1)
        .join(","),
    ).join(" ")}"/>`;
  }
  for (let i = 0; i < n; i++) {
    const p = P(34, rot + (i * 2 * Math.PI) / n);
    s += `<circle class="sg-f" cx="${f1(p[0])}" cy="${f1(p[1])}" r="2.2"/>`;
  }
  if (ch.system === "magic")
    s += `<polygon class="sg-a" points="${poly(13, 3, rot)}"/><polygon class="sg-a" points="${poly(13, 3, rot + Math.PI)}"/>`;
  else if (ch.system === "anomaly")
    s += `<circle class="sg-a" cx="60" cy="60" r="11"/><circle class="sg-b" cx="64" cy="57" r="11"/>`;
  else if (ch.system === "psi")
    s += `<circle class="sg-a" cx="60" cy="60" r="5"/><circle class="sg-b" cx="60" cy="60" r="10"/><circle class="sg-a" cx="60" cy="60" r="15" style="stroke-dasharray:6 4"/>`;
  else
    s += `<polygon class="sg-a" points="60,44 50,62 70,62"/><line class="sg-a" x1="46" y1="68" x2="74" y2="68"/><circle class="sg-f" cx="60" cy="56" r="2"/>`;
  return `<svg class="sigil" viewBox="0 0 120 120" role="img" aria-label="${t("{0}的印记", esc(ch.name))}">${s}</svg>`;
}

function triangleSVG() {
  const N = { magic: [180, 52], anomaly: [316, 252], psi: [44, 252] },
    R = 38,
    C = [180, 186];
  const names = { magic: "魔法", anomaly: "异常", psi: "超能力" };
  const pairs = [
    ["magic", "anomaly"],
    ["anomaly", "psi"],
    ["psi", "magic"],
  ];
  let s = `<svg viewBox="0 0 360 310" role="img" aria-label="${t("魔法克制异常，异常克制超能力，超能力克制魔法，权能位于中央")}"><defs><marker id="arw" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" class="tri-h"/></marker></defs>`;
  Object.keys(N).forEach((k) => {
    s += `<line class="tri-d" x1="${C[0]}" y1="${C[1]}" x2="${N[k][0]}" y2="${N[k][1]}"/>`;
  });
  pairs.forEach(([a, b]) => {
    const p = N[a],
      q = N[b],
      dx = q[0] - p[0],
      dy = q[1] - p[1],
      L = Math.hypot(dx, dy),
      ux = dx / L,
      uy = dy / L;
    const s0 = [p[0] + ux * (R + 6), p[1] + uy * (R + 6)],
      e0 = [q[0] - ux * (R + 12), q[1] - uy * (R + 12)];
    s += `<line class="tri-l" x1="${s0[0].toFixed(1)}" y1="${s0[1].toFixed(1)}" x2="${e0[0].toFixed(1)}" y2="${e0[1].toFixed(1)}" marker-end="url(#arw)"/>`;
    const mx = (p[0] + q[0]) / 2,
      my = (p[1] + q[1]) / 2,
      nx = mx - C[0],
      ny = my - C[1],
      nl = Math.hypot(nx, ny);
    s += `<text class="tri-s" x="${(mx + (nx / nl) * 18).toFixed(1)}" y="${(my + (ny / nl) * 18 + 4).toFixed(1)}" text-anchor="middle">×1.25</text>`;
  });
  Object.keys(N).forEach((k) => {
    s += `<circle class="tri-n" cx="${N[k][0]}" cy="${N[k][1]}" r="${R}" style="stroke:var(--${k})"/><text class="tri-t" x="${N[k][0]}" y="${N[k][1] + 5}" text-anchor="middle" style="fill:var(--${k})">${t(names[k])}</text>`;
  });
  s += `<circle class="tri-n" cx="${C[0]}" cy="${C[1]}" r="27" style="stroke:var(--dominion)"/><text class="tri-t" x="${C[0]}" y="${C[1] + 5}" text-anchor="middle" style="fill:var(--dominion)">${t("权能")}</text><text class="tri-s" x="${C[0]}" y="${C[1] + 46}" text-anchor="middle">${t("对三者 ×1.15，受戒律约束")}</text></svg>`;
  return s;
}

function timelineSVG(tl) {
  const W = 560,
    H = 176,
    L = 38,
    Rr = 12,
    T = 12,
    B = 26,
    n = tl.length;
  const x = (i) => L + (W - L - Rr) * (n === 1 ? 0 : i / (n - 1)),
    y = (v) => T + (H - T - B) * (1 - v);
  const path = (k) =>
    tl
      .map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p[k]).toFixed(1)}`)
      .join(" ");
  let s = `<svg viewBox="0 0 ${W} ${H}" class="tl" role="img" aria-label="${t("双方生存率随回合变化的折线图")}">`;
  [0, 0.5, 1].forEach((v) => {
    s += `<line class="g" x1="${L}" x2="${W - Rr}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text x="${L - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${Math.round(v * 100)}%</text>`;
  });
  const step = Math.max(1, Math.ceil(n / 8));
  for (let i = 0; i < n; i += step)
    s += `<text x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="middle">${i}</text>`;
  s += `<text x="${W - Rr}" y="${H - 8}" text-anchor="end" style="opacity:0">${t("回合")}</text><path class="la" d="${path(0)}"/><path class="lb" d="${path(1)}"/></svg>`;
  return s;
}

/* ==========================================================================
   世界
   ========================================================================== */
function currentPreset() {
  return PRESETS.find((p) =>
    DIALS.every((d) => p.d[d.id] === state.world.dials[d.id]),
  );
}
function presetChips(id) {
  const cur = currentPreset();
  $(id).innerHTML = PRESETS.map(
    (p) =>
      `<button class="chip" type="button" data-preset="${p.id}" aria-pressed="${!!cur && cur.id === p.id}" title="${esc(t(p.note))}">${esc(t(p.name))}</button>`,
  ).join("");
}
function buildDials() {
  const groups = [
    [
      "phys",
      t("物理常数"),
      t("重力与时间以 50 为常态，其余以 0 为常态；偏离越远，世界越不正常。"),
    ],
    ["anom", t("异象浓度"), t("驱动魔法、异常、超能力与权能的世界级燃料。")],
  ];
  $("#dials").innerHTML = groups
    .map(
      ([g, h, s]) =>
        `<div class="dial-group"><h4>${h}</h4><p>${s}</p>` +
        DIALS.filter((d) => d.group === g)
          .map((d) => {
            const v = state.world.dials[d.id];
            return `<div class="dial" data-dial-row="${d.id}"><div class="dial-h"><b>${esc(t(d.name))}</b><span class="ro" data-ro="${d.id}"></span></div>${gaugeHTML({ value: v, mode: "dev", base: d.center ? 0.5 : 0, attrs: `data-dial="${d.id}"`, label: d.name })}<div class="dial-f"><span>${esc(t(d.lo))}</span><span>${esc(t(d.hi))}</span></div><p class="hint">${esc(t(d.hint))}</p></div>`;
          })
          .join("") +
        "</div>",
    )
    .join("");
}
function syncDials() {
  DIALS.forEach((d) => {
    const i = $(`[data-dial="${d.id}"]`);
    if (i) {
      i.value = state.world.dials[d.id];
      syncGauge(i.closest(".gauge"));
    }
  });
  $("#worldName").value = state.world.name;
}
function renderWorldAll(animate) {
  const w = state.world,
    d = w.dials,
    m = worldMods(w),
    idx = m.index,
    lab = abnLabel(idx);
  const vals = devVector(w),
    labels = DIALS.map((x) => t(SHORT[x.id]));
  DIALS.forEach((dl) => {
    const ro = $(`[data-ro="${dl.id}"]`);
    if (ro) ro.textContent = dialReadout(dl.id, d[dl.id]);
    const row = $(`[data-dial-row="${dl.id}"]`);
    if (row) row.classList.toggle("off", devOf(dl, d[dl.id]) >= 25);
  });
  const opts = { aria: t("八个法则旋钮偏离常识物理的程度"), size: 300 };
  if (animate) {
    animateRadar($("#heroRadar"), vals, labels, 100, opts);
    animateRadar($("#worldRadar"), vals, labels, 100, opts);
  } else {
    drawRadar($("#heroRadar"), vals, labels, 100, opts);
    drawRadar($("#worldRadar"), vals, labels, 100, opts);
  }
  const idxTxt = Math.round(idx);
  ["#heroIdx", "#worldIdx", "#tbIndex"].forEach((s) => {
    $(s).textContent = idxTxt;
  });
  $("#heroLab").textContent = lab;
  $("#abnLabel").textContent = lab;
  ["#heroWorld", "#tbWorld"].forEach((s) => {
    $(s).textContent = w.name || t("未命名世界");
  });
  const desc = describeWorld(w);
  $("#heroDesc").textContent = desc;
  $("#worldDesc").textContent = desc;

  const cols = {
    magic: "magic",
    anomaly: "anomaly",
    psi: "psi",
    dominion: "dominion",
  };
  $("#mods").className = "mods";
  $("#mods").innerHTML = SYS_IDS.map((k) => {
    const v = m.sys[k];
    return `<div class="mod c-${cols[k]}"><span class="nm">${esc(t(SYSTEMS[k].name))}</span><div class="mini"><i style="width:${clamp((v / 1.9) * 100, 2, 100).toFixed(1)}%"></i><u></u></div><span class="mv">×${v.toFixed(2)}</span></div>`;
  }).join("");
  $("#worldStats").innerHTML = [
    `${t("环境侵蚀")} −${m.ambientStb.toFixed(1)} ${t("稳定度/回合")}`,
    `${t("因果偏转")} ${(m.twist * 100).toFixed(0)}%`,
    `${t("机动修正")} ×${m.mobility.toFixed(2)}`,
    t("反噬率") +
      " " +
      SYS_IDS.map(
        (k) => `${esc(t(SYSTEMS[k].name))} ${(m.backlash(k) * 100).toFixed(0)}%`,
      ).join(" / "),
  ]
    .map((tag) => `<span class="tag">${tag}</span>`)
    .join("");
  const act = PHENOMENA.filter((p) => p.on(d));
  $("#phen").innerHTML = act.length
    ? act.map((p) => `<li><b>${esc(t(p.name))}</b><p>${esc(t(p.desc))}</p></li>`).join("")
    : `<li class="none">${t("目前没有明显的异象，这是一个平静得有点无聊的世界。")}</li>`;
  $("#phenCount").textContent = act.length ? `${t("有")} ${act.length} ${t("项生效")}` : t("无");
  presetChips("#presets");
  presetChips("#heroPresets");
  renderSimHeader();
  if (state.tab === "char") renderWorldNote();
}
function setWorld(w, animate) {
  state.world = w;
  STORE.set("world", w);
  syncDials();
  renderWorldAll(animate);
}
function renderEvents() {
  $("#evlog").innerHTML = state.events
    .map((e) => `<li><b>${e.sev ? t(e.sev) : ""}${t(e.name)}</b>${esc(e.text)}</li>`)
    .join("");
}
function rollEvent() {
  const d = state.world.dials,
    act = PHENOMENA.filter((p) => p.on(d)),
    idx = abnormality(state.world);
  if (!act.length)
    state.events.unshift({
      sev: "",
      name: "平静",
      text: "街道上什么也没有发生。在这样的世界里，这本身就有点不对劲。",
    });
  else {
    const p = act[Math.floor(Math.random() * act.length)];
    const sev =
      SEVERITY[clamp(Math.floor(idx / 25 + Math.random() * 1.6), 0, 3)];
    state.events.unshift({
      sev,
      name: p.name,
      text: p.ev.replace(
        "{place}",
        PLACES[Math.floor(Math.random() * PLACES.length)],
      ),
    });
  }
  state.events = state.events.slice(0, 5);
  renderEvents();
}

/* ==========================================================================
   总览页的静态生成部分
   ========================================================================== */
function renderGuideStatic() {
  $("#sysCards").innerHTML = SYS_IDS.map((k) => {
    const s = SYSTEMS[k];
    return `<article class="sys c-${k}"><h3>${esc(t(s.name))}<small>${esc(t(s.tag))}</small></h3><p>${esc(t(s.summary))}</p><dl class="kv">
      <div><dt>${t("力量来源")}</dt><dd>${esc(t(s.source))}</dd></div><div><dt>${t("代价")}</dt><dd>${esc(t(s.cost))}</dd></div><div><dt>${t("限制")}</dt><dd>${esc(t(s.limit))}</dd></div>
      <div><dt>${t("失控")}</dt><dd>${esc(t(s.backlash))}</dd></div><div><dt>${t("长处")}</dt><dd>${esc(t(s.strong))}</dd></div><div><dt>${t("短板")}</dt><dd>${esc(t(s.weak))}</dd></div>
      <div><dt>${t("依赖旋钮")}</dt><dd>${esc(t(s.dial))}</dd></div><div><dt>${t("主属性")}</dt><dd>${t("{0}，资源名为「{1}」", esc(t(s.powerStat)), esc(t(s.resource)))}</dd></div></dl></article>`;
  }).join("");
  $("#triangle").innerHTML = triangleSVG();
  $("#tierTable").innerHTML =
    `<thead><tr><th>${t("位阶")}</th><th>${t("称谓")}</th><th>${t("大致含义")}</th><th>${t("解锁的能力域")}</th></tr></thead><tbody>` +
    TIERS.slice(1)
      .map((tier, i) => {
        const n = i + 1,
          doms = DOMAINS.filter((d) => d.minTier === n)
            .map((d) => esc(t(d.name)))
            .join(t("、"));
        return `<tr><td class="n">${n}</td><td>${esc(t(tier.n))}</td><td>${esc(t(tier.d))}</td><td>${doms || t("（沿用已解锁的域）")}</td></tr>`;
      })
      .join("") +
    "</tbody>";
}

/* ==========================================================================
   角色
   ========================================================================== */
function buildCharControls() {
  $("#tierGauge").innerHTML = gaugeHTML({
    min: 1,
    max: 9,
    value: state.char.tier,
    attrs: 'data-k="tier"',
    label: t("位阶"),
  });
  $("#sysPick").innerHTML = SYS_IDS.map(
    (k) =>
      `<button type="button" class="c-${k}" data-sys="${k}" aria-pressed="false"><b>${esc(t(SYSTEMS[k].name))}</b><span>${esc(t(SYSTEMS[k].tag))}</span></button>`,
  ).join("");
  $("#selOrigin").innerHTML = ORIGINS.map(
    (o) => `<option value="${o.id}">${esc(t(o.name))}</option>`,
  ).join("");
  $("#selArch").innerHTML = ARCHETYPES.map(
    (a) => `<option value="${a.id}">${esc(t(a.name))}</option>`,
  ).join("");
  $("#attrCtl").innerHTML = ATTRS.map(
    (a) =>
      `<div class="arow"><span class="lab" title="${esc(t(a.d))}">${esc(t(a.n))}</span>${gaugeHTML({ min: 1, max: 20, value: 10, attrs: `data-attr="${a.k}"`, label: a.n })}<span class="val" data-val="${a.k}"></span></div>`,
  ).join("");
  $("#personaCtl").innerHTML = BIG5.map(
    (b) =>
      `<div class="prow"><div class="pn"><span>${esc(t(b.n))}</span><em data-pval="${b.id}"></em></div><div class="arow p"><span class="l">${esc(t(b.lo))}</span>${gaugeHTML({ min: 0, max: 100, value: 50, mode: "dev", tone: "ink", base: 0.5, attrs: `data-persona="${b.id}"`, label: b.n })}<span class="r">${esc(t(b.hi))}</span></div></div>`,
  ).join("");
}
function refreshAttrVals() {
  const ch = state.char,
    d = derive(ch),
    o = ORIGIN_BY_ID[ch.origin];
  ATTR_KEYS.forEach((k) => {
    const mod = o.mods[k] || 0;
    $(`[data-val="${k}"]`).innerHTML =
      `${d.a[k]}${mod ? `<em>${mod > 0 ? "+" : ""}${mod}</em>` : ""}`;
  });
  const b = $("#budgetLab");
  b.innerHTML =
    `${t("已分配")} ${d.used} / ${d.budget}` +
    (d.over
      ? ` <span class="over">${t("超支")} ${d.over}，${t("稳定度上限")} −${d.over * 2}</span>`
      : "");
}
function syncCharControls() {
  const ch = state.char,
    o = ORIGIN_BY_ID[ch.origin];
  $("#chName").value = ch.name;
  const tg = $("#tierGauge input");
  tg.value = ch.tier;
  syncGauge(tg.closest(".gauge"));
  $("#tierLab").textContent = `${ch.tier}${t("　")}${t(TIERS[ch.tier].n)}`;
  $("#tierDesc").textContent = t(TIERS[ch.tier].d);
  $$("#sysPick button").forEach((b) =>
    b.setAttribute(
      "aria-pressed",
      b.dataset.sys === ch.system ? "true" : "false",
    ),
  );
  $("#sysDesc").textContent = t(SYSTEMS[ch.system].summary);
  $("#selOrigin").value = ch.origin;
  $("#originDesc").textContent = `${t(o.trait.n)}${t("：")}${t(o.trait.d)}`;
  $("#selArch").value = ch.archetype;
  ATTR_KEYS.forEach((k) => {
    const i = $(`[data-attr="${k}"]`);
    i.value = ch.attrs[k];
    syncGauge(i.closest(".gauge"));
  });
  BIG5.forEach((b) => {
    const i = $(`[data-persona="${b.id}"]`);
    i.value = ch.persona[b.id];
    syncGauge(i.closest(".gauge"));
    $(`[data-pval="${b.id}"]`).textContent = ch.persona[b.id];
  });
  refreshAttrVals();
  fillAffilSelects();
}
function statHTML(v, l, hot) {
  return `<div class="stat${hot ? " hot" : ""}"><b class="num">${v}</b><span>${l}</span></div>`;
}
function abilityHTML(a) {
  if (a.slot === "passive")
    return `<div class="ab"><div class="ab-h"><b>${esc(a.name)}</b><span>${t("被动")}</span></div><p>${esc(a.desc)}。</p></div>`;
    return `<div class="ab"><div class="ab-h"><b>${esc(a.name)}</b><span>${t(SLOT_NAME[a.slot])}${t("　")}${t("阶")} ${a.rank}</span></div>
    <div class="tags"><span class="tag">${esc(t(a.domain))}${t("域")}</span><span class="tag">${esc(t(a.effect))}</span><span class="tag">${esc(t(a.form))}</span><span class="tag">${esc(t(a.range))}</span></div>
    <p>${esc(a.desc)}。${t("触发方式")}：${esc(t(a.trigger))}。</p>${a.cost ? `<div class="cl"><b>${t("代价")}</b>${esc(t(a.cost))}</div>` : ""}${a.limit ? `<div class="cl"><b>${t("限制")}</b>${esc(t(a.limit))}</div>` : ""}</div>`;
}
function renderWorldNote() {
  const el = $("#worldNote");
  if (!el) return;
  const ch = state.char,
    sys = SYSTEMS[ch.system],
    m = worldMods(state.world),
    v = m.sys[ch.system];
  const cmt =
    v >= 1.3
      ? t("这里几乎是为这种力量准备的土壤。")
      : v < 0.8
        ? t("这里的规则在压制这种力量。")
        : t("环境对这种力量的影响有限。");
  el.innerHTML = t("在「{0}」中，{1}体系效率为 <b>×{2}</b>，环境侵蚀每回合 −{3} 稳定度。{4}", esc(state.world.name), esc(t(sys.name)), v.toFixed(2), m.ambientStb.toFixed(1), cmt);
}
function renderCard() {
  const ch = state.char,
    d = derive(ch),
    sys = SYSTEMS[ch.system],
    o = ORIGIN_BY_ID[ch.origin],
    tier = TIERS[ch.tier],
    p = ch.persona;
  const attrRows = ATTRS.map((a) => {
    const mod = o.mods[a.k] || 0;
    return `<div class="arow"><span class="lab" title="${esc(t(a.d))}">${esc(t(a.n))}</span><div class="mini"><i style="width:${((d.a[a.k] / 24) * 100).toFixed(1)}%"></i></div><span class="val">${d.a[a.k]}${mod ? `<em>${mod > 0 ? "+" : ""}${mod}</em>` : ""}</span></div>`;
  }).join("");
  const pRows = BIG5.map(
    (b) =>
      `<div class="arow p"><span class="l">${esc(t(b.lo))}</span><div class="mini"><i style="width:${p[b.id]}%"></i></div><span class="r">${esc(t(b.hi))}</span></div>`,
  ).join("");
  const price = `<dl class="price"><div><dt>${t("体系反噬")}</dt><dd>${esc(t(sys.backlash))}</dd></div><div><dt>${t("弱点")}</dt><dd>${esc(t(ch.weakness))}</dd></div>${ch.precept ? `<div><dt>${t("戒律")}</dt><dd>${esc(t(ch.precept))}${t("（违背即失效）")}</dd></div>` : ""}<div><dt>${t("出身弱点")}</dt><dd>${esc(t(o.weak))}</dd></div></dl>`;
  $("#charCard").innerHTML =
    `<div class="panel c-${ch.system}"><div class="panel-h"><h3>${t("角色卡")}</h3><small>${t("种子")} ${esc(ch.seed)}</small></div><div class="body">
    <div class="card-head">${sigilSVG(ch)}<div class="who"><h2>${esc(ch.name)}</h2><p class="ttl">${titleOf(ch)}</p>
      <div class="tags"><span class="tag hue">${esc(t(sys.name))}</span><span class="tag">${t("位阶")} ${ch.tier} ${esc(t(tier.n))}</span><span class="tag">${esc(t(o.name))}</span><span class="tag">${esc(t(ARCH_BY_ID[ch.archetype].name))}</span><span class="tag">${alignOf(p)}</span></div></div></div>
    <div class="stats">${vstat(ch, "hp", d.hp, t("生命"))}${vstat(ch, "en", d.en, t(sys.resource))}${vstat(ch, "stb", d.stb, t("稳定度"))}${statHTML(d.init, t("先攻"))}${statHTML(d.def, t("防御"))}${statHTML(d.score, t("综合战力"), true)}</div>
    <div class="worldnote c-${ch.system}" id="worldNote"></div>
    <div class="cblock"><h4>${t("属性")}<small>${t("分配值 + 出身修正")}</small></h4><div class="attr-split"><div class="radar-wrap">${radarSVG(
      ATTR_KEYS.map((k) => d.a[k]),
      ATTRS.map((a) => t(a.n)),
      24,
      { ink: true, size: 230, pad: 34, aria: t("六维属性雷达图") },
    )}</div><div class="attr-list">${attrRows}</div></div></div>
    <div class="cblock"><h4>${t("构造与出身")}<small>${esc(t(o.name))}</small></h4><dl class="kv"><div><dt>${t("身体构造")}</dt><dd>${esc(t(o.body))}</dd></div><div><dt>${t("先天特质")}</dt><dd><b>${esc(t(o.trait.n))}</b>${t("：")}${esc(t(o.trait.d))}</dd></div><div><dt>${t("异化度")}</dt><dd>${d.corruption}%${d.corruption >= 40 ? t("，已相当严重") : d.corruption >= 20 ? t("，有可见的改变") : t("，基本无碍")}</dd></div><div><dt>${t("势力与驻地")}</dt><dd>${affilText(ch, d)}</dd></div><div><dt>${t("关系")}</dt><dd>${relText(ch)}</dd></div></dl></div>
    <div class="cblock">${growthHTML(ch, d)}</div>
    <div class="cblock"><h4>${t("能力")}<small>${t("域 × 效果 × 形态")}</small></h4>${ch.abilities.map(abilityHTML).join("")}<h4 style="margin-top:18px">${t("代价与弱点")}<small>${t("违常必有价")}</small></h4>${price}</div>
    <div class="cblock"><h4>${t("性格")}<small>${alignOf(p)}</small></h4><p>${personaText(ch)}。</p>${pRows}<dl class="kv" style="margin-top:10px"><div><dt>${t("核心动机")}</dt><dd>${esc(t(ch.motivation))}</dd></div><div><dt>${t("缺陷")}</dt><dd>${esc(t(ch.flaw))}</dd></div><div><dt>${t("说话方式")}</dt><dd>${esc(t(ch.speech))}</dd></div><div><dt>${t("习惯")}</dt><dd>${esc(t(ch.quirk))}</dd></div></dl></div>
    <div class="cblock"><h4>${t("外观")}<small>${t("能力会在身体上留下痕迹")}</small></h4><p>${lookSummary(ch, d)}</p><dl class="kv"><div><dt>${t("异象特征")}</dt><dd>${manifestOf(ch)}</dd></div><div><dt>${t("出身特征")}</dt><dd>${originLookOf(ch)}</dd></div></dl></div>
    <div class="cblock"><h4>${t("背景")}</h4><p>${esc(bgText(ch, d.fac))}</p></div>
  </div></div>`;
  renderWorldNote();
}
function saveChar() {
  STORE.set("char", state.char);
}
function saveRoster() {
  STORE.set("roster", state.roster);
}
function refreshChar(full) {
  if (full) syncCharControls();
  else refreshAttrVals();
  renderCard();
  saveChar();
}

function renderRoster() {
  const el = $("#roster");
  if (!state.roster.length) {
    el.innerHTML = `<div class="empty">${t("名册还是空的。创建一个喜欢的角色后点「存入名册」，或到「势力关系」页一键生成群像。")}</div>`;
    return;
  }
  el.innerHTML = state.roster
    .map((c) => {
      const s = SYSTEMS[c.system],
        d = derive(c),
        f = state.factions.find((x) => x.id === c.factionId),
        l = state.locs.find((x) => x.id === c.locId);
      return `<div class="rcard c-${c.system}">${sigilSVG(c)}<div><b>${esc(c.name)}</b><p class="small">${esc(t(s.name))}，${t("位阶")} ${c.tier} ${esc(t(TIERS[c.tier].n))}，${t("战力")} ${d.score}<br>${esc(t(ORIGIN_BY_ID[c.origin].name))}${f ? "，" + esc(t(f.name)) : ""}${l ? "，" + t("驻于") + esc(t(l.name)) : ""}</p></div><div class="acts"><button class="btn" type="button" data-load="${c.uid}">${t("载入")}</button><button class="btn" type="button" data-fight="${c.uid}">${t("作为对手")}</button><button class="btn" type="button" data-sqadd="a:${c.uid}">${t("入甲队")}</button><button class="btn" type="button" data-sqadd="b:${c.uid}">${t("入乙队")}</button><button class="btn" type="button" data-del="${c.uid}">${t("删除")}</button></div></div>`;
    })
    .join("");
}

/* ==========================================================================
   推演
   ========================================================================== */
function ensureOpp() {
  if (!state.sim.opp)
    state.sim.opp = newCharacter({
      tier: clamp(state.char.tier + Math.floor(Math.random() * 3) - 1, 1, 9),
    });
  return state.sim.opp;
}
function resolveFighter(id) {
  if (id === "__random") return ensureOpp();
  if (id === "__current") return state.char;
  return state.roster.find((r) => r.uid === id) || state.char;
}
function renderSimSelects() {
  const opts = (withRandom) =>
    (withRandom
      ? [
          `<option value="__random">${t("随机对手")}${t("：")}${esc(ensureOpp().name)}${t("（")}${esc(t(SYSTEMS[ensureOpp().system].name))}${t("，")}${t("位阶")} ${ensureOpp().tier}${t("）")}</option>`,
        ]
      : []
    )
      .concat([
        `<option value="__current">${t("当前工坊角色")}${t("：")}${esc(state.char.name)}</option>`,
      ])
      .concat(
        state.roster.map(
          (r) =>
            `<option value="${r.uid}">${esc(r.name)}${t("（")}${esc(t(SYSTEMS[r.system].name))}${t("，")}${t("位阶")} ${r.tier}${t("）")}</option>`,
        ),
      )
      .join("");
  const valid = (id) =>
    id === "__random" ||
    id === "__current" ||
    state.roster.some((r) => r.uid === id);
  if (!valid(state.sim.a)) state.sim.a = "__current";
  if (!valid(state.sim.b)) state.sim.b = "__random";
  $("#simA").innerHTML = opts(true);
  $("#simB").innerHTML = opts(true);
  $("#simA").value = state.sim.a;
  $("#simB").value = state.sim.b;
}
function meterHTML(label, cur, max, red) {
  const pct = clamp((cur / max) * 100, 0, 100);
  return `<div class="meter"><div><span>${label}</span><span>${Math.round(cur)} / ${Math.round(max)}</span></div><div class="mini"><i${red ? ' class="red"' : ""} style="width:${pct.toFixed(1)}%"></i></div></div>`;
}
function simWorld() {
  const loc = state.locs.find((l) => l.id === state.sim.loc);
  if (!loc) return state.world;
  return {
    name: `${loc.name}${t("（")}${state.world.name}${t("）")}`,
    dials: localWorld(state.world, loc).dials,
  };
}
function renderSimHeader() {
  const el = $("#simWorld");
  if (!el) return;
  const w = simWorld();
  el.textContent = `${w.name}${t("，")}${t("违常指数")} ${Math.round(abnormality(w))}`;
}
function renderSimLoc() {
  if (!state.locs.some((l) => l.id === state.sim.loc)) state.sim.loc = "";
  $("#simLoc").innerHTML =
    `<option value="">${t("全局世界")}${t("：")}${esc(state.world.name)}</option>` +
    state.locs
      .map(
        (l) =>
          `<option value="${l.id}">${esc(l.name)}${t("（")}${esc(t(LOC_BY_ID[l.type].name))}${t("，")}${t("违常")} ${Math.round(abnormality(localWorld(state.world, l)))}${t("）")}</option>`,
      )
      .join("");
  $("#simLoc").value = state.sim.loc;
  const m = worldMods(simWorld());
  $("#simLocNote").textContent =
    t("此处体系效率") +
    t("：") +
    SYS_IDS.map((k) => `${esc(t(SYSTEMS[k].name))} ×${m.sys[k].toFixed(2)}`).join(
      t("，"),
    ) +
    `${t("；")}${t("环境侵蚀每回合")} −${m.ambientStb.toFixed(1)} ${t("稳定度")}${t("。")}`;
}
function revealSim() {
  const el = $("#simOut .banner");
  if (el && el.scrollIntoView)
    el.scrollIntoView({
      behavior: reduceMotion() ? "auto" : "smooth",
      block: "start",
    });
}
function runSim() {
  const A = clone(resolveFighter(state.sim.a)),
    B = clone(resolveFighter(state.sim.b)),
    world = clone(simWorld()),
    rel = makeRel(state.crel);
  const res = duel(A, B, world, {
    log: true,
    rel,
    rng: mulberry32((Math.random() * 4294967296) >>> 0),
  });
  const wr = winRate(A, B, world, 300, rel);
  state.sim.res = { kind: "duel", A, B, world, res, wr };
  renderSimOut();
  revealSim();
}
function renderSimOut() {
  const S0 = state.sim.res,
    out = $("#simOut");
  const S = S0 && (S0.kind || "duel") === state.sim.mode ? S0 : null;
  if (!S) {
    out.innerHTML = `<div class="empty" style="margin-top:16px">${state.sim.mode === "squad" ? t("组好两支小队后点「开始推演」。") : t("选好双方后点「开始推演」。")}</div>`;
    return;
  }
  if (S.kind === "squad") {
    renderSquadOut(S);
    return;
  }
  const { A, B, world, res, wr } = S,
    m = worldMods(world),
    F = [A, B];
  const win = res.winner === "A" ? A : res.winner === "B" ? B : null;
  const why =
    res.winner === "draw"
      ? t("双方势均力敌，未分胜负。")
      : res.reason === "stb"
        ? t("败者的稳定度耗尽，被现实抹去。")
        : res.reason === "hp"
          ? t("败者的生命耗尽。")
          : t("回合耗尽，按剩余状态判定。");
  const pct = (x) => Math.round(x * 100);
  const duelist = (ch, i) => {
    const e = res.end[i],
      s = SYSTEMS[ch.system],
      d = derive(ch);
    return `<div class="panel duelist ${i ? "sb" : "sa"} c-${ch.system}"><h4><span class="side">${i ? t("乙方") : t("甲方")}</span>${esc(ch.name)}</h4><div class="tags"><span class="tag hue">${esc(t(s.name))}</span><span class="tag">${t("位阶")} ${ch.tier} ${esc(t(TIERS[ch.tier].n))}</span><span class="tag">${esc(t(ORIGIN_BY_ID[ch.origin].name))}</span></div>
      ${meterHTML(t("生命"), e.hp, e.hpMax)}${meterHTML(t(s.resource), e.en, e.enMax)}${meterHTML(t("稳定度"), e.stb, e.stbMax, e.stb / e.stbMax < 0.3)}
      <p class="small" style="margin-top:8px">${t("本世界中的体系效率")} ×${m.sys[ch.system].toFixed(2)}，${t("先攻")} ${d.init}，${t("综合战力")} ${d.score}。</p></div>`;
  };
  out.innerHTML = `<div class="simgrid">
    <div class="banner ${win ? "c-" + win.system : ""}"><h3>${win ? esc(win.name) + " " + t("获胜") : t("平局")}</h3><p>${t("战场")}：${esc(world.name)}。${t("共")} ${res.rounds} ${t("回合")}。${why}</p></div>
    <div class="duelists">${duelist(A, 0)}${duelist(B, 1)}</div>
    <div class="panel"><div class="panel-h"><h3>${t("胜率估算")}</h3><small>${t("同一世界、同样的双方，另外模拟 300 场")}</small></div><div class="body">
      <div class="wr" role="img" aria-label="${t("甲方胜率")} ${pct(wr.a)}%，${t("平局")} ${pct(wr.d)}%，${t("乙方胜率")} ${pct(wr.b)}%"><div class="wa" style="flex:${Math.max(wr.a, 0.001)}">${pct(wr.a) >= 8 ? pct(wr.a) + "%" : ""}</div><div class="wd" style="flex:${Math.max(wr.d, 0.001)}">${pct(wr.d) >= 8 ? pct(wr.d) + "%" : ""}</div><div class="wb" style="flex:${Math.max(wr.b, 0.001)}">${pct(wr.b) >= 8 ? pct(wr.b) + "%" : ""}</div></div>
      <div class="wr-legend"><span>${t("甲方")} ${esc(A.name)} ${pct(wr.a)}%</span><span>${t("平局")} ${pct(wr.d)}%</span><span>${t("乙方")} ${esc(B.name)} ${pct(wr.b)}%</span></div>
      <p class="small" style="margin-top:8px">${t("平均")} ${wr.rounds.toFixed(1)} ${t("回合分出胜负")}。${Math.abs(wr.a - wr.b) < 0.12 ? t("这是一场势均力敌的对局。") : wr.a > wr.b ? t("甲方明显占优。") : t("乙方明显占优。")}</p></div></div>
    <div class="panel"><div class="panel-h"><h3>${t("生存率曲线")}</h3><small>${t("取生命与稳定度中较低者，越接近 0 越接近倒下")}</small></div><div class="body">${timelineSVG(res.tl)}<div class="legend"><span><i></i>${t("甲方")} ${esc(A.name)}</span><span><i class="b"></i>${t("乙方")} ${esc(B.name)}</span></div></div></div>
    <div class="panel"><div class="panel-h"><h3>${t("战报")}</h3><small>${t("蓝线为甲方行动，红线为乙方行动")}</small></div><div class="body"><ol class="log">${res.log.map((l) => `<li class="${l.t}${l.i === 0 ? " ia" : l.i === 1 ? " ib" : ""}">${l.t === "r" ? l.x : esc(l.x)}</li>`).join("")}</ol></div></div>
  </div>`;
}
function renderSim() {
  const sq = state.sim.mode === "squad";
  $$("#simMode .chip").forEach((b) =>
    b.setAttribute(
      "aria-pressed",
      b.dataset.mode === state.sim.mode ? "true" : "false",
    ),
  );
  $("#duelPick").hidden = sq;
  $("#squadPick").hidden = !sq;
  $("#btnOpp").hidden = sq;
  $("#simHint").textContent = sq
    ? t("小队最多 5 人，队员是加入时的快照。队友之间的关系会带来默契或拖累，宿敌之间会互相多打几分；关系可以在「势力关系」页编辑。")
    : t("每次推演都会用新的随机数打一场完整的对局，并另外模拟数百场来估算胜率。");
  renderSimHeader();
  renderSimLoc();
  if (sq) renderSquads();
  else renderSimSelects();
  renderSimOut();
}

/* ==========================================================================
   导航与事件
   ========================================================================== */
function setTab(t) {
  state.tab = t;
  $$('.tabpanel[id^="tab-"]').forEach((p) => {
    p.hidden = p.id !== "tab-" + t;
  });
  $$(".tabs button").forEach((b) =>
    b.setAttribute("aria-selected", b.dataset.tab === t ? "true" : "false"),
  );
  if (t === "char") {
    fillAffilSelects();
    renderCard();
    renderRoster();
  }
  if (t === "sim") renderSim();
  if (t === "map") renderMap();
  if (t === "fac") renderFacAll();
  if (t === "camp") renderCamp();
  if (t === "world") renderWorldAll(false);
  try {
    window.scrollTo({ top: 0 });
  } catch (e) {
    /* noop */
  }
}
function saveToRoster() {
  const ch = state.char;
  if (!ch.uid) ch.uid = ch.seed + "-" + Date.now().toString(36);
  const i = state.roster.findIndex((r) => r.uid === ch.uid);
  if (i >= 0) {
    state.roster[i] = clone(ch);
    toast(t("已更新名册中的这个角色"));
  } else {
    if (state.roster.length >= 30) {
      toast(t("名册已满（30 个），请先删除一些"));
      return;
    }
    state.roster.push(clone(ch));
    toast(t("已存入名册"));
  }
  saveRoster();
  saveChar();
  renderRoster();
}
function bind() {
  $$(".tabs button").forEach((b) =>
    b.addEventListener("click", () => setTab(b.dataset.tab)),
  );
  $("#tblock").addEventListener("click", () => setTab("world"));
  document.addEventListener("click", (e) => {
    const g = e.target.closest("[data-go]");
    if (g) setTab(g.dataset.go);
  });
  document.addEventListener("click", (e) => {
    const p = e.target.closest("[data-preset]");
    if (p)
      setWorld(
        presetToWorld(PRESETS.find((x) => x.id === p.dataset.preset)),
        true,
      );
  });

  $("#dials").addEventListener("input", (e) => {
    const i = e.target;
    if (!i.dataset.dial) return;
    syncGauge(i.closest(".gauge"));
    state.world.dials[i.dataset.dial] = +i.value;
    STORE.set("world", state.world);
    renderWorldAll(false);
  });
  $("#worldName").addEventListener("input", (e) => {
    state.world.name = e.target.value.slice(0, 16);
    STORE.set("world", state.world);
    ["#heroWorld", "#tbWorld"].forEach((s) => {
      $(s).textContent = state.world.name || t("未命名世界");
    });
  });
  $("#btnWorldName").addEventListener("click", () => {
    state.world.name = randomWorldName();
    STORE.set("world", state.world);
    $("#worldName").value = state.world.name;
    renderWorldAll(false);
  });
  $("#btnRandWorld").addEventListener("click", () =>
    setWorld(randomWorld(), true),
  );
  $("#btnEvent").addEventListener("click", rollEvent);

  const tc = $("#tab-char");
  tc.addEventListener("input", (e) => {
    const i = e.target,
      ch = state.char;
    if (i.dataset.k === "tier") {
      syncGauge(i.closest(".gauge"));
      $("#tierLab").textContent = `${i.value}${t("　")}${t(TIERS[+i.value].n)}`;
      $("#tierDesc").textContent = t(TIERS[+i.value].d);
      return;
    }
    if (i.dataset.attr) {
      syncGauge(i.closest(".gauge"));
      ch.attrs[i.dataset.attr] = +i.value;
      refreshChar(false);
      return;
    }
    if (i.dataset.persona) {
      syncGauge(i.closest(".gauge"));
      ch.persona[i.dataset.persona] = +i.value;
      $(`[data-pval="${i.dataset.persona}"]`).textContent = i.value;
      refreshChar(false);
      return;
    }
    if (i.id === "chName") {
      ch.name = i.value.slice(0, 12);
      renderCard();
      saveChar();
    }
  });
  tc.addEventListener("change", (e) => {
    const i = e.target,
      ch = state.char;
    if (i.dataset.k === "tier") {
      ch.tier = +i.value;
      regen(ch, "attrs");
      regen(ch, "abil");
      refreshChar(true);
    } else if (i.id === "selOrigin") {
      ch.origin = i.value;
      refreshChar(true);
    } else if (i.id === "selArch") {
      ch.archetype = i.value;
      regen(ch, "attrs");
      refreshChar(true);
    } else if (i.id === "selFac") {
      ch.factionId = i.value;
      if (i.value && !ch.rank) ch.rank = "成员";
      refreshChar(true);
    } else if (i.id === "selRank") {
      ch.rank = i.value;
      refreshChar(true);
    } else if (i.id === "selLoc") {
      ch.locId = i.value;
      refreshChar(true);
    }
  });
  tc.addEventListener("click", (e) => {
    const ch = state.char;
    const sb = e.target.closest("[data-sys]");
    if (sb) {
      ch.system = sb.dataset.sys;
      regen(ch, "abil");
      refreshChar(true);
      return;
    }
    const rr = e.target.closest("[data-reroll]");
    if (rr) {
      reroll(ch, rr.dataset.reroll);
      refreshChar(true);
      return;
    }
    const ld = e.target.closest("[data-load]");
    if (ld) {
      const r = state.roster.find((x) => x.uid === ld.dataset.load);
      if (r) {
        state.char = clone(r);
        refreshChar(true);
        toast(t("已载入：") + r.name);
        window.scrollTo({ top: 0 });
      }
      return;
    }
    const ft = e.target.closest("[data-fight]");
    if (ft) {
      state.sim.b = ft.dataset.fight;
      state.sim.res = null;
      setTab("sim");
      return;
    }
    const dl = e.target.closest("[data-del]");
    if (dl) {
      state.roster = state.roster.filter((x) => x.uid !== dl.dataset.del);
      state.crel = state.crel.filter(
        (e) => e.a !== dl.dataset.del && e.b !== dl.dataset.del,
      );
      state.camp.party.ids = state.camp.party.ids.filter(
        (id) => id !== dl.dataset.del,
      );
      saveUniverse();
      saveRoster();
      STORE.set("camp", state.camp);
      renderRoster();
      toast(t("已删除"));
    }
  });
  $("#btnNewChar").addEventListener("click", () => {
    state.char = newCharacter({ tier: state.char.tier });
    refreshChar(true);
  });
  $("#btnSave").addEventListener("click", saveToRoster);
  $("#btnExport").addEventListener("click", () => {
    $("#ioBox").value = JSON.stringify(state.roster);
    toast(t("已生成导出内容，请复制保存"));
  });
  $("#btnImport").addEventListener("click", () => {
    try {
      const arr = JSON.parse($("#ioBox").value),
        list = (Array.isArray(arr) ? arr : [arr]).filter(validChar);
      if (!list.length) {
        toast(t("没有识别到可导入的角色"));
        return;
      }
      list.forEach((c) => {
        c.uid =
          c.uid && !state.roster.some((r) => r.uid === c.uid)
            ? c.uid
            : c.seed + "-" + Math.random().toString(36).slice(2, 6);
        state.roster.push(c);
      });
      state.roster = state.roster.slice(0, 30);
      saveRoster();
      renderRoster();
      toast(t("已导入 {0} 个角色", list.length));
    } catch (err) {
      toast(t("内容无法解析，请确认粘贴完整"));
    }
  });

  $("#simA").addEventListener("change", (e) => {
    state.sim.a = e.target.value;
  });
  $("#simB").addEventListener("change", (e) => {
    state.sim.b = e.target.value;
  });
  $("#btnRun").addEventListener("click", () =>
    state.sim.mode === "squad" ? runSquad() : runSim(),
  );
  $("#btnOpp").addEventListener("click", () => {
    state.sim.opp = null;
    ensureOpp();
    state.sim.b = "__random";
    renderSimSelects();
    toast(t("已换了一个随机对手"));
  });
  bindUniverse();
  bindCamp();
}

function init() {
  const w = STORE.get("world");
  state.world = validWorld(w) ? w : presetToWorld(PRESETS[1]);
  const c = STORE.get("char");
  state.char = validChar(c) ? c : newCharacter({ tier: 3 });
  const r = STORE.get("roster");
  state.roster = Array.isArray(r) ? r.filter(validChar) : [];
  initUniverse();
  initCamp();
  buildDials();
  buildCharControls();
  renderGuideStatic();
  syncCharControls();
  syncDials();
  bind();
  renderWorldAll(false);
  renderCard();
  renderRoster();
  renderEvents();
  saveChar();
}
