"use strict";
/* ==========================================================================
   万象工坊 · 逻辑层（数据表 + 生成器 + 世界模型 + 推演引擎）
   这一层不依赖 DOM，可以在 Node 中单独测试。
   ========================================================================== */

/* 运行时注册表：由界面层写入，逻辑层只读 */
const REG = { factions: [] };

/* ---------- 工具 ---------- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sum = (a) => a.reduce((s, x) => s + x, 0);
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makeRng(str) {
  const r = mulberry32(hashStr(String(str)));
  return {
    next: r,
    int: (a, b) => a + Math.floor(r() * (b - a + 1)),
    range: (a, b) => a + r() * (b - a),
    pick: (arr) => arr[Math.floor(r() * arr.length)],
    chance: (p) => r() < p,
    weighted(items, wf) {
      const ws = items.map(wf);
      let x = r() * sum(ws);
      for (let i = 0; i < items.length; i++) {
        x -= ws[i];
        if (x <= 0) return items[i];
      }
      return items[items.length - 1];
    },
  };
}
const newSeed = () =>
  Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "X");

/* ==========================================================================
   一、世界层：八个法则旋钮
   ========================================================================== */
const DIALS = [
  {
    id: "gravity",
    name: "重力场",
    group: "phys",
    center: true,
    lo: "失重",
    hi: "重压",
    hint: "移动方式、建筑与生态的基本形态",
  },
  {
    id: "time",
    name: "时间流速",
    group: "phys",
    center: true,
    lo: "凝滞",
    hi: "飞逝",
    hint: "相对标准时间的流逝速度",
  },
  {
    id: "space",
    name: "空间褶皱",
    group: "phys",
    lo: "平直",
    hi: "扭曲",
    hint: "距离与方向的可靠程度",
  },
  {
    id: "entropy",
    name: "熵律松弛",
    group: "phys",
    lo: "严格守恒",
    hi: "凭空生灭",
    hint: "能量守恒与热力学定律的约束力",
  },
  {
    id: "aether",
    name: "灵能浓度",
    group: "anom",
    lo: "枯竭",
    hi: "泛滥",
    hint: "魔法的燃料，也是失控的源头",
  },
  {
    id: "anomaly",
    name: "异常浓度",
    group: "anom",
    lo: "稳固",
    hi: "渗漏",
    hint: "现实裂隙与异常实体的密度",
  },
  {
    id: "causality",
    name: "因果松弛",
    group: "anom",
    lo: "铁律",
    hi: "可改写",
    hint: "因果与命运的刚性，权能与时间类能力的土壤",
  },
  {
    id: "mind",
    name: "心念显化",
    group: "anom",
    lo: "无感",
    hi: "万念成真",
    hint: "意志与信念影响现实的程度，超能力的土壤",
  },
];
const DIAL_BY_ID = Object.fromEntries(DIALS.map((d) => [d.id, d]));

const gMul = (v) => Math.pow(10, ((v - 50) / 50) * 0.7);
const tMul = (v) => Math.pow(10, (v - 50) / 50);
function bucket(v) {
  return v <= 10
    ? "几乎没有"
    : v <= 30
      ? "微弱"
      : v <= 55
        ? "显著"
        : v <= 80
          ? "浓烈"
          : "泛滥";
}
function dialReadout(id, v) {
  if (id === "gravity") return gMul(v).toFixed(2) + " g";
  if (id === "time") return "×" + tMul(v).toFixed(2);
  return bucket(v);
}
const devOf = (dial, v) => (dial.center ? Math.abs(v - 50) * 2 : v);
function devVector(w) {
  return DIALS.map((d) => devOf(d, w.dials[d.id]));
}
function abnormality(w) {
  const v = devVector(w);
  return Math.sqrt(sum(v.map((x) => x * x)) / v.length);
}
function abnLabel(x) {
  return x < 12
    ? "常识世界"
    : x < 30
      ? "轻微异常"
      : x < 50
        ? "显著异常"
        : x < 70
          ? "高危异常"
          : "法则崩坏边缘";
}

const PRESETS = [
  {
    id: "base",
    name: "常识世界",
    note: "几乎与现实无异，异常只藏在缝隙里",
    d: {
      gravity: 50,
      time: 50,
      space: 4,
      entropy: 3,
      aether: 5,
      anomaly: 6,
      causality: 5,
      mind: 10,
    },
  },
  {
    id: "tide",
    name: "灵潮都市",
    note: "魔法复苏的现代都市",
    d: {
      gravity: 50,
      time: 52,
      space: 20,
      entropy: 30,
      aether: 82,
      anomaly: 35,
      causality: 25,
      mind: 45,
    },
  },
  {
    id: "rift",
    name: "裂隙荒原",
    note: "收容失效，异常泛滥",
    d: {
      gravity: 45,
      time: 65,
      space: 78,
      entropy: 50,
      aether: 30,
      anomaly: 92,
      causality: 55,
      mind: 30,
    },
  },
  {
    id: "isles",
    name: "浮空群岛",
    note: "低重力与灵风之海",
    d: {
      gravity: 14,
      time: 50,
      space: 40,
      entropy: 20,
      aether: 58,
      anomaly: 18,
      causality: 20,
      mind: 35,
    },
  },
  {
    id: "loop",
    name: "循环之城",
    note: "时间环与命运锚点",
    d: {
      gravity: 50,
      time: 30,
      space: 45,
      entropy: 35,
      aether: 30,
      anomaly: 55,
      causality: 92,
      mind: 50,
    },
  },
  {
    id: "abyss",
    name: "心相深渊",
    note: "意识塑造现实",
    d: {
      gravity: 50,
      time: 44,
      space: 58,
      entropy: 40,
      aether: 42,
      anomaly: 46,
      causality: 52,
      mind: 96,
    },
  },
  {
    id: "chaos",
    name: "混沌熔炉",
    note: "一切都在失控边缘",
    d: {
      gravity: 78,
      time: 82,
      space: 85,
      entropy: 80,
      aether: 85,
      anomaly: 88,
      causality: 80,
      mind: 80,
    },
  },
];
const presetToWorld = (p) => ({ name: p.name, dials: { ...p.d } });
const WORLD_PRE = [
  "灰烬",
  "星陨",
  "无光",
  "逆潮",
  "白昼",
  "裂镜",
  "浮光",
  "空白",
  "长夜",
  "回响",
  "残页",
  "折光",
];
const WORLD_SUF = [
  "之境",
  "界域",
  "纪元",
  "城邦",
  "群岛",
  "荒原",
  "回廊",
  "边境",
  "永昼",
  "深渊",
  "疆域",
  "夹层",
];
const randomWorldName = () =>
  WORLD_PRE[Math.floor(Math.random() * WORLD_PRE.length)] +
  WORLD_SUF[Math.floor(Math.random() * WORLD_SUF.length)];
function randomWorld() {
  const d = {};
  DIALS.forEach((x) => {
    d[x.id] = x.center
      ? Math.round(clamp(50 + (Math.random() - 0.5) * 120, 3, 97))
      : Math.round(Math.pow(Math.random(), 0.8) * 100);
  });
  return { name: randomWorldName(), dials: d };
}

function worldMods(w) {
  const d = w.dials;
  const g = gMul(d.gravity),
    t = tMul(d.time);
  const sys = {
    magic: 0.5 + (1.2 * d.aether) / 100 + (0.2 * d.entropy) / 100,
    anomaly: 0.5 + (1.2 * d.anomaly) / 100 + (0.2 * d.space) / 100,
    psi: 0.7 + (0.8 * d.mind) / 100 + (0.2 * d.causality) / 100,
    dominion: 0.8 + (0.5 * d.causality) / 100 + (0.2 * d.mind) / 100,
  };
  const mobility = 1 - 0.25 * Math.min(1, Math.abs(Math.log10(g)) / 0.7);
  const twist = (0.15 * d.causality) / 100;
  const ambientStb =
    (d.anomaly / 100) * 2.5 + (d.space / 100) * 1.5 + (d.causality / 100) * 1.0;
  const backlash = (s, enRatio = 1) => {
    if (s === "magic") return 0.02 + (Math.abs(d.aether - 55) / 100) * 0.25;
    if (s === "anomaly")
      return 0.04 + (d.anomaly / 100) * 0.1 + (d.space / 100) * 0.05;
    if (s === "psi")
      return 0.02 + (enRatio < 0.25 ? 0.12 : 0) + ((100 - d.mind) / 100) * 0.03;
    return 0.05 + ((100 - d.causality) / 100) * 0.05;
  };
  return {
    sys,
    g,
    t,
    mobility,
    twist,
    ambientStb,
    backlash,
    index: abnormality(w),
  };
}

const PLACES = [
  "旧港区",
  "地铁末班车厢",
  "钟楼广场",
  "学院图书馆",
  "废弃水塔",
  "午夜的天台",
  "地下市场",
  "边境检查站",
  "钟表铺",
  "雨中的十字路口",
  "收容站大厅",
  "海边的灯塔",
];
const PHENOMENA = [
  {
    id: "tide",
    name: "灵潮涨落",
    on: (d) => d.aether >= 60,
    desc: "灵能随月相涨落。涨潮时咒式威力倍增，也更容易失控。",
    ev: "{place}的灵能骤然涨潮，电器被灵光淹没，路人看见空气里游动的符文。",
  },
  {
    id: "crystal",
    name: "灵晶结出",
    on: (d) => d.aether >= 85,
    desc: "过浓的灵能在角落凝成可采集的灵晶，靠近时能听见低语。",
    ev: "{place}的墙缝里长出一簇半透明的灵晶，靠近的人都听见了低语。",
  },
  {
    id: "desert",
    name: "灵能荒漠",
    on: (d) => d.aether <= 10,
    desc: "灵能几近枯竭，魔法只剩仪式的残骸。",
    ev: "{place}的魔法装置同时熄灭，符文褪成了普通的墨痕。",
  },
  {
    id: "rift",
    name: "现实裂隙",
    on: (d) => d.anomaly >= 40,
    desc: "街角、镜面与废楼里会出现临时裂缝，通向未知之处。",
    ev: "{place}的空气裂开一道细缝，缝里传出并不属于这个世界的风声。",
  },
  {
    id: "breach",
    name: "收容失效",
    on: (d) => d.anomaly >= 75,
    desc: "已知异常开始互相渗透，「安全区」成了会过期的概念。",
    ev: "{place}的收容设施报警：三个互不相干的异常正在合并成一个新的东西。",
  },
  {
    id: "echo",
    name: "因果回声",
    on: (d) => d.causality >= 50,
    desc: "事件会以相似的形态再次发生，预感往往应验。",
    ev: "{place}发生的事与三天前一模一样，只是这一次所有人都记得。",
  },
  {
    id: "anchor",
    name: "命运锚点",
    on: (d) => d.causality >= 80,
    desc: "某些事件无论如何都会发生，想改变它必须付出代价。",
    ev: "{place}的一场相遇被反复阻止，却总以另一种方式发生。",
  },
  {
    id: "still",
    name: "时间凝滞",
    on: (d) => d.time <= 30,
    desc: "昼夜漫长，某些区域的时钟几乎不走。",
    ev: "{place}的钟摆停在半空，路过的鸽子悬在一步之外。",
  },
  {
    id: "rush",
    name: "时间奔流",
    on: (d) => d.time >= 70,
    desc: "季节以周为单位更替，人们必须学会快速决断。",
    ev: "{place}的花在一分钟内开谢，墙上的时钟转出了残影。",
  },
  {
    id: "float",
    name: "万物失重",
    on: (d) => d.gravity <= 28,
    desc: "物体与人轻易离地，城市朝天空生长。",
    ev: "{place}的重力骤降，没有固定的一切缓缓升向天空。",
  },
  {
    id: "press",
    name: "重压之世",
    on: (d) => d.gravity >= 72,
    desc: "一切沉重而缓慢，生物演化出强健的骨骼。",
    ev: "{place}的重力突然加倍，钢梁发出低沉的呻吟。",
  },
  {
    id: "fold",
    name: "非欧街区",
    on: (d) => d.space >= 50,
    desc: "走廊的长度取决于谁在走，门后可能通向别处。",
    ev: "{place}的走廊无论怎么走都比来时长一些，地图上却查不出变化。",
  },
  {
    id: "break",
    name: "距离崩坏",
    on: (d) => d.space >= 80,
    desc: "方位失去意义，远近只在观察者的信念里成立。",
    ev: "{place}与三公里外的另一处重叠了一分钟，有人从这一端走到了那一端。",
  },
  {
    id: "surge",
    name: "能量涌现",
    on: (d) => d.entropy >= 50,
    desc: "热力学定律在局部失效：永动装置偶然诞生，热量可能自发流向冷处。",
    ev: "{place}的一盏灯没有接任何电源，却亮了整整一夜。",
  },
  {
    id: "thought",
    name: "心象具现",
    on: (d) => d.mind >= 50,
    desc: "强烈的情绪会在现实里留下痕迹，谎言与信念一样有重量。",
    ev: "{place}的墙上浮现出一幅没人画过的画，与某位路人昨夜的梦一模一样。",
  },
  {
    id: "dream",
    name: "集体梦境",
    on: (d) => d.mind >= 85,
    desc: "成千上万人会同时坠入同一场梦，梦里的伤会留在身上。",
    ev: "{place}的所有人在同一刻睡去，醒来时手里都攥着同一把钥匙。",
  },
];
const SEVERITY = ["轻微的", "明显的", "危险的", "灾难级的"];

const WORLD_DESC = {
  gravity: {
    lo: "重力只有常态的 {x}，人们在半空中行走，建筑向高处生长。",
    hi: "重力是常态的 {x}，一切都沉重而缓慢，人们习惯了低矮厚实的建筑与强健的骨骼。",
  },
  time: {
    lo: "时间流速仅为标准的 {x}，一个昼夜漫长得像一周。",
    hi: "时间以标准的 {x} 飞逝，人们的寿命与决策都显得匆忙。",
  },
  space: {
    hi: "空间不再可靠：走廊会变长，门后可能通向别处，地图必须每天重画。",
  },
  entropy: {
    hi: "能量守恒在局部失效——永动装置偶有诞生，热的东西可能自发变冷，也可能凭空燃烧。",
  },
  aether: {
    lo: "灵能几近枯竭，魔法只剩传说与遗迹。",
    hi: "灵能浓稠如雾，咒式几乎无需咏唱，空气里漂着发光的微粒。",
  },
  anomaly: {
    hi: "现实处处是裂隙，异常实体与规则漏洞成了日常，「收容」与「遗忘」是这个世界的两种生存术。",
  },
  causality: {
    hi: "因果变得松弛：预兆会应验，巧合会变成必然，也有人能在过去留下痕迹。",
  },
  mind: {
    hi: "意志能雕刻现实。强烈的情绪会在世上留下痕迹，谎言与信念一样有重量。",
  },
};
function describeWorld(w) {
  const d = w.dials,
    cand = [];
  DIALS.forEach((dl) => {
    const v = d[dl.id],
      txt = WORLD_DESC[dl.id];
    const x =
      dl.id === "gravity"
        ? gMul(v).toFixed(2) + " 倍"
        : dl.id === "time"
          ? tMul(v).toFixed(2) + " 倍"
          : "";
    if (dl.center) {
      if (v < 50 && txt.lo && devOf(dl, v) >= 25)
        cand.push([devOf(dl, v), txt.lo.replace("{x}", x)]);
      if (v > 50 && txt.hi && devOf(dl, v) >= 25)
        cand.push([devOf(dl, v), txt.hi.replace("{x}", x)]);
    } else {
      if (v >= 25 && txt.hi) cand.push([v, txt.hi]);
      if (v <= 10 && txt.lo) cand.push([30, txt.lo]);
    }
  });
  cand.sort((a, b) => b[0] - a[0]);
  const main = cand.slice(0, 3).map((c) => c[1]);
  let s = main.length
    ? main.join("")
    : "这是一个几乎与现实无异的世界，异常只藏在缝隙里。";
  const m = worldMods(w).sys;
  const top = Object.entries(m).sort((a, b) => b[1] - a[1])[0];
  s +=
    top[1] >= 1
      ? `在这里，${SYSTEMS[top[0]].name}体系最为活跃（效率 ×${top[1].toFixed(2)}）。`
      : `在这里，所有体系都受到压制，相对最有效的是${SYSTEMS[top[0]].name}（效率 ×${top[1].toFixed(2)}）。`;
  return s;
}

/* ==========================================================================
   二、体系层：四种能力逻辑
   ========================================================================== */
const SYSTEMS = {
  magic: {
    id: "magic",
    name: "魔法",
    tag: "学得而来的结构化技艺",
    summary:
      "以符文、咒式与仪式操作外部灵能。可学习、可传承，靠结构与准备取胜。",
    source: "外部灵能：灵脉、星象、契约物",
    cost: "灵能 + 咏唱时间 + 媒介",
    limit: "需要符文、咏唱或媒介，准备越久越强",
    backlash: "灵能乱流：灵能过载或枯竭都会反噬",
    strong: "万用，可仪式放大，可传承",
    weak: "慢，依赖环境灵能，可被打断",
    dial: "灵能浓度（约 55 最稳，过高过低都增加反噬）",
    resource: "灵能",
    powerStat: "智识",
    adj: ["星辉", "苍蓝", "炽焰", "月蚀", "秘银", "古符", "霜华", "雷鸣"],
    suffix: ["术", "咒", "诀", "阵"],
    costs: [
      "消耗大量灵能，咏唱越长越省",
      "需要一件媒介物，施放后损毁",
      "以一段记忆为代价激活咒式",
      "以自己的血书写咒印",
      "必须在符文阵中施放",
    ],
    limits: [
      "咏唱期间不能移动",
      "同一时间只能维持一个咒式",
      "必须看得见目标",
      "只能在灵能足够的地方使用",
      "需要事先刻好符文",
    ],
    weaknesses: [
      "咏唱被打断即告失败",
      "灵能枯竭的区域几乎无法施法",
      "惧怕反魔场",
      "失去媒介便无法施法",
      "对精神干扰缺乏抵抗",
    ],
    manifest: [
      "掌心浮现流动的符文",
      "发梢在施法时泛起星光",
      "瞳孔里映出多重魔法阵",
      "身周有细小的光尘环绕",
      "指尖会漏出微弱的电弧",
      "影子在施法时呈现另一种形状",
    ],
    passives: [
      {
        name: "灵能感知",
        desc: "能察觉三十米内的灵能流动，先攻 +3",
        mods: { init: 3 },
      },
      {
        name: "魔力循环",
        desc: "灵能自然恢复更快，每回合额外回复 3%",
        mods: { enRegen: 0.03 },
      },
      {
        name: "咒式护层",
        desc: "常驻一层薄薄的护层，防御 +3",
        mods: { def: 3 },
      },
    ],
    titles: ["星图学徒", "符文匠", "夜行术士", "灰塔守望人", "咒式抄写员"],
  },
  anomaly: {
    id: "anomaly",
    name: "异常",
    tag: "被污染而生的不可控之力",
    summary:
      "来自现实裂隙的渗透。力量强大却不可完全驾驭，使用者本身会被慢慢改写。",
    source: "现实裂隙、异常实体、被污染的物件",
    cost: "存在稳定度 + 记忆 + 身体畸变",
    limit: "异常有自己的「收容规则」，必须遵守",
    backlash: "现实排斥：稳定度过低会被世界抹去",
    strong: "无视常规防御，规则级手段",
    weak: "不可控，会侵蚀使用者",
    dial: "异常浓度（越浓越强，反噬与环境侵蚀也越高）",
    resource: "渗流",
    powerStat: "感知与意志",
    adj: ["无名", "第七", "逆相", "蚀刻", "镜面", "空白", "静默", "褪色"],
    suffix: ["异象", "畸变", "回响", "渗漏"],
    costs: [
      "消耗「存在稳定度」，每次使用都会变得更淡",
      "丢失一段近期记忆",
      "身体某处发生小幅畸变",
      "会引来其他异常的注意",
      "让周围的人短暂忘记你的存在",
    ],
    limits: [
      "异常自带收容规则，必须遵守",
      "不能被直视或被记录",
      "只在特定的时间或地点起效",
      "必须有人相信才会起效",
      "每次只能改变一个细节",
    ],
    weaknesses: [
      "稳定度过低时会被现实排斥",
      "异常倾向会一点点侵蚀性格",
      "对「命名」与「定义」类攻击脆弱",
      "镜子与照片会暴露异常",
      "收容规则一旦被破解，能力立刻失效",
    ],
    manifest: [
      "影子不跟随本体，有时抢先一步",
      "皮肤下偶尔闪过像素状的噪点",
      "眼中有重影，像同时看着两个世界",
      "说话时带着轻微的回声延迟",
      "照片里的你与本人略有不同",
      "靠近时电子设备会短暂出错",
    ],
    passives: [
      {
        name: "现实钝感",
        desc: "对世界的崩坏不那么敏感，稳定度上限 +15",
        mods: { stb: 15 },
      },
      {
        name: "缝隙行者",
        desc: "能顺着裂隙侧身而过，闪避 +6%",
        mods: { dodge: 0.06 },
      },
      {
        name: "蚀刻皮肤",
        desc: "皮肤下有异常纹路，防御 +2，每回合回复 2% 生命",
        mods: { def: 2, hpRegen: 0.02 },
      },
    ],
    titles: ["缝隙行者", "收容员", "镜前人", "失名者", "第七观测员"],
  },
  psi: {
    id: "psi",
    name: "超能力",
    tag: "与身体绑定的天赋",
    summary:
      "源自自身生物场与意志的先天能力。直接、迅速、不依赖外物，但主题单一且有上限。",
    source: "自身的生物场与意志",
    cost: "体力、精神，过载时透支健康",
    limit: "能力主题单一，射程与强度有天花板",
    backlash: "能力暴走：精力见底时最危险",
    strong: "即发即至，稳定可靠，不依赖环境",
    weak: "题材狭窄，受情绪影响，可被抑制",
    dial: "心念显化（越高越强）与因果松弛",
    resource: "精力",
    powerStat: "意志",
    adj: ["本能", "共振", "原生", "极限", "失控", "觉醒", "低语"],
    suffix: [""],
    costs: [
      "消耗体力与精神，过载后昏迷",
      "每次使用会暂时失去一种感官",
      "强烈的情绪才能激发",
      "使用后体温骤降或骤升",
      "以健康换取瞬间爆发",
    ],
    limits: [
      "只能作用于视线内的目标",
      "主题单一，无法扩展",
      "必须接触才能生效",
      "强度随情绪波动",
      "有明确的射程上限",
    ],
    weaknesses: [
      "情绪失控会导致能力暴走",
      "对精神控制缺乏抵抗",
      "能力可被「抑制器」封锁",
      "连续使用会造成身体损伤",
      "天赋有上限，难以突破",
    ],
    manifest: [
      "血管在发力时透出微光",
      "周身有静电与细小的浮尘",
      "体温异常，靠近能感到冷或热",
      "发动时瞳孔收缩成一条细线",
      "头发无风自动",
      "指尖有细微的震颤与低鸣",
    ],
    passives: [
      {
        name: "本能预警",
        desc: "受袭前有直觉，先攻 +4，闪避 +4%",
        mods: { init: 4, dodge: 0.04 },
      },
      {
        name: "越界体质",
        desc: "能力使身体得到强化，生命 +10%",
        mods: { hpPct: 0.1 },
      },
      {
        name: "意志涌流",
        desc: "每回合额外回复 4% 精力",
        mods: { enRegen: 0.04 },
      },
    ],
    titles: ["觉醒者", "脉冲", "共鸣体", "旧日信使", "静电孩子"],
  },
  dominion: {
    id: "dominion",
    name: "权能",
    tag: "以誓约换来的概念级权柄",
    summary:
      "与某个概念订立契约后获得的规则级力量。强得近乎不讲理，但必须遵守戒律。",
    source: "与概念订立的誓约",
    cost: "寿命、名字、情感，或一件重要的东西",
    limit: "必须遵守戒律，破戒即失效",
    backlash: "破戒：违背誓约会失去权能，甚至失去自我",
    strong: "概念覆写，对所有体系都占优",
    weak: "戒律可被利用，领域外受限",
    dial: "因果松弛（越高越强）与心念显化",
    resource: "权柄",
    powerStat: "意志与魅力",
    adj: [
      "寂静",
      "星火",
      "荣耀",
      "饥饿",
      "遗忘",
      "潮汐",
      "终末",
      "誓约",
      "黎明",
    ],
    suffix: [""],
    costs: [
      "以誓约为代价：每次使用折损一段寿命",
      "以「名字」的一部分作抵押",
      "需要向某个存在献上供奉",
      "以一项重要的情感作押",
      "每次使用之后，永久失去一件微小的东西",
    ],
    limits: [
      "必须遵守「戒律」，破戒即告失效",
      "仅在自己的「领域」内起效",
      "只对回应了誓词的对象起效",
      "必须先宣告，再执行",
      "每个满月只能动用一次极限权能",
    ],
    weaknesses: [
      "被迫破戒时会失去权能",
      "领域之外的能力大幅受限",
      "「真名」被得知时会被反制",
      "戒律可以被用来设陷阱",
      "权能反噬：过度使用会丧失自我",
    ],
    precepts: [
      "不可说谎",
      "不可伤害未拔刃者",
      "夜间不可入睡超过三小时",
      "不可未经邀请踏入他人的家门",
      "不可与人对视超过三息",
      "不可拒绝求助者",
      "不可再碰盐",
      "不可触碰金属",
    ],
    manifest: [
      "头顶隐约浮现半透明的光环",
      "脚下的影子里有第二个轮廓",
      "说话时词句带着金属般的回响",
      "周围的烛火与灯光会向你偏斜",
      "在场的人会下意识压低声音",
      "眼中有细小的、缓慢旋转的圆环",
    ],
    passives: [
      {
        name: "威压",
        desc: "存在感令敌人难以下手，闪避 +5%，稳定度 +10",
        mods: { dodge: 0.05, stb: 10 },
      },
      {
        name: "誓约之身",
        desc: "誓约护体，生命 +8%，稳定度 +10",
        mods: { hpPct: 0.08, stb: 10 },
      },
      {
        name: "敕令余响",
        desc: "权柄缓慢回流，每回合额外回复 3%",
        mods: { enRegen: 0.03 },
      },
    ],
    titles: ["誓约者", "持钥人", "戒律行者", "权柄代行人", "无冕之人"],
  },
};
const SYS_IDS = Object.keys(SYSTEMS);

/* 体系克制：攻击方 → 防守方 的威力倍率 */
const MATCHUP = {
  magic: { magic: 1, anomaly: 1.25, psi: 0.8, dominion: 0.9 },
  anomaly: { magic: 0.8, anomaly: 1, psi: 1.25, dominion: 0.9 },
  psi: { magic: 1.25, anomaly: 0.8, psi: 1, dominion: 0.9 },
  dominion: { magic: 1.15, anomaly: 1.15, psi: 1.15, dominion: 1 },
};

const TIERS = [
  null,
  { n: "初觉", d: "刚触及能力，尚不稳定" },
  { n: "入门", d: "能可靠地使用单一能力" },
  { n: "熟练", d: "能组合技巧，足以对付数名常人" },
  { n: "精锐", d: "组织里的骨干，可对抗小型异常" },
  { n: "宗师", d: "一方强者，能改变局部环境" },
  { n: "灾厄", d: "单人足以扭转城区格局，触及时间与因果" },
  { n: "域主", d: "拥有自己的「领域」，局部改写法则" },
  { n: "半神", d: "影响整片区域的现实结构" },
  { n: "概念", d: "与某个概念绑定，近乎设定级的存在" },
];

/* ==========================================================================
   三、能力层：域 × 效果 × 形态 × 触发 × 代价 × 限制
   ========================================================================== */
const DOMAINS = [
  { id: "matter", name: "物质", obj: "物质结构", minTier: 1, w: 10 },
  { id: "energy", name: "能量", obj: "能量流", minTier: 1, w: 10 },
  { id: "life", name: "生命", obj: "生命力", minTier: 1, w: 8 },
  { id: "mind", name: "精神", obj: "精神与意识", minTier: 2, w: 8 },
  { id: "space", name: "空间", obj: "空间坐标", minTier: 3, w: 5 },
  { id: "info", name: "信息", obj: "信息与记忆", minTier: 3, w: 5 },
  { id: "time", name: "时间", obj: "时间流", minTier: 5, w: 3 },
  { id: "cause", name: "因果", obj: "因果链", minTier: 6, w: 2 },
  { id: "concept", name: "概念", obj: "概念与定义", minTier: 7, w: 1.5 },
  { id: "light", name: "光影", obj: "光与影", minTier: 2, w: 7 },
  { id: "resonance", name: "共振", obj: "振动与共鸣", minTier: 2, w: 6 },
  { id: "artifice", name: "造物", obj: "造物与机关", minTier: 2, w: 6 },
  { id: "growth", name: "生长", obj: "生长与腐朽", minTier: 2, w: 6 },
  { id: "gravity", name: "引力", obj: "引力场", minTier: 3, w: 4 },
  { id: "dream", name: "梦境", obj: "梦境与幻象", minTier: 4, w: 4 },
  { id: "death", name: "生死", obj: "生与死的界线", minTier: 5, w: 2.5 },
  { id: "contract", name: "契约", obj: "契约与誓言", minTier: 5, w: 2.5 },
  { id: "void", name: "虚无", obj: "虚无与空缺", minTier: 7, w: 1.2 },
];
const EFFECTS = [
  {
    id: "create",
    name: "生成",
    word: "构筑",
    roles: ["attack", "support"],
    tpl: (o) => `凭空构筑出${o}的具象，并加以驱使`,
  },
  {
    id: "destroy",
    name: "湮灭",
    word: "湮灭",
    roles: ["attack"],
    tpl: (o) => `抹除目标范围内的${o}，使其归于虚无`,
  },
  {
    id: "transmute",
    name: "转化",
    word: "嬗变",
    roles: ["attack", "support"],
    tpl: (o) => `把一种${o}整个转化为另一种形态`,
  },
  {
    id: "control",
    name: "操控",
    word: "支配",
    roles: ["attack", "support"],
    tpl: (o) => `支配范围内的${o}，改变其运动与走向`,
  },
  {
    id: "sense",
    name: "感知",
    word: "洞察",
    roles: ["utility"],
    tpl: (o) => `洞察周围${o}的流动，找出其中的异常与破绽`,
  },
  {
    id: "boost",
    name: "强化",
    word: "增幅",
    roles: ["support"],
    tpl: (o) => `增幅自身或盟友的${o}，持续数个回合`,
  },
  {
    id: "weaken",
    name: "削弱",
    word: "凋零",
    roles: ["attack"],
    tpl: (o) => `使目标的${o}逐步衰竭、迟滞乃至失效`,
  },
  {
    id: "copy",
    name: "复制",
    word: "拓印",
    roles: ["utility", "support"],
    tpl: (o) => `复写一份${o}的完整拷贝，可暂存并重现`,
  },
  {
    id: "seal",
    name: "封禁",
    word: "封缄",
    roles: ["attack", "utility"],
    tpl: (o) => `封缄目标的${o}，使其暂时无法发挥作用`,
  },
  {
    id: "swap",
    name: "置换",
    word: "换位",
    roles: ["utility", "attack"],
    tpl: (o) => `将两处的${o}互换位置或状态`,
  },
];
const FORMS = [
  "单体",
  "范围",
  "投射",
  "领域",
  "接触",
  "自身",
  "延迟标记",
  "具现",
];
const RANGES = ["近身", "中距", "远程", "视野内", "感知范围"];
const TRIGGERS = [
  "意念即发",
  "咏唱或宣告后发动",
  "受到攻击时自动触发",
  "生命低于三成时觉醒",
  "需要短暂的仪式准备",
  "以手势或动作引导",
];
const SLOT_NAME = {
  core: "核心能力",
  combat: "战斗技",
  utility: "辅助技",
  passive: "被动",
};

function abilityName(r, sys, dom, eff) {
  const base = dom.name + eff.word;
  if (sys.id === "magic" || sys.id === "anomaly")
    return `${r.pick(sys.adj)}·${base}${r.pick(sys.suffix)}`;
  if (sys.id === "psi") return `${r.pick(sys.adj)}·${base}`;
  return `「${r.pick(sys.adj)}」权柄·${base}`;
}
function makeAbility(r, ch, slot, dom, eff) {
  const sys = SYSTEMS[ch.system];
  return {
    slot,
    name: abilityName(r, sys, dom, eff),
    domain: dom.name,
    effect: eff.name,
    form: r.pick(FORMS),
    range: r.pick(RANGES),
    trigger: r.pick(TRIGGERS),
    desc: eff.tpl(dom.obj),
    rank:
      slot === "core"
        ? ch.tier
        : Math.max(1, ch.tier - (slot === "combat" ? 1 : 2)),
    cost: slot === "utility" ? null : r.pick(sys.costs),
    limit: slot === "combat" ? null : r.pick(sys.limits),
  };
}

/* ==========================================================================
   四、角色层：出身 / 属性 / 性格 / 外观 / 背景
   ========================================================================== */
const ATTRS = [
  { k: "STR", n: "体魄", d: "力量与耐久" },
  { k: "AGI", n: "敏捷", d: "速度与反应" },
  { k: "INT", n: "智识", d: "推理与术式理解" },
  { k: "WIL", n: "意志", d: "精神强度与稳定度" },
  { k: "PER", n: "感知", d: "洞察与对异常的敏感" },
  { k: "CHA", n: "魅力", d: "存在感与统御力" },
];
const ATTR_KEYS = ATTRS.map((a) => a.k);

const ORIGINS = [
  {
    id: "human",
    name: "觉醒人类",
    body: "血肉之躯，构造与常人无异，但神经系统对异常刺激格外敏感。",
    mods: { WIL: 1, PER: 1 },
    trait: { n: "适应者", d: "不挑体系，所有体系威力 +5%" },
    fx: { power: { all: 1.05 } },
    weak: "肉体脆弱，缺乏先天抗性",
    corrupt: 0,
    stb: 0,
    h: 0,
    looks: [
      "眼神里总带着一点警觉",
      "手上有常年握持器具留下的茧",
      "气息平常，混进人群里毫不起眼",
    ],
  },
  {
    id: "aether",
    name: "灵血后裔",
    body: "血液里流着稀薄的灵能，心脏搏动时会泛出微光；骨骼比常人更轻。",
    mods: { INT: 2, WIL: 1, STR: -1 },
    trait: { n: "灵血亲和", d: "魔法威力 +15%，灵能每回合额外回复 2%" },
    fx: { power: { magic: 1.15 }, enRegen: 0.02 },
    weak: "灵能枯竭时迅速衰弱（稳定度上限 −10）",
    corrupt: 0,
    stb: -10,
    h: 0,
    looks: [
      "皮肤下隐约能看到发光的细脉",
      "尖端略长的耳廓",
      "呼吸时偶尔呵出淡淡的光雾",
    ],
  },
  {
    id: "warped",
    name: "异化畸变体",
    body: "身体的一部分已被异常改写：骨骼、皮肤或器官发生了不可逆的重构。",
    mods: { STR: 2, PER: 1, CHA: -2 },
    trait: { n: "畸变之躯", d: "受异常伤害 ×0.75，异常威力 +10%" },
    fx: { power: { anomaly: 1.1 }, resist: { anomaly: 0.75 } },
    weak: "稳定度上限低，外貌令社交受阻",
    corrupt: 25,
    stb: -15,
    h: 3,
    looks: [
      "右臂覆着一层不属于人类的甲质",
      "关节的方向偶尔与常理相悖",
      "脊背上有一列缓慢起伏的凸起",
    ],
  },
  {
    id: "construct",
    name: "构装人",
    body: "以金属、陶瓷或魔像材料构成的躯壳，核心处有一枚驱动结构，无需进食与呼吸。",
    mods: { STR: 3, AGI: -1, CHA: -1 },
    trait: { n: "构装躯壳", d: "物理伤害 ×0.85，精神类侵蚀 ×0.7" },
    fx: { physTaken: 0.85, stbTaken: 0.7, resist: { magic: 1.2 } },
    weak: "受魔法伤害 ×1.2（灵能干扰）",
    corrupt: 0,
    stb: 0,
    h: 10,
    ageless: true,
    looks: [
      "关节处露出细密的接缝",
      "胸口有一枚缓慢明灭的核心",
      "声音带着轻微的金属共鸣",
    ],
  },
  {
    id: "elemental",
    name: "元素灵体",
    body: "身体由半凝聚的能量或元素构成，轮廓会在情绪波动时模糊、流动。",
    mods: { AGI: 2, INT: 1, STR: -2 },
    trait: { n: "半非物质", d: "闪避 +10%，灵能每回合额外回复 2%" },
    fx: { dodge: 0.1, enRegen: 0.02 },
    weak: "存在易被「驱散」（稳定度侵蚀 ×1.25）",
    corrupt: 5,
    stb: 0,
    h: 0,
    ageless: true,
    looks: [
      "轮廓边缘像被风吹散的烟",
      "走过之处留下短暂的温度差",
      "影子比本体更清晰",
    ],
  },
  {
    id: "host",
    name: "异常寄居者",
    body: "体内寄居着一个未被收容的异常，它偶尔会在你的肋骨间翻个身。",
    mods: { PER: 2, WIL: 1, CHA: -1 },
    trait: { n: "寄居者", d: "异常威力 +20%，每回合回复 2% 生命" },
    fx: { power: { anomaly: 1.2 }, hpRegen: 0.02 },
    weak: "稳定度低时，体内的东西可能夺取控制",
    corrupt: 40,
    stb: -10,
    h: 0,
    looks: [
      "皮下偶尔鼓起一个不属于你的形状",
      "有时会对着空无一物的地方低声交谈",
      "体温比常人低一些",
    ],
  },
  {
    id: "beast",
    name: "古兽血脉",
    body: "骨骼与肌腱带着兽类的比例，感官锐利，指甲与牙齿比常人更硬。",
    mods: { STR: 2, AGI: 2, INT: -1, CHA: -1 },
    trait: { n: "野性再生", d: "每回合回复 2.5% 生命，闪避 +3%" },
    fx: { hpRegen: 0.025, dodge: 0.03 },
    weak: "受血腥与满月刺激时易失控（稳定度上限 −5）",
    corrupt: 5,
    stb: -5,
    h: 5,
    looks: ["瞳孔在暗处会反光", "犬齿比常人更长", "颈后有一圈更粗硬的发"],
  },
  {
    id: "echo",
    name: "概念残响",
    body: "由某个被遗忘的概念凝成的存在，人们记不住你的样貌，只记得你留下的感觉。",
    mods: { WIL: 2, INT: 1, PER: 1, STR: -2 },
    trait: { n: "残响存在", d: "稳定度侵蚀 ×0.5，异常与权能威力 +10%" },
    fx: { stbTaken: 0.5, power: { anomaly: 1.1, dominion: 1.1 } },
    weak: "存在感稀薄，生命上限 −10%",
    corrupt: 15,
    stb: 10,
    h: 0,
    ageless: true,
    hpPct: -0.1,
    looks: [
      "照片里的你总是模糊的",
      "别人常常叫错你的名字",
      "你走进房间时，人们会先觉得「好像有谁来过」",
    ],
  },
  {
    id: "undead",
    name: "不死者",
    body: "心跳早已停止，躯体靠某种残留的意志维系；伤口愈合得很慢，却几乎不会腐坏。",
    mods: { WIL: 2, STR: 1, CHA: -2 },
    trait: { n: "不朽躯壳", d: "每回合回复 1.5% 生命，稳定度侵蚀 ×0.8" },
    fx: { hpRegen: 0.015, stbTaken: 0.8, domTaken: { 生命: 1.25 } },
    weak: "生命域能力对你反向起效（受到 ×1.25）",
    corrupt: 20,
    stb: 0,
    h: 2,
    ageless: true,
    looks: [
      "皮肤冰冷，几乎没有脉搏",
      "伤口边缘泛着青灰，不流血",
      "人们靠近时会下意识后退半步",
    ],
  },
  {
    id: "starborn",
    name: "星裔",
    body: "血脉里混着星辰的碎屑，夜里皮肤会浮起细小的星点；对光与引力格外敏感。",
    mods: { CHA: 2, INT: 1, WIL: 1, STR: -1 },
    trait: { n: "星辉庇佑", d: "魔法与权能威力 +10%，光影域能力威力 +15%" },
    fx: { power: { magic: 1.1, dominion: 1.1 }, domPower: { 光影: 1.15 } },
    weak: "在灵能枯竭的地方黯淡无力（稳定度上限 −5）",
    corrupt: 0,
    stb: -5,
    h: 0,
    looks: [
      "夜里皮肤浮起细小的星点",
      "瞳孔深处像有一小片星空",
      "影子边缘带着淡淡的光晕",
    ],
  },
  {
    id: "mimic",
    name: "拟态体",
    body: "没有固定的形态，能在短时间内模仿他人的轮廓；真正的样子连自己也记不太清。",
    mods: { AGI: 2, PER: 1, CHA: 1, WIL: -1 },
    trait: { n: "万相之形", d: "闪避 +6%，能量每回合额外回复 2%" },
    fx: { dodge: 0.06, enRegen: 0.02 },
    weak: "自我认同薄弱（稳定度上限 −10）",
    corrupt: 10,
    stb: -10,
    h: 0,
    looks: [
      "五官在不注意时会轻微漂移",
      "笑容总像在模仿某个人",
      "手指的数目偶尔看起来对不上",
    ],
  },
  {
    id: "pact",
    name: "契约缔结者",
    body: "外表是普通人，灵魂上却刻着一份契约，对方的目光会在关键时刻落在你身上。",
    mods: { WIL: 1, CHA: 2 },
    trait: { n: "契约加护", d: "权能威力 +15%，超能力威力 +5%" },
    fx: { power: { dominion: 1.15, psi: 1.05 }, stbDrain: 0.8 },
    weak: "契约方索取代价：每回合稳定度额外 −0.8",
    corrupt: 10,
    stb: 0,
    h: 0,
    looks: [
      "左手背有一枚会发烫的印记",
      "签下的名字有时会在纸上自己改写",
      "有人说你身后站着另一个影子",
    ],
  },
  {
    id: "dreamer",
    name: "梦行者",
    body: "一半的意识总在别处漫游，清醒时也像在做梦；对精神层面的冲击更有抵抗力。",
    mods: { INT: 1, PER: 2, WIL: 1, STR: -2 },
    trait: {
      n: "梦境亲和",
      d: "精神域与梦境域能力威力 +20%，稳定度侵蚀 ×0.85",
    },
    fx: { stbTaken: 0.85, domPower: { 精神: 1.2, 梦境: 1.2 } },
    weak: "身体羸弱，缺乏防护（防御 −1.5）",
    corrupt: 5,
    stb: 0,
    h: -2,
    def: -1.5,
    looks: [
      "目光总落在很远的地方",
      "偶尔说着话就睡着一秒",
      "眼下常年有淡淡的青影",
    ],
  },
  {
    id: "chrono",
    name: "时痕者",
    body: "身体的一部分被困在别的时间里：一只手比另一只年长，或者影子比你慢了半拍。",
    mods: { AGI: 1, PER: 1, INT: 1, WIL: -1 },
    trait: { n: "时间褶层", d: "闪避 +5%，时间域与因果域能力威力 +20%" },
    fx: { dodge: 0.05, domPower: { 时间: 1.2, 因果: 1.2 } },
    weak: "记忆错位（稳定度上限 −8）",
    corrupt: 10,
    stb: -8,
    h: 0,
    ageless: true,
    looks: [
      "一只手比另一只显得更年长",
      "影子总是慢半拍",
      "总在别人说完之前就作出回应",
    ],
  },
  {
    id: "voidborn",
    name: "虚空裔",
    body: "身体中央有一处「空」，光线与视线都会被它悄悄吞掉；你更像一个洞，而不是一个人。",
    mods: { WIL: 2, PER: 1, CHA: -1 },
    trait: {
      n: "虚空之壳",
      d: "受异常伤害 ×0.85，受超能力伤害 ×0.9；虚无域威力 +20%",
    },
    fx: {
      resist: { anomaly: 0.85, psi: 0.9, magic: 1.15 },
      domPower: { 虚无: 1.2 },
    },
    weak: "对灵能类攻击更脆弱（魔法伤害 ×1.15）",
    corrupt: 30,
    stb: -5,
    h: 0,
    looks: [
      "胸口有一处光线照不进的暗",
      "脚步声比正常的更轻",
      "照片里你所在的位置像被抠掉了一块",
    ],
  },
];
const ORIGIN_BY_ID = Object.fromEntries(ORIGINS.map((o) => [o.id, o]));

const ARCHETYPES = [
  {
    id: "vanguard",
    name: "突击者",
    w: { STR: 3, AGI: 2, INT: 0, WIL: 1, PER: 1, CHA: 0 },
  },
  {
    id: "arcanist",
    name: "术式师",
    w: { STR: 0, AGI: 1, INT: 3, WIL: 2, PER: 1, CHA: 0 },
  },
  {
    id: "shadow",
    name: "潜行者",
    w: { STR: 0, AGI: 3, INT: 1, WIL: 0, PER: 3, CHA: 1 },
  },
  {
    id: "guardian",
    name: "守护者",
    w: { STR: 2, AGI: 0, INT: 0, WIL: 3, PER: 1, CHA: 1 },
  },
  {
    id: "commander",
    name: "统御者",
    w: { STR: 0, AGI: 0, INT: 2, WIL: 2, PER: 1, CHA: 3 },
  },
  {
    id: "scholar",
    name: "学者",
    w: { STR: 0, AGI: 0, INT: 3, WIL: 1, PER: 3, CHA: 1 },
  },
  {
    id: "balanced",
    name: "均衡型",
    w: { STR: 1, AGI: 1, INT: 1, WIL: 1, PER: 1, CHA: 1 },
  },
];
const ARCH_BY_ID = Object.fromEntries(ARCHETYPES.map((a) => [a.id, a]));

const BIG5 = [
  {
    id: "O",
    n: "开放性",
    lo: "守旧",
    hi: "好奇",
    hiT: ["好奇心旺盛", "热衷探索未知", "思维跳跃"],
    loT: ["偏爱熟悉的秩序", "谨慎守旧", "务实"],
  },
  {
    id: "C",
    n: "尽责性",
    lo: "随性",
    hi: "自律",
    hiT: ["自律严谨", "言出必行", "条理分明"],
    loT: ["随性散漫", "爱临时起意", "厌恶束缚"],
  },
  {
    id: "E",
    n: "外向性",
    lo: "内敛",
    hi: "外放",
    hiT: ["善于交际", "热情外放", "爱当焦点"],
    loT: ["沉默寡言", "独来独往", "习惯先观察"],
  },
  {
    id: "A",
    n: "宜人性",
    lo: "尖锐",
    hi: "温和",
    hiT: ["体贴温和", "乐于合作", "容易共情"],
    loT: ["言辞尖锐", "多疑好胜", "不轻信人"],
  },
  {
    id: "N",
    n: "情绪敏感",
    lo: "沉稳",
    hi: "敏感",
    hiT: ["情绪起伏大", "容易焦虑", "感受细腻"],
    loT: ["情绪稳定", "临危不乱", "冷静得近乎冷漠"],
  },
];
const MOTIVATIONS = [
  "寻找一位失踪的至亲",
  "向摧毁故乡的异常复仇",
  "守护最后一座尚未失序的城市",
  "钻研被禁止的知识",
  "追逐更强的力量",
  "为过去的罪行赎罪",
  "摆脱某个组织的追捕",
  "重建崩坏之前的秩序",
  "证明自己不是怪物",
  "找到让一切恢复正常的方法",
  "收集世上所有的异常并妥善保管",
  "只想活下去，也让身边的人活下去",
];
const FLAWS = [
  "害怕被遗忘",
  "无法信任任何人",
  "傲慢，不肯承认失误",
  "对力量上瘾",
  "说谎成癖",
  "对血与伤口过度敏感",
  "对逝者难以释怀",
  "无法拒绝求助者",
  "控制欲过强",
  "习惯逃避责任",
  "对镜子与倒影怀有恐惧",
  "一被注视就会窒息",
];
const SPEECHES = [
  "言简意赅，几乎不说废话",
  "絮絮叨叨，爱讲故事",
  "爱引用古语与典故",
  "讽刺挖苦，笑里藏刀",
  "语气温和，句句留有余地",
  "夸张戏剧化，像在舞台上",
  "冷静克制，用词精确",
  "口无遮拦，想到什么说什么",
  "喜欢用问句回答问题",
  "古风腔调，自称「在下」",
];
const QUIRKS = [
  "习惯性摩挲随身的物件",
  "总在数楼梯的阶数",
  "会把雨伞当武器",
  "睡前必须检查三遍门窗",
  "有随手折纸的习惯",
  "会对空无一人的角落点头致意",
  "只在午夜之后进食",
  "随身带着一本从不写字的笔记本",
  "喜欢收集废旧钟表零件",
  "紧张时会哼一段不成调的曲子",
  "从不踩地砖的缝隙",
  "总带着一小瓶盐",
];

const HAIR_COLORS = [
  "漆黑",
  "银白",
  "深棕",
  "暗红",
  "雾蓝",
  "灰褐",
  "淡金",
  "墨绿",
  "紫灰",
  "霜白渐变至墨色",
];
const HAIR_STYLES = [
  "齐肩短发",
  "束成低马尾的长发",
  "凌乱的短发",
  "编成细辫的头发",
  "及腰长发",
  "利落的寸头",
  "单侧剃短的发型",
  "微卷的中长发",
];
const EYE_COLORS = [
  "琥珀色",
  "灰蓝色",
  "深褐色",
  "翠绿色",
  "浅金色",
  "暗红色",
  "近乎透明的灰色",
  "紫罗兰色",
];
const EYE_SHAPES = [
  "眼睛",
  "竖瞳",
  "眼睛，瞳孔边缘有细小的光环",
  "眼睛，左右瞳色略有不同",
  "眼睛，虹膜里有缓慢旋转的星点",
];
const SKINS = ["白皙", "小麦色", "古铜色", "冷白带青", "苍灰", "深褐", "暖黄"];
const MARKS = [
  "左脸有一道旧伤疤",
  "脖颈处有环形的纹路",
  "手背上有褪色的刺青",
  "缺了半截左耳",
  "额侧有一截断裂的短角",
  "右手满是陈旧的烧痕",
  "锁骨处嵌着一枚发光的晶体",
  "黑发里夹着几缕异色",
  "左眼下有一颗泪痣",
  "手腕上缠着旧布条",
];
const OUTFITS = [
  "磨旧的皮质长风衣",
  "带兜帽的灰色披风",
  "旧式军装改制的外套",
  "洗得发白的连帽衫与工装裤",
  "绣有暗纹的长袍",
  "带金属护具的轻甲",
  "剪裁利落的黑色西装",
  "层叠的围巾与斗篷",
  "拼接了各种布料的流浪者装束",
  "整洁的白色研究员外套",
];
const ITEMS = [
  "一只走时不准的怀表",
  "一根刻满符号的短杖",
  "一把断了刃的匕首",
  "一只装着不明液体的玻璃瓶",
  "半张残破的地图",
  "一枚永远温热的硬币",
  "一本会自动翻页的书",
  "一台偶尔收到不存在电台的旧收音机",
  "一串不开任何锁的钥匙",
  "一盏永远不熄的提灯",
];
const B_PLACES = [
  "浮空港口「灰鸥」",
  "裂隙边缘的收容站",
  "被灵潮淹没的旧城",
  "地下三层的档案馆",
  "循环日中的小镇",
  "一座迁徙中的移动城",
  "废弃的天文台",
  "边境的荒原聚落",
  "学院的封闭研究区",
  "漂在海上的船屋",
];
const B_TRIGGERS = [
  "一场无人生还的实验事故过后",
  "被某个异常「看见」之后",
  "在濒死的一刻",
  "继承了一位陌生人的遗物之后",
  "连续三十天梦见同一扇门之后",
  "误触了一块不该存在的石头之后",
  "与某个存在签下未读完的契约之后",
  "在灵潮之夜降生之时",
];
const B_FACTIONS = [
  "独自行动，不隶属于任何组织",
  "效力于异常收容局",
  "就读于星辉学会的封闭研究区",
  "混迹在无名的地下网络里",
  "为旧秩序守望会奔走",
  "加入了自由佣兵团",
  "守卫着边境聚落联盟",
  "正被教团「空白之环」追捕",
  "登记在观测者协会的名册上",
  "是猎异者公会的一员",
];
const FAMILY = [
  "沈",
  "顾",
  "陆",
  "苏",
  "江",
  "谢",
  "韩",
  "唐",
  "楚",
  "萧",
  "林",
  "温",
  "裴",
  "宋",
  "闻",
  "祁",
  "叶",
  "霍",
  "池",
  "燕",
  "季",
  "谭",
  "商",
  "岑",
  "言",
  "白",
  "夏",
  "孟",
];
const GIVEN = [
  "砚",
  "昭",
  "澜",
  "屿",
  "澈",
  "霁",
  "晞",
  "岚",
  "湛",
  "阙",
  "弦",
  "迟",
  "遥",
  "洛",
  "衡",
  "棠",
  "蘅",
  "渊",
  "绥",
  "珩",
  "辞",
  "昀",
  "窈",
  "槿",
  "凛",
  "沅",
  "叙",
  "宁",
  "泠",
  "斐",
  "忱",
  "拾",
];
const TITLE_ADJ = [
  "沉默的",
  "无名的",
  "断线的",
  "第七位",
  "借来的",
  "逆行的",
  "褪色的",
  "失重的",
  "回响中的",
  "未被记录的",
  "迟到的",
  "半醒的",
];

/* ---------- 角色生成 ---------- */
function newCharacter(opts = {}) {
  const seed = opts.seed || newSeed();
  const r = makeRng(seed + "|init");
  const ch = {
    seed,
    tier: opts.tier != null ? opts.tier : r.int(2, 6),
    system: opts.system || r.pick(SYS_IDS),
    origin: opts.origin || r.pick(ORIGINS).id,
    archetype: opts.archetype || r.pick(ARCHETYPES).id,
    nonce: { name: 0, persona: 0, attrs: 0, look: 0, abil: 0, bg: 0 },
  };
  ["name", "persona", "attrs", "look", "abil", "bg"].forEach((p) =>
    regen(ch, p),
  );
  return ch;
}
function regen(ch, part) {
  const n = ch.nonce[part] || 0;
  if (part === "name") {
    const r = makeRng(`${ch.seed}|name|${n}`);
    ch.name =
      r.pick(FAMILY) +
      (r.chance(0.6) ? r.pick(GIVEN) + r.pick(GIVEN) : r.pick(GIVEN));
  } else if (part === "persona") {
    const r = makeRng(`${ch.seed}|persona|${n}`);
    const bell = () =>
      Math.round(12 + ((r.next() + r.next() + r.next()) / 3) * 76);
    ch.persona = { O: bell(), C: bell(), E: bell(), A: bell(), N: bell() };
    ch.motivation = r.pick(MOTIVATIONS);
    ch.flaw = r.pick(FLAWS);
    ch.speech = r.pick(SPEECHES);
    ch.quirk = r.pick(QUIRKS);
  } else if (part === "attrs") {
    const r = makeRng(`${ch.seed}|attrs|${n}|${ch.archetype}|${ch.tier}`);
    const arch = ARCH_BY_ID[ch.archetype];
    const w = {},
      a = {};
    ATTR_KEYS.forEach((k) => {
      w[k] = (arch.w[k] + 0.6) * r.range(0.7, 1.3);
      a[k] = 3;
    });
    let pts = 42 + ch.tier * 6 - 18;
    while (pts > 0) {
      const cand = ATTR_KEYS.filter((k) => a[k] < 20);
      const k = r.weighted(cand, (x) => w[x]);
      a[k]++;
      pts--;
    }
    ch.attrs = a;
  } else if (part === "look") {
    const r = makeRng(`${ch.seed}|look|${n}`);
    ch.look = {
      age: r.int(17, 62),
      height: r.int(152, 192),
      hair: `${r.pick(HAIR_COLORS)}的${r.pick(HAIR_STYLES)}`,
      eyes: `${r.pick(EYE_COLORS)}${r.pick(EYE_SHAPES)}`,
      skin: r.pick(SKINS),
      mark: r.pick(MARKS),
      outfit: r.pick(OUTFITS),
      item: r.pick(ITEMS),
    };
  } else if (part === "abil") {
    const r = makeRng(`${ch.seed}|abil|${n}|${ch.system}|${ch.tier}`);
    const sys = SYSTEMS[ch.system];
    const pool = DOMAINS.filter((d) => d.minTier <= ch.tier);
    const pickDom = (ex) =>
      r.weighted(
        pool.filter((d) => !ex.includes(d.id)),
        (d) => d.w * (1 + (d.minTier >= 5 ? ch.tier / 5 : 0)),
      );
    const dCore = pickDom([]);
    const dCombat = r.chance(0.5) ? dCore : pickDom([dCore.id]);
    const dUtil = pickDom([dCore.id]);
    const eCore = r.pick(EFFECTS.filter((e) => e.roles.includes("attack")));
    const eCombat = r.pick(
      EFFECTS.filter((e) => e.roles.includes("attack") && e.id !== eCore.id),
    );
    const eUtil = r.pick(
      EFFECTS.filter(
        (e) =>
          (e.roles.includes("support") || e.roles.includes("utility")) &&
          e.id !== eCore.id &&
          e.id !== eCombat.id,
      ),
    );
    const p = r.pick(sys.passives);
    ch.abilities = [
      makeAbility(r, ch, "core", dCore, eCore),
      makeAbility(r, ch, "combat", dCombat, eCombat),
      makeAbility(r, ch, "utility", dUtil, eUtil),
      {
        slot: "passive",
        name: p.name,
        desc: p.desc,
        mods: p.mods,
        rank: Math.max(1, ch.tier - 1),
      },
    ];
    ch.weakness = r.pick(sys.weaknesses);
    ch.precept = sys.precepts ? r.pick(sys.precepts) : null;
  } else if (part === "bg") {
    const r = makeRng(`${ch.seed}|bg|${n}`);
    ch.bg = {
      place: r.pick(B_PLACES),
      trigger: r.pick(B_TRIGGERS),
      faction: r.pick(B_FACTIONS),
    };
  }
}
function reroll(ch, part) {
  ch.nonce[part] = (ch.nonce[part] || 0) + 1;
  regen(ch, part);
}

/* ---------- 由角色推导出的文本 ---------- */
function titleOf(ch) {
  const r = makeRng(ch.seed + "|title");
  return r.pick(TITLE_ADJ) + r.pick(SYSTEMS[ch.system].titles);
}
function manifestOf(ch) {
  return makeRng(`${ch.seed}|mf|${ch.system}|${ch.nonce.look}`).pick(
    SYSTEMS[ch.system].manifest,
  );
}
function originLookOf(ch) {
  return makeRng(`${ch.seed}|ol|${ch.origin}|${ch.nonce.look}`).pick(
    ORIGIN_BY_ID[ch.origin].looks,
  );
}
function buildText(a) {
  const s = a.STR,
    g = a.AGI;
  if (s >= 14 && g >= 14) return "精悍矫健";
  if (s >= 14 && g < 11) return "魁梧厚重";
  if (s < 9 && g >= 13) return "修长轻捷";
  if (s < 9 && g < 9) return "纤瘦单薄";
  if (s >= 12) return "结实匀称";
  return "匀称中等";
}
function lookSummary(ch, d) {
  const L = ch.look,
    o = ORIGIN_BY_ID[ch.origin];
  const age = o.ageless ? "外貌难辨年龄" : `看上去约 ${L.age} 岁`;
  return `${age}，身高约 ${L.height + (o.h || 0)} cm，${buildText(d.a)}。${L.hair}，${L.eyes}，肤色${L.skin}。${L.mark}。惯常穿着${L.outfit}，随身带着${L.item}。`;
}
function personaText(ch) {
  const p = ch.persona;
  const items = BIG5.map((b) => ({
    b,
    v: p[b.id],
    dev: Math.abs(p[b.id] - 50),
  }))
    .filter((x) => x.dev >= 10)
    .sort((x, y) => y.dev - x.dev)
    .slice(0, 3);
  if (!items.length) return "性格平和，难以归类";
  return items
    .map(({ b, v }) => {
      const r = makeRng(ch.seed + "|pt|" + b.id);
      return r.pick(v >= 50 ? b.hiT : b.loT);
    })
    .join("，");
}
function alignOf(p) {
  const law = 0.65 * p.C + 0.35 * (100 - p.O),
    good = 0.7 * p.A + 0.3 * (100 - p.N);
  const L = law >= 60 ? "守序" : law <= 42 ? "混乱" : "中立",
    G = good >= 60 ? "善良" : good <= 42 ? "邪恶" : "中立";
  return L === "中立" && G === "中立" ? "绝对中立" : L + G;
}
function bgText(ch, fac) {
  const b = ch.bg,
    sys = SYSTEMS[ch.system];
  const tail = fac
    ? `如今隶属于「${fac.name}」${ch.rank ? `（${ch.rank}）` : ""}`
    : `如今${b.faction}`;
  return `${ch.name}出身于${b.place}。${b.trigger}，TA 觉醒了${sys.name}的力量，${tail}。驱使 TA 前行的是：${ch.motivation}。`;
}

/* ---------- 数值推导 ---------- */
function mergeFx(list) {
  const o = {
    power: {},
    resist: {},
    domPower: {},
    domTaken: {},
    physTaken: 1,
    stbTaken: 1,
    stbDrain: 0,
    dodge: 0,
    hpRegen: 0,
    enRegen: 0,
    hpPct: 0,
    enPct: 0,
  };
  list.forEach((f) => {
    if (!f) return;
    ["power", "resist", "domPower", "domTaken"].forEach((g) => {
      Object.keys(f[g] || {}).forEach((k) => {
        o[g][k] = (o[g][k] || 1) * f[g][k];
      });
    });
    o.physTaken *= f.physTaken || 1;
    o.stbTaken *= f.stbTaken || 1;
    o.stbDrain += f.stbDrain || 0;
    o.dodge += f.dodge || 0;
    o.hpRegen += f.hpRegen || 0;
    o.enRegen += f.enRegen || 0;
    o.hpPct += f.hpPct || 0;
    o.enPct += f.enPct || 0;
  });
  return o;
}
function derive(ch) {
  const o = ORIGIN_BY_ID[ch.origin];
  const a = {};
  ATTR_KEYS.forEach((k) => {
    a[k] = clamp(ch.attrs[k] + (o.mods[k] || 0), 1, 24);
  });
  const passive = ch.abilities.find((x) => x.slot === "passive");
  const pm = passive ? passive.mods : {};
  const fac = REG.factions.find((f) => f.id === ch.factionId) || null;
  const facFx = fac && fac.favored ? { power: { [fac.favored]: 1.05 } } : null;
  const fx = mergeFx([o.fx, { hpPct: o.hpPct || 0 }, pm, facFx]);
  const budget = 42 + ch.tier * 6,
    used = sum(ATTR_KEYS.map((k) => ch.attrs[k])),
    over = Math.max(0, used - budget);
  const taint = ch.taint || 0;
  const corruption = clamp(
    o.corrupt + (ch.system === "anomaly" ? 10 : 0) + taint,
    0,
    100,
  );
  const powerStat = {
    magic: a.INT,
    anomaly: (a.PER + a.WIL) / 2 + corruption / 12,
    psi: a.WIL,
    dominion: (a.WIL + a.CHA) / 2,
  }[ch.system];
  const hp = Math.round(
    (30 + a.STR * 5 + a.WIL * 2 + ch.tier * 12) * (1 + fx.hpPct),
  );
  const en = Math.round(
    (20 + a.WIL * 3 + a.INT * 2 + ch.tier * 8) * (1 + fx.enPct),
  );
  const stb = Math.max(
    20,
    Math.round(
      40 +
        a.WIL * 3 +
        a.PER +
        (o.stb || 0) +
        (pm.stb || 0) -
        over * 2 -
        taint * 0.4,
    ),
  );
  const init = Math.round(a.AGI * 2 + a.PER + (pm.init || 0));
  const def = Math.max(
    0,
    Math.round(
      ((a.STR + a.AGI) / 2 + ch.tier * 1.2 + (pm.def || 0) + (o.def || 0)) * 10,
    ) / 10,
  );
  const corePower = 8 + ch.tier * 2.2 + powerStat * 1.1;
  const coreCost = 18 + ch.tier * 3;
  const d = {
    a,
    fx,
    hp,
    en,
    stb,
    init,
    def,
    budget,
    used,
    over,
    corruption,
    powerStat,
    corePower,
    coreCost,
    combPower: corePower * 0.75,
    combCost: coreCost * 0.4,
    utilCost: coreCost * 0.3,
    basic: 2 + a.STR * 0.7 + a.AGI * 0.3 + ch.tier * 0.7,
  };
  d.fac = fac;
  d.facBonus = !!(fac && fac.favored === ch.system);
  d.score = Math.round(
    hp * 0.25 + en * 0.2 + corePower * 1.5 + def + init * 0.3 + stb * 0.15,
  );
  return d;
}

/* ==========================================================================
   五、推演层：回合制对抗（单挑与小队）+ 蒙特卡洛
   ========================================================================== */
const BASIC_TXT = [
  "挥出一记重击",
  "抓住破绽突进",
  "以最直接的方式出手",
  "贴身斩出一击",
];
const STB_DOMAINS = ["精神", "信息", "概念", "梦境", "虚无"];

/* 角色关系：list 为 [{a,b,kind}]，返回 (keyA,keyB) → -2..2 */
function makeRel(list) {
  const m = new Map();
  (list || []).forEach((e) => {
    const v = (REL_KINDS.find((k) => k.id === e.kind) || { v: 0 }).v;
    const k = e.a < e.b ? e.a + "|" + e.b : e.b + "|" + e.a;
    if (!m.has(k) || Math.abs(v) > Math.abs(m.get(k))) m.set(k, v);
  });
  return (a, b) => m.get(a < b ? a + "|" + b : b + "|" + a) || 0;
}
const charKey = (ch) => ch.uid || ch.seed;

/* 小队默契：亲近的关系与同势力提高输出，互相敌视则拖后腿 */
function squadSynergy(team, rel) {
  return team.map((ch, i) => {
    let s = 0;
    team.forEach((g, j) => {
      if (i === j) return;
      const v = rel(charKey(ch), charKey(g));
      s += v > 0 ? 0.02 * v : 0.03 * v;
      if (ch.factionId && ch.factionId === g.factionId) s += 0.02;
    });
    return clamp(1 + s, 0.85, 1.15);
  });
}

function skirmish(teamA, teamB, world, opt = {}) {
  const R = opt.rng || Math.random;
  const rel = opt.rel || (() => 0);
  const log = opt.log ? [] : null;
  const L = (t, x, i) => {
    if (log) log.push({ t, x, i });
  };
  const mods = worldMods(world);
  const F = [];
  [teamA, teamB].forEach((team, ti) => {
    const syn = squadSynergy(team, rel);
    team.forEach((ch, k) => {
      const d = derive(ch);
      const cd = opt.useCond && ch.cond ? ch.cond : null;
      F.push({
        ch,
        d,
        ti,
        key: charKey(ch),
        name: ch.name,
        sys: ch.system,
        hp: d.hp * (cd ? clamp(cd.hp, 0.02, 1) : 1),
        en: d.en * (cd ? clamp(cd.en, 0.05, 1) : 1),
        stb: d.stb * (cd ? clamp(cd.stb, 0.02, 1) : 1),
        guard: false,
        agi: d.a.AGI * mods.mobility,
        alive: true,
        dead: null,
        dmg: 0,
        heal: 0,
        kills: 0,
        syn: team.length > 1 ? syn[k] : 1,
      });
    });
  });
  const alive = (ti) => F.filter((f) => f.alive && f.ti === ti);
  const down = (f) => f.hp <= 0 || f.stb <= 0;
  const surv = (f) =>
    f.alive ? clamp(Math.min(f.hp / f.d.hp, f.stb / f.d.stb), 0, 1) : 0;
  const teamSurv = (ti) => {
    const m = F.filter((f) => f.ti === ti);
    return sum(m.map(surv)) / m.length;
  };
  const wpick = (items, wf) => {
    const ws = items.map(wf);
    let x = R() * sum(ws);
    for (let i = 0; i < items.length; i++) {
      x -= ws[i];
      if (x <= 0) return items[i];
    }
    return items[items.length - 1];
  };
  const tl = [[1, 1]];

  function sweep(by) {
    F.forEach((f) => {
      if (!f.alive || !down(f)) return;
      f.alive = false;
      f.dead = f.hp <= 0 ? "hp" : "stb";
      if (by && by.ti !== f.ti) by.kills++;
      L(
        "e",
        f.dead === "hp"
          ? `${f.name} 倒下了。`
          : `${f.name} 的存在开始溶解：稳定度耗尽，被现实抹去。`,
        1 - f.ti,
      );
    });
  }

  function act(att) {
    const ab = att.ch.abilities,
      x = R();
    const weakest = alive(att.ti)
      .slice()
      .sort((a, b) => a.hp / a.d.hp - b.hp / b.d.hp)[0];
    let kind = "basic";
    if (weakest.hp < weakest.d.hp * 0.4 && att.en >= att.d.utilCost && x < 0.5)
      kind = "util";
    else if (att.en >= att.d.coreCost && x < 0.55) kind = "core";
    else if (att.en >= att.d.combCost && x < 0.85) kind = "combat";

    if (kind === "util") {
      const a = ab[2];
      att.en -= att.d.utilCost;
      const k = clamp(mods.sys[att.sys], 0.5, 1.6),
        tg = weakest;
      const heal = Math.round(tg.d.hp * 0.14 * k),
        sh = Math.round(tg.d.stb * 0.08 * k);
      tg.hp = Math.min(tg.d.hp, tg.hp + heal);
      tg.stb = Math.min(tg.d.stb, tg.stb + sh);
      tg.guard = true;
      att.heal += heal;
      L(
        "u",
        tg === att
          ? `${att.name} 施展「${a.name}」稳住阵脚：恢复 ${heal} 点生命与 ${sh} 点稳定度，并架起防护。`
          : `${att.name} 施展「${a.name}」支援 ${tg.name}：恢复 ${heal} 点生命与 ${sh} 点稳定度，并架起防护。`,
        att.ti,
      );
      return;
    }

    const foes = alive(1 - att.ti);
    const def =
      foes.length === 1
        ? foes[0]
        : wpick(
            foes,
            (d) =>
              1 +
              (1 - d.hp / d.d.hp) * 1.5 +
              (MATCHUP[att.sys][d.sys] > 1
                ? 0.6
                : MATCHUP[att.sys][d.sys] < 1
                  ? -0.3
                  : 0) +
              (rel(att.key, d.key) <= -1 ? 0.5 : 0),
          );
    const abil = kind === "basic" ? null : ab[kind === "core" ? 0 : 1];
    const how = abil
      ? `发动「${abil.name}」`
      : BASIC_TXT[Math.floor(R() * BASIC_TXT.length)];
    if (kind === "core") att.en -= att.d.coreCost;
    else if (kind === "combat") att.en -= att.d.combCost;
    const base =
      kind === "basic"
        ? att.d.basic
        : kind === "core"
          ? att.d.corePower
          : att.d.combPower;
    const wm = kind === "basic" ? 1 : mods.sys[att.sys];
    const own =
      kind === "basic"
        ? 1
        : (att.d.fx.power[att.sys] || 1) * (att.d.fx.power.all || 1);
    const domP = abil ? att.d.fx.domPower[abil.domain] || 1 : 1;
    const domT = abil ? def.d.fx.domTaken[abil.domain] || 1 : 1;
    const mu = kind === "basic" ? 1 : MATCHUP[att.sys][def.sys];
    const res =
      kind === "basic" ? def.d.fx.physTaken : def.d.fx.resist[att.sys] || 1;
    const g = rel(att.key, def.key);
    const gm = g <= -1 ? 1 + 0.04 * -g : g >= 1 ? 1 - 0.04 * g : 1;

    let hitP =
      0.85 +
      (att.agi - def.agi) * 0.015 +
      (att.d.a.PER - def.d.a.PER) * 0.005 -
      def.d.fx.dodge;
    hitP = clamp(hitP, 0.4, 0.97);
    let twist = null;
    if (R() < mods.twist) twist = R() < 0.5 ? "crit" : "miss";
    const hit = twist === "crit" ? true : twist === "miss" ? false : R() < hitP;
    const pre = twist ? "因果偏转！" : "";
    if (!hit) {
      L("m", `${pre}${att.name} ${how}，被 ${def.name} 避开了。`, att.ti);
      return;
    }

    const crit = twist === "crit" || R() < 0.06 + att.d.a.PER * 0.003;
    const heat = r > 8 ? 1 + 0.07 * (r - 8) : 1;
    const raw =
      base *
      wm *
      own *
      domP *
      mu *
      res *
      domT *
      att.syn *
      gm *
      heat *
      (0.88 + R() * 0.24) *
      (crit ? 1.5 : 1);
    const dv =
      def.d.def * (att.sys === "anomaly" && kind !== "basic" ? 0.3 : 0.6);
    let dmg = Math.max(2, raw - dv);
    if (def.guard) {
      dmg *= 0.5;
      def.guard = false;
    }
    dmg = Math.round(dmg);
    def.hp -= dmg;
    att.dmg += dmg;
    let sd = 0;
    if (abil) {
      if (STB_DOMAINS.includes(abil.domain)) sd += dmg * 0.25;
      if (att.sys === "anomaly") sd += dmg * 0.15;
      sd = Math.round(sd * def.d.fx.stbTaken);
      def.stb -= sd;
    }
    const tag =
      (crit ? "（暴击）" : "") +
      (mu > 1 ? "（体系克制）" : mu < 1 ? "（被体系压制）" : "") +
      (gm > 1 ? "（宿怨）" : gm < 1 ? "（心存犹豫）" : "");
    L(
      crit ? "c" : "h",
      `${pre}${att.name} ${how}，命中 ${def.name}：${dmg} 点伤害${sd > 0 ? `，稳定度 −${sd}` : ""}${tag}。`,
      att.ti,
    );
    if (kind !== "basic" && att.sys === "anomaly") {
      const c = Math.round(3 + R() * 5);
      att.stb -= c;
      L("b", `${att.name} 借用异常的代价：稳定度 −${c}。`, att.ti);
    }
    if (kind !== "basic" && R() < mods.backlash(att.sys, att.en / att.d.en)) {
      const bd = Math.round(raw * 0.22);
      att.hp -= bd;
      att.stb -= 8;
      const why = {
        magic: "灵能乱流",
        anomaly: "现实排斥",
        psi: "能力暴走",
        dominion: "破戒之罚",
      }[att.sys];
      L(
        "b",
        `${why}！「${abil.name}」反噬 ${att.name}：${bd} 点伤害，稳定度 −8。`,
        att.ti,
      );
    }
  }

  let winner = null,
    reason = "timeout",
    r = 0;
  const maxR = opt.maxRounds || (F.length > 2 ? 18 : 14);
  for (r = 1; r <= maxR && !winner; r++) {
    L("r", `第 ${r} 回合`);
    if (r === 9) L("w", "战局白热化：从这一回合起，双方的伤害逐回合递增。");
    F.filter((f) => f.alive).forEach((f) => {
      f.stb -= mods.ambientStb * (f.d.fx.resist.anomaly || 1) + f.d.fx.stbDrain;
      f.hp = Math.min(f.d.hp, f.hp + f.d.hp * f.d.fx.hpRegen);
      f.en = Math.min(f.d.en, f.en + f.d.en * (0.03 + f.d.fx.enRegen));
    });
    if (mods.ambientStb >= 1)
      L("w", `世界侵蚀：稳定度随环境下降约 ${mods.ambientStb.toFixed(1)}。`);
    sweep(null);
    if (alive(0).length && alive(1).length) {
      const order = F.filter((f) => f.alive)
        .map((f) => [f, f.d.init + R() * 4])
        .sort((a, b) => b[1] - a[1])
        .map((x) => x[0]);
      for (const f of order) {
        if (!f.alive) continue;
        if (!alive(0).length || !alive(1).length) break;
        act(f);
        sweep(f);
      }
    }
    const a0 = alive(0).length,
      a1 = alive(1).length;
    if (!a0 || !a1) {
      winner = !a0 && !a1 ? "draw" : !a0 ? "B" : "A";
      reason = "wipe";
    }
    tl.push([teamSurv(0), teamSurv(1)]);
  }
  if (!winner) {
    const sc = (ti) => {
      const m = F.filter((f) => f.ti === ti);
      return (
        sum(m.map((f) => (f.alive ? f.hp / f.d.hp + f.stb / f.d.stb : 0))) /
        m.length
      );
    };
    const sa = sc(0),
      sb = sc(1);
    winner = Math.abs(sa - sb) < 0.06 ? "draw" : sa > sb ? "A" : "B";
    L(
      "e",
      winner === "draw"
        ? "回合耗尽，双方势均力敌。"
        : `回合耗尽，判定${winner === "A" ? "甲方" : "乙方"}占优。`,
      winner === "A" ? 0 : 1,
    );
  } else if (winner === "draw") L("e", "双方同时倒下。");
  return {
    winner,
    reason,
    rounds: Math.min(r - 1, maxR),
    log,
    tl,
    F: F.map((f) => ({
      name: f.name,
      sys: f.sys,
      ti: f.ti,
      key: f.key,
      tier: f.ch.tier,
      hp: Math.max(0, f.hp),
      hpMax: f.d.hp,
      en: Math.max(0, f.en),
      enMax: f.d.en,
      stb: Math.max(0, f.stb),
      stbMax: f.d.stb,
      alive: f.alive,
      dead: f.dead,
      dmg: f.dmg,
      heal: f.heal,
      kills: f.kills,
      syn: f.syn,
    })),
  };
}

/* 单挑：兼容旧接口 */
function duel(A, B, world, opt = {}) {
  const r = skirmish([A], [B], world, opt);
  const loser = r.winner === "A" ? r.F[1] : r.winner === "B" ? r.F[0] : null;
  return {
    winner: r.winner,
    reason: r.reason === "wipe" ? (loser ? loser.dead : "hp") : "timeout",
    rounds: r.rounds,
    log: r.log,
    tl: r.tl,
    end: r.F.map((f) => ({
      hp: f.hp,
      hpMax: f.hpMax,
      en: f.en,
      enMax: f.enMax,
      stb: f.stb,
      stbMax: f.stbMax,
    })),
  };
}
function winRate(A, B, world, n = 300, rel) {
  let a = 0,
    b = 0,
    d = 0,
    rounds = 0;
  for (let k = 0; k < n; k++) {
    const res = duel(A, B, world, {
      rel,
      rng: mulberry32(hashStr(`mc${k}|${A.seed}|${B.seed}`)),
    });
    if (res.winner === "A") a++;
    else if (res.winner === "B") b++;
    else d++;
    rounds += res.rounds;
  }
  return { a: a / n, b: b / n, d: d / n, rounds: rounds / n };
}
function squadWinRate(TA, TB, world, n = 200, rel) {
  let a = 0,
    b = 0,
    d = 0,
    rounds = 0;
  const salt = TA.map(charKey).join(",") + "|" + TB.map(charKey).join(",");
  for (let k = 0; k < n; k++) {
    const res = skirmish(TA, TB, world, {
      rel,
      rng: mulberry32(hashStr(`sq${k}|${salt}`)),
    });
    if (res.winner === "A") a++;
    else if (res.winner === "B") b++;
    else d++;
    rounds += res.rounds;
  }
  return { a: a / n, b: b / n, d: d / n, rounds: rounds / n };
}

/* ==========================================================================
   六、社会层：势力与关系
   ========================================================================== */
const FACTION_KINDS = [
  "官方机构",
  "学派学院",
  "地下组织",
  "教团",
  "佣兵团",
  "聚落联盟",
  "商会",
  "研究会",
  "公会",
];
const ATTITUDES = [
  "收容封存",
  "研究利用",
  "崇拜献祭",
  "猎杀清除",
  "共存互利",
  "无视回避",
];
const STANCES = { 2: "同盟", 1: "友好", 0: "中立", "-1": "敌对", "-2": "死敌" };
const RANKS = ["见习", "成员", "骨干", "首领"];
const FACTION_DEFAULTS = [
  {
    id: "f_bureau",
    name: "异常收容局",
    kind: "官方机构",
    attitude: "收容封存",
    favored: "anomaly",
    power: 4,
    hue: 212,
    ideology: "把一切异常关进笼子，直到世界重新变得可以理解。",
  },
  {
    id: "f_star",
    name: "星辉学会",
    kind: "学派学院",
    attitude: "研究利用",
    favored: "magic",
    power: 4,
    hue: 268,
    ideology: "灵能是可以被写成公式的语言，谁掌握语法，谁就掌握世界。",
  },
  {
    id: "f_under",
    name: "无名网络",
    kind: "地下组织",
    attitude: "无视回避",
    favored: "psi",
    power: 2,
    hue: 150,
    ideology: "规则是给守规则的人写的。我们只做交易，不问来路。",
  },
  {
    id: "f_watch",
    name: "旧秩序守望会",
    kind: "官方机构",
    attitude: "猎杀清除",
    favored: "dominion",
    power: 3,
    hue: 42,
    ideology: "崩坏之前的秩序才是正统，其余的一切都是暂时的混乱。",
  },
  {
    id: "f_merc",
    name: "自由佣兵团",
    kind: "佣兵团",
    attitude: "共存互利",
    favored: "psi",
    power: 3,
    hue: 22,
    ideology: "异常也好，神迹也罢，只要付得起价钱，就有人肯去。",
  },
  {
    id: "f_border",
    name: "边境聚落联盟",
    kind: "聚落联盟",
    attitude: "共存互利",
    favored: "",
    power: 2,
    hue: 120,
    ideology: "守住自己的水井和粮仓，其余的世界与我们无关。",
  },
  {
    id: "f_cult",
    name: "空白之环",
    kind: "教团",
    attitude: "崇拜献祭",
    favored: "anomaly",
    power: 3,
    hue: 328,
    ideology: "一切终将回到空白。异常不是灾难，而是回家的路。",
  },
  {
    id: "f_obs",
    name: "观测者协会",
    kind: "研究会",
    attitude: "研究利用",
    favored: "dominion",
    power: 3,
    hue: 188,
    ideology: "只观测，不介入。被观测到的东西，才真正存在。",
  },
  {
    id: "f_hunt",
    name: "猎异者公会",
    kind: "公会",
    attitude: "猎杀清除",
    favored: "magic",
    power: 3,
    hue: 2,
    ideology: "每一个失控的异常背后，都有一张悬赏单。",
  },
];
const FREL_DEFAULT = [
  ["f_bureau", "f_hunt", 1],
  ["f_bureau", "f_cult", -2],
  ["f_bureau", "f_under", -1],
  ["f_bureau", "f_obs", 1],
  ["f_bureau", "f_watch", 1],
  ["f_star", "f_obs", 1],
  ["f_star", "f_cult", -1],
  ["f_star", "f_bureau", 0],
  ["f_under", "f_merc", 1],
  ["f_under", "f_cult", 1],
  ["f_watch", "f_under", -2],
  ["f_watch", "f_star", -1],
  ["f_hunt", "f_cult", -2],
  ["f_hunt", "f_merc", 1],
  ["f_merc", "f_border", 1],
  ["f_border", "f_bureau", -1],
].map(([a, b, v]) => ({ a, b, v }));
const FAC_PRE = [
  "银烬",
  "夜航",
  "白鸦",
  "深井",
  "断桥",
  "回声",
  "赤枝",
  "灰誓",
  "残星",
  "渡鸦",
];
const FAC_SUF = ["会", "团", "盟", "社", "教", "局", "司", "阁"];
const IDEOLOGIES = [
  "守住一座城，是我们唯一的理想。",
  "知识不该被谁独占，哪怕代价是所有人的安宁。",
  "力量属于能承担它的人，其余的人只需要服从。",
  "让每一个被遗忘的人被记住。",
  "在崩坏的世界里，先活下来的人才有资格谈理想。",
  "一切交易都有价码，一切誓言都有期限。",
];
const uid8 = () => Math.random().toString(36).slice(2, 8);
function newFaction() {
  const r = makeRng("fac|" + Math.random());
  return {
    id: "f_" + uid8(),
    name: r.pick(FAC_PRE) + r.pick(FAC_SUF),
    kind: r.pick(FACTION_KINDS),
    attitude: r.pick(ATTITUDES),
    favored: r.pick(["", ...SYS_IDS]),
    power: r.int(1, 5),
    hue: r.int(0, 359),
    ideology: r.pick(IDEOLOGIES),
    home: "",
  };
}
const facColor = (f, l = 58) => `hsl(${f.hue} 62% ${l}%)`;
function factionRel(frel) {
  const m = new Map();
  (frel || []).forEach((e) => {
    m.set(e.a < e.b ? e.a + "|" + e.b : e.b + "|" + e.a, e.v);
  });
  return (a, b) => m.get(a < b ? a + "|" + b : b + "|" + a) || 0;
}

const REL_KINDS = [
  { id: "kin", name: "亲人", v: 2 },
  { id: "friend", name: "挚友", v: 2 },
  { id: "lover", name: "恋人", v: 2 },
  { id: "mentor", name: "师徒", v: 1 },
  { id: "ally", name: "盟友", v: 1 },
  { id: "colleague", name: "同僚", v: 1 },
  { id: "acq", name: "相识", v: 0 },
  { id: "debt", name: "债务", v: -1 },
  { id: "rival", name: "竞争对手", v: -1 },
  { id: "nemesis", name: "宿敌", v: -2 },
  { id: "avenger", name: "仇人", v: -2 },
];
const REL_BY_ID = Object.fromEntries(REL_KINDS.map((k) => [k.id, k]));

function genRelations(chars, frel, existing = []) {
  const r = makeRng("rel|" + chars.map((c) => c.uid).join(","));
  const fv = factionRel(frel),
    out = [],
    seen = new Set(
      existing.map((e) => (e.a < e.b ? e.a + "|" + e.b : e.b + "|" + e.a)),
    );
  const add = (a, b, kind) => {
    const k = a.uid < b.uid ? a.uid + "|" + b.uid : b.uid + "|" + a.uid;
    if (a.uid === b.uid || seen.has(k)) return;
    seen.add(k);
    out.push({ a: a.uid, b: b.uid, kind });
  };
  for (let i = 0; i < chars.length; i++)
    for (let j = i + 1; j < chars.length; j++) {
      const A = chars[i],
        B = chars[j];
      if (A.factionId && A.factionId === B.factionId) {
        if (r.chance(0.45))
          add(A, B, r.pick(["colleague", "ally", "mentor", "friend"]));
      } else if (A.factionId && B.factionId) {
        const v = fv(A.factionId, B.factionId);
        if (v < 0 && r.chance(0.3))
          add(A, B, r.pick(["rival", "nemesis", "avenger"]));
        else if (v > 0 && r.chance(0.18)) add(A, B, "ally");
      } else if (r.chance(0.08)) add(A, B, r.pick(["acq", "debt", "friend"]));
    }
  for (let n = 0; n < Math.ceil(chars.length / 3); n++) {
    const A = r.pick(chars),
      B = r.pick(chars);
    add(A, B, r.pick(["kin", "lover", "friend", "debt", "nemesis"]));
  }
  return out;
}

/* ==========================================================================
   七、空间层：地图与地点
   ========================================================================== */
const LOC_TYPES = [
  {
    id: "city",
    name: "都会",
    glyph: "circle",
    off: { anomaly: -8, mind: 5, aether: 5 },
    desc: "秩序稳定、人口密集，异常被压低，交易与情报汇聚于此。",
    pre: ["灰港", "白塔", "镜湾", "长明", "霜桥", "南渡"],
    suf: ["市", "城", "镇"],
    w: () => 3,
  },
  {
    id: "shrine",
    name: "灵脉圣地",
    glyph: "hex",
    off: { aether: 35, mind: 10, anomaly: -5 },
    desc: "灵脉交汇之处，魔法在这里格外顺手，也格外危险。",
    pre: ["星泉", "月脉", "古松", "云心", "碧潭"],
    suf: ["圣地", "灵泉", "祭坛"],
    w: (d) => 1 + d.aether / 25,
  },
  {
    id: "rift",
    name: "裂隙区",
    glyph: "diamond",
    off: { anomaly: 40, space: 25, causality: 10, aether: 5 },
    desc: "现实在此开裂，异常以此为巢，空间也不再可靠。",
    pre: ["第七", "无名", "逆潮", "空白", "断线"],
    suf: ["裂隙", "断层", "伤口"],
    w: (d) => 1 + d.anomaly / 25,
  },
  {
    id: "chrono",
    name: "时间遗迹",
    glyph: "ring",
    off: { time: -25, causality: 35, space: 10 },
    desc: "时间在此打结，因果可以被改写，代价是自己的过去。",
    pre: ["回环", "倒悬", "残钟", "沙漏"],
    suf: ["遗迹", "钟塔", "回廊"],
    w: (d) => 0.5 + d.causality / 40 + Math.abs(d.time - 50) / 40,
  },
  {
    id: "float",
    name: "失重高地",
    glyph: "tri",
    off: { gravity: -30, aether: 10, space: 5 },
    desc: "重力稀薄，岩石与人一同漂浮，适合擅长机动的人。",
    pre: ["云脊", "浮光", "天梯", "风穹"],
    suf: ["高地", "浮岛", "崖台"],
    w: (d) => Math.max(0.3, 0.5 + (50 - d.gravity) / 25),
  },
  {
    id: "pit",
    name: "重压深坑",
    glyph: "itri",
    off: { gravity: 30, anomaly: 10 },
    desc: "重力沉重得让人喘不过气，深处埋着被压缩的东西。",
    pre: ["黑砧", "沉锚", "重渊", "铅井"],
    suf: ["深坑", "矿坑", "沉井"],
    w: (d) => Math.max(0.3, 0.5 + (d.gravity - 50) / 25),
  },
  {
    id: "dream",
    name: "梦渊",
    glyph: "oval",
    off: { mind: 40, space: 15, causality: 10 },
    desc: "意念在此成形。想到什么，就会遇见什么。",
    pre: ["长眠", "雾梦", "空梦", "倒影"],
    suf: ["渊", "回廊", "之湖"],
    w: (d) => 0.5 + d.mind / 30,
  },
  {
    id: "waste",
    name: "静默荒原",
    glyph: "cross",
    off: { aether: -30, anomaly: -20, mind: -15 },
    desc: "灵能与异常都被抽干的死地，魔法在这里几乎失效。",
    pre: ["寂灰", "静默", "无风", "白盐"],
    suf: ["荒原", "盐滩", "戈壁"],
    w: (d) => 1 + (100 - d.aether) / 60,
  },
  {
    id: "fort",
    name: "要塞",
    glyph: "square",
    off: { anomaly: -15, aether: -5, causality: -10 },
    desc: "经过加固的据点，规则稳固，异常难以渗入。",
    pre: ["铁誓", "守夜", "雄关", "北辰"],
    suf: ["要塞", "关隘", "堡"],
    w: () => 1.5,
  },
  {
    id: "forge",
    name: "熔炉",
    glyph: "oct",
    off: { entropy: 35, aether: 15, gravity: 5 },
    desc: "能量凭空涌现，热力学在这里只是建议。",
    pre: ["赤炉", "熔心", "火脉", "烬冠"],
    suf: ["熔炉", "工坊", "铸场"],
    w: (d) => 0.5 + d.entropy / 30,
  },
  {
    id: "port",
    name: "枢纽",
    glyph: "circle2",
    off: { space: 5 },
    desc: "道路与航线交汇之处，各路人马往来，消息灵通。",
    pre: ["潮汐", "远帆", "交汇", "十字"],
    suf: ["港", "渡口", "驿站"],
    w: () => 1.5,
  },
];
const LOC_BY_ID = Object.fromEntries(LOC_TYPES.map((t) => [t.id, t]));
const MAP_W = 800,
  MAP_H = 520;

function genLocName(r, type, taken) {
  for (let i = 0; i < 40; i++) {
    const n = r.pick(type.pre) + r.pick(type.suf);
    if (!taken.has(n)) return n;
  }
  return r.pick(type.pre) + r.pick(type.suf) + r.int(2, 9);
}
function genMap(world, seedStr, n = 9) {
  const r = makeRng("map|" + seedStr);
  const d = world.dials,
    pts = [];
  for (let t = 0; t < 4000 && pts.length < n; t++) {
    const x = r.range(7, 93),
      y = r.range(10, 90);
    if (
      pts.every(
        (p) =>
          Math.hypot(((p.x - x) * MAP_W) / 100, ((p.y - y) * MAP_H) / 100) >=
          128,
      )
    )
      pts.push({ x, y });
  }
  const wts = {};
  LOC_TYPES.forEach((t) => {
    wts[t.id] = t.w(d);
  });
  const taken = new Set(),
    locs = [];
  pts.forEach((p, i) => {
    const type = r.weighted(LOC_TYPES, (t) => wts[t.id]);
    wts[type.id] *= 0.4;
    const name = genLocName(r, type, taken);
    taken.add(name);
    locs.push({
      id: "L" + (i + 1) + uid8().slice(0, 2),
      name,
      type: type.id,
      x: +p.x.toFixed(1),
      y: +p.y.toFixed(1),
      off: { ...type.off },
      ctrl: "",
    });
  });
  const px = (a) => [(a.x * MAP_W) / 100, (a.y * MAP_H) / 100];
  const dist = (a, b) => {
    const [x1, y1] = px(a),
      [x2, y2] = px(b);
    return Math.hypot(x1 - x2, y1 - y2);
  };
  const routes = [],
    inT = new Set([0]);
  while (inT.size < locs.length) {
    let best = null;
    inT.forEach((i) =>
      locs.forEach((l, j) => {
        if (inT.has(j)) return;
        const dd = dist(locs[i], l);
        if (!best || dd < best[0]) best = [dd, i, j];
      }),
    );
    routes.push([locs[best[1]].id, locs[best[2]].id]);
    inT.add(best[2]);
  }
  const has = (a, b) =>
    routes.some(
      (e) => (e[0] === a && e[1] === b) || (e[0] === b && e[1] === a),
    );
  for (
    let extra = 0, tries = 0;
    extra < Math.ceil(locs.length / 3) && tries < 60;
    tries++
  ) {
    const i = r.int(0, locs.length - 1),
      near = locs
        .map((l, j) => [dist(locs[i], l), j])
        .filter(([, j]) => j !== i && !has(locs[i].id, locs[j].id))
        .sort((a, b) => a[0] - b[0])[0];
    if (near && near[0] < 300) {
      routes.push([locs[i].id, locs[near[1]].id]);
      extra++;
    }
  }
  return { locs, routes };
}
function assignHomes(factions, locs) {
  const r = makeRng("home|" + locs.map((l) => l.id).join(""));
  const order = locs.slice().sort(() => r.next() - 0.5);
  locs.forEach((l) => {
    l.ctrl = "";
  });
  factions.forEach((f, i) => {
    const l = order[i];
    f.home = l ? l.id : "";
    if (l) l.ctrl = f.id;
  });
}
function localWorld(world, loc) {
  const dials = {};
  DIALS.forEach((dl) => {
    dials[dl.id] = clamp(
      Math.round(world.dials[dl.id] + ((loc.off && loc.off[dl.id]) || 0)),
      0,
      100,
    );
  });
  return { name: `${loc.name}`, dials };
}

/* ==========================================================================
   八、群像生成：一键生成有势力、驻地与关系的角色
   ========================================================================== */
function genCast(n, factions, locs, tierBase = 3) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const fac = factions.length
      ? factions[Math.floor(Math.random() * factions.length)]
      : null;
    const ch = newCharacter({
      tier: clamp(tierBase + Math.floor(Math.random() * 3) - 1, 1, 9),
    });
    if (fac && fac.favored && Math.random() < 0.65) {
      ch.system = fac.favored;
      regen(ch, "abil");
    }
    ch.uid = ch.seed + "-" + uid8();
    if (fac) {
      ch.factionId = fac.id;
      ch.rank = RANKS[Math.floor(Math.random() * RANKS.length)];
    }
    const home = fac && locs.find((l) => l.id === fac.home);
    ch.locId =
      home && Math.random() < 0.7
        ? home.id
        : locs.length
          ? locs[Math.floor(Math.random() * locs.length)].id
          : "";
    out.push(ch);
  }
  return out;
}
/* ==========================================================================
   九、成长层：经验、晋升、能力进化、性格与痕迹
   ========================================================================== */
const xpNeed = (t) => 40 * t + 10 * t * t;
const EXP0 = () => ({ STR: 0, AGI: 0, INT: 0, WIL: 0, PER: 0, CHA: 0 });
const SYSTAT = { magic: "INT", anomaly: "PER", psi: "WIL", dominion: "CHA" };
const ATTR_NAME = Object.fromEntries(ATTRS.map((a) => [a.k, a.n]));
const condOf = (ch) => (ch.cond = ch.cond || { hp: 1, stb: 1, en: 1 });
const rpick = (R, arr) => arr[Math.floor(R() * arr.length)];
const signed = (n) => (n > 0 ? "+" : "") + n;
const pctTxt = (x) => signed(Math.round(x * 100)) + "%";
function addHist(ch, turn, x) {
  ch.hist = [{ t: turn, x }].concat(ch.hist || []).slice(0, 14);
}
function addMark(ch, x) {
  const m = (ch.marks || []).filter((y) => y !== x);
  m.unshift(x);
  ch.marks = m.slice(0, 5);
}
function driftPersona(ch, d) {
  Object.keys(d).forEach((k) => {
    ch.persona[k] = clamp((ch.persona[k] || 50) + d[k], 0, 100);
  });
}
function refreshRanks(ch) {
  ch.abilities.forEach((a) => {
    a.rank =
      a.slot === "core"
        ? ch.tier
        : a.slot === "combat"
          ? Math.max(1, ch.tier - 1)
          : Math.max(1, ch.tier - 2);
  });
}
const MARK_POOL = {
  battle: [
    "肩上留下一道深长的新伤",
    "左手指节在一场恶战中变形",
    "耳鸣从此没有停过",
    "背上多了一处灼烧的痕迹",
  ],
  anomaly: [
    "皮肤下多了一圈说不清的纹路",
    "影子的边缘开始模糊",
    "偶尔会看见并不存在的门",
  ],
  relic: [
    "掌心留下了一枚淡淡的印记",
    "梦里总有一个陌生的声音在念诵",
    "瞳孔深处多了一点不属于自己的光",
  ],
};

function evolveAbility(ch, oldTier, R) {
  const fresh = DOMAINS.filter(
    (d) => d.minTier > oldTier && d.minTier <= ch.tier,
  );
  if (!fresh.length || R() > 0.6) return "";
  const slot = R() < 0.5 ? "combat" : "utility",
    idx = slot === "combat" ? 1 : 2;
  const effs = EFFECTS.filter((e) =>
    slot === "combat"
      ? e.roles.includes("attack")
      : e.roles.includes("support") || e.roles.includes("utility"),
  );
  const old = ch.abilities[idx],
    nu = makeAbility(
      makeRng(`${ch.seed}|evo|${ch.tier}|${old.name}`),
      ch,
      slot,
      rpick(R, fresh),
      rpick(R, effs),
    );
  ch.abilities[idx] = nu;
  return `「${old.name}」进化为「${nu.name}」`;
}
function levelUp(ch, R) {
  const oldTier = ch.tier,
    before = { ...ch.attrs };
  ch.tier++;
  const arch = ARCH_BY_ID[ch.archetype],
    ec = ch.expc || EXP0(),
    tot = sum(ATTR_KEYS.map((k) => ec[k] || 0)) || 1,
    w = {};
  ATTR_KEYS.forEach((k) => {
    w[k] = arch.w[k] + 0.6 + (4 * (ec[k] || 0)) / tot;
  });
  const rr = makeRng(`${ch.seed}|lv|${ch.tier}|${Math.round(tot)}`);
  for (let pts = 6; pts > 0; ) {
    const cand = ATTR_KEYS.filter((k) => ch.attrs[k] < 20);
    if (!cand.length) break;
    const k = rr.weighted(cand, (x) => w[x]);
    ch.attrs[k]++;
    pts--;
  }
  ch.expc = EXP0();
  refreshRanks(ch);
  const gain = ATTR_KEYS.filter((k) => ch.attrs[k] > before[k])
    .map((k) => `${ATTR_NAME[k]} +${ch.attrs[k] - before[k]}`)
    .join("，");
  const evo = evolveAbility(ch, oldTier, R);
  return `${ch.name} 晋升为位阶 ${ch.tier}「${TIERS[ch.tier].n}」：${gain}${evo ? "。" + evo : ""}`;
}
/* 给经验；focus 是这次经历对各属性的“训练量”，晋升时据此分配成长点。返回晋升信息数组 */
function grantXp(ch, amount, focus, turn, R = Math.random) {
  if (ch.tier >= 9 || amount <= 0) return [];
  ch.xp = (ch.xp || 0) + Math.round(amount);
  ch.expc = ch.expc || EXP0();
  Object.keys(focus || {}).forEach((k) => {
    ch.expc[k] = (ch.expc[k] || 0) + focus[k];
  });
  const ups = [];
  while (ch.tier < 9 && ch.xp >= xpNeed(ch.tier)) {
    ch.xp -= xpNeed(ch.tier);
    const t = levelUp(ch, R);
    ups.push(t);
    addHist(ch, turn || 0, `晋升为位阶 ${ch.tier}`);
  }
  if (ch.tier >= 9) ch.xp = 0;
  return ups;
}

/* ==========================================================================
   十、战役层：行军、遭遇、战争与领土
   ========================================================================== */
const newCamp = () => ({
  turn: 0,
  wars: [],
  chron: [],
  hist: [],
  rep: {},
  party: { ids: [], loc: "", from: "", supply: 100, path: [], route: null },
  pending: null,
  quest: null,
  battles: [],
  last: null,
});
function chron(camp, k, x) {
  camp.chron.unshift({ t: camp.turn, k, x });
  if (camp.chron.length > 160) camp.chron.length = 160;
}
const adjOf = (routes) => {
  const m = {};
  routes.forEach(([a, b]) => {
    (m[a] = m[a] || []).push(b);
    (m[b] = m[b] || []).push(a);
  });
  return m;
};
function bfsPath(routes, from, to) {
  if (from === to) return [];
  const adj = adjOf(routes),
    prev = { [from]: null },
    q = [from];
  while (q.length) {
    const x = q.shift();
    for (const y of adj[x] || []) {
      if (y in prev) continue;
      prev[y] = x;
      if (y === to) {
        const p = [];
        let c = to;
        while (c !== from) {
          p.unshift(c);
          c = prev[c];
        }
        return p;
      }
      q.push(y);
    }
  }
  return null;
}
function edgeTurns(locs, a, b) {
  const A = locs.find((l) => l.id === a),
    B = locs.find((l) => l.id === b);
  if (!A || !B) return 1;
  return clamp(
    Math.round(
      Math.hypot(((A.x - B.x) * MAP_W) / 100, ((A.y - B.y) * MAP_H) / 100) /
        230,
    ),
    1,
    3,
  );
}
function frelSet(frel, a, b, v) {
  const i = frel.findIndex(
    (e) => (e.a === a && e.b === b) || (e.a === b && e.b === a),
  );
  if (v === 0) {
    if (i >= 0) frel.splice(i, 1);
  } else if (i >= 0) frel[i].v = v;
  else frel.push({ a, b, v });
}
const LEVEL_KINDS = {
  "-2": ["nemesis", "avenger"],
  "-1": ["rival", "debt"],
  0: ["acq"],
  1: ["colleague", "ally"],
  2: ["friend"],
};
function shiftRel(crel, a, b, d, R) {
  const i = crel.findIndex(
      (e) => (e.a === a && e.b === b) || (e.a === b && e.b === a),
    ),
    cur = i >= 0 ? REL_BY_ID[crel[i].kind] : null;
  if (cur && ["kin", "lover", "mentor"].includes(cur.id)) return null;
  const lv = clamp((cur ? cur.v : 0) + d, -2, 2);
  if (cur && cur.v === lv) return null;
  const kind = rpick(R, LEVEL_KINDS[lv]);
  if (i >= 0) crel[i].kind = kind;
  else crel.push({ a, b, kind });
  return kind;
}

const locOf = (ctx, id) => ctx.locs.find((l) => l.id === id);
const facOf = (ctx, id) => ctx.factions.find((f) => f.id === id);
const partyOf = (ctx, camp) =>
  camp.party.ids
    .map((id) => ctx.roster.find((c) => c.uid === id))
    .filter(Boolean);
const ownOf = (ctx, fid) => ctx.locs.filter((l) => l.ctrl === fid);
function midWorld(ctx, a, b) {
  const A = localWorld(ctx.world, a),
    B = b ? localWorld(ctx.world, b) : A,
    dials = {};
  DIALS.forEach((d) => {
    dials[d.id] = Math.round((A.dials[d.id] + B.dials[d.id]) / 2);
  });
  return { name: b ? `${a.name}至${b.name}` : a.name, dials };
}
const isSafe = (camp, loc) =>
  !!loc &&
  (["city", "fort", "port"].includes(loc.type) ||
    (loc.ctrl && (camp.rep[loc.ctrl] || 0) >= 1));

/* ---------- 战略层：战争、领土、外交 ---------- */
function facStrength(ctx, f, loc, asDef) {
  const m = worldMods(localWorld(ctx.world, loc)),
    env = f.favored ? Math.pow(clamp(m.sys[f.favored], 0.5, 1.9), 0.5) : 1;
  let s =
    (8 + f.power * 9 + ownOf(ctx, f.id).length * 2) *
    env *
    (1 - (f.strain || 0) / 220);
  if (asDef)
    s *=
      ({ fort: 1.35, city: 1.15, shrine: 1.1 }[loc.type] || 1) *
      (loc.id === f.home ? 1.2 : 1);
  return s;
}
function heroClash(ctx, camp, A, B, at, R, lines) {
  const busy = new Set(camp.party.ids);
  const pool = (f) =>
    ctx.roster.filter(
      (c) =>
        c.factionId === f.id &&
        !busy.has(c.uid) &&
        condOf(c).hp > 0.3 &&
        (c.locId === at.id || c.locId === (f.home || "")),
    );
  const ta = pool(A)
      .sort((x, y) => derive(y).score - derive(x).score)
      .slice(0, 2),
    tb = pool(B)
      .sort((x, y) => derive(y).score - derive(x).score)
      .slice(0, 2);
  if (!ta.length || !tb.length) return 0;
  const res = skirmish(ta, tb, localWorld(ctx.world, at), {
    useCond: true,
    rel: makeRel(ctx.crel),
    rng: R,
  });
  const upd = (team, ti) =>
    res.F.filter((f) => f.ti === ti).forEach((f) => {
      const c = team.find((x) => charKey(x) === f.key),
        cd = condOf(c);
      cd.hp = clamp(f.hp / f.hpMax, 0.05, 1);
      cd.stb = clamp(f.stb / f.stbMax, 0.05, 1);
      cd.en = clamp(f.en / f.enMax, 0.1, 1);
    });
  upd(ta, 0);
  upd(tb, 1);
  const win = res.winner === "A" ? ta : res.winner === "B" ? tb : [];
  [
    [ta, res.winner === "A"],
    [tb, res.winner === "B"],
  ].forEach(([team, won]) =>
    team.forEach((c) => {
      const xp = won ? 8 + 4 * c.tier : 4 + 2 * c.tier;
      grantXp(
        c,
        xp,
        { STR: 1, AGI: 1, [SYSTAT[c.system]]: 1 },
        camp.turn,
        R,
      ).forEach((u) => chron(camp, "grow", u));
      addHist(
        c,
        camp.turn,
        won ? `在「${at.name}」的对决中取胜` : `在「${at.name}」的对决中受挫`,
      );
    }),
  );
  if (win.length)
    lines.push(
      `${win.map((c) => c.name).join("、")} 在「${at.name}」的英雄对决中占了上风。`,
    );
  return res.winner === "A" ? 1 : res.winner === "B" ? -1 : 0;
}
function warTurn(ctx, camp, w, R) {
  const A = facOf(ctx, w.a),
    B = facOf(ctx, w.b),
    end = (why) => {
      camp.wars = camp.wars.filter((x) => x !== w);
      if (why) chron(camp, "war", why);
    };
  if (!A || !B) {
    end("");
    return;
  }
  const cease = () => {
    const v = factionRel(ctx.frel)(A.id, B.id);
    frelSet(ctx.frel, A.id, B.id, Math.min(0, v + 1));
    end(`${A.name}与${B.name}停战议和，关系缓和。`);
  };
  if (!ownOf(ctx, A.id).length || !ownOf(ctx, B.id).length) {
    end(
      `${!ownOf(ctx, A.id).length ? A.name : B.name}已无据点，战争告一段落。`,
    );
    return;
  }
  const edges = ctx.routes
    .map(([x, y]) => [locOf(ctx, x), locOf(ctx, y)])
    .filter(
      ([x, y]) =>
        x &&
        y &&
        ((x.ctrl === A.id && y.ctrl === B.id) ||
          (x.ctrl === B.id && y.ctrl === A.id)),
    );
  const tired =
    Math.max(A.strain || 0, B.strain || 0) >= 65 || camp.turn - w.since >= 9;
  if (!edges.length) {
    if (R() < 0.35) cease();
    return;
  }
  const [e0, e1] = rpick(R, edges),
    la = e0.ctrl === A.id ? e0 : e1,
    lb = la === e0 ? e1 : e0;
  const pa = A.power * (1 - (A.strain || 0) / 200),
    pb = B.power * (1 - (B.strain || 0) / 200);
  const aAtk = R() < pa / (pa + pb),
    atk = aAtk ? A : B,
    def = aAtk ? B : A,
    from = aAtk ? la : lb,
    at = aAtk ? lb : la;
  let sa = facStrength(ctx, atk, at, false),
    sd = facStrength(ctx, def, at, true);
  const lines = [],
    fv = factionRel(ctx.frel);
  [
    [atk, "a"],
    [def, "d"],
  ].forEach(([f, side]) =>
    ctx.factions.forEach((g) => {
      if (
        g === atk ||
        g === def ||
        fv(f.id, g.id) < 2 ||
        fv(atk.id, g.id) * fv(def.id, g.id) === 1
      )
        return;
      if (ownOf(ctx, g.id).length && R() < 0.3) {
        const add = 0.3 * facStrength(ctx, g, at, false);
        if (side === "a") sa += add;
        else sd += add;
        lines.push(`${g.name}派出援军支援${f.name}。`);
      }
    }),
  );
  const hc = heroClash(ctx, camp, atk, def, at, R, lines);
  if (hc > 0) sa *= 1.3;
  else if (hc < 0) sd *= 1.3;
  const win = sa * (0.7 + 0.6 * R()) > sd * (0.7 + 0.6 * R());
  const tName = LOC_BY_ID[at.type].name;
  if (win) {
    at.ctrl = atk.id;
    if (def.home === at.id) def.home = (ownOf(ctx, def.id)[0] || {}).id || "";
    atk.strain = (atk.strain || 0) + 6;
    def.strain = (def.strain || 0) + 10;
    chron(
      camp,
      "war",
      `${atk.name}攻陷了${tName}「${at.name}」，${def.name}失去一处据点。${lines.join("")}`,
    );
  } else {
    atk.strain = (atk.strain || 0) + 12;
    def.strain = (def.strain || 0) + 4;
    chron(
      camp,
      "war",
      `${def.name}在「${at.name}」击退了${atk.name}的进攻。${lines.join("")}`,
    );
  }
  camp.battles.push({ loc: at.id, a: atk.id, b: def.id, from: from.id, win });
  if (tired && R() < 0.3) cease();
}
function advanceWorld(ctx, camp, R = ctx.R || Math.random) {
  camp.turn++;
  camp.battles = [];
  const fv = factionRel(ctx.frel),
    adj = adjOf(ctx.routes),
    n = ctx.factions.length;
  const contact = (a, b) =>
    ctx.routes.some(([x, y]) => {
      const lx = locOf(ctx, x),
        ly = locOf(ctx, y);
      return (
        lx &&
        ly &&
        ((lx.ctrl === a && ly.ctrl === b) || (lx.ctrl === b && ly.ctrl === a))
      );
    });
  /* 宣战 */
  for (let i = 0; i < n && camp.wars.length < 3; i++)
    for (let j = i + 1; j < n && camp.wars.length < 3; j++) {
      const A = ctx.factions[i],
        B = ctx.factions[j],
        v = fv(A.id, B.id);
      if (
        v > -1 ||
        camp.wars.some(
          (w) =>
            (w.a === A.id && w.b === B.id) || (w.a === B.id && w.b === A.id),
        )
      )
        continue;
      if (!ownOf(ctx, A.id).length || !ownOf(ctx, B.id).length) continue;
      const p =
        (v <= -2 ? 0.16 : 0.05) *
        (contact(A.id, B.id) ? 2.2 : 0.3) *
        (1 - Math.min(0.7, ((A.strain || 0) + (B.strain || 0)) / 200));
      if (R() < p) {
        camp.wars.push({
          id: "w" + uid8(),
          a: A.id,
          b: B.id,
          since: camp.turn,
        });
        chron(camp, "war", `${A.name}与${B.name}爆发战争。`);
      }
    }
  camp.wars.slice().forEach((w) => warTurn(ctx, camp, w, R));
  /* 外交漂移 */
  if (n >= 2 && R() < 0.28) {
    const i = Math.floor(R() * n),
      j = (i + 1 + Math.floor(R() * (n - 1))) % n,
      A = ctx.factions[i],
      B = ctx.factions[j],
      v = fv(A.id, B.id),
      r = R();
    let nv = v,
      txt = "";
    if (v === 0) {
      if (r < 0.5) {
        nv = 1;
        txt = `${A.name}与${B.name}互换使节，关系转暖。`;
      } else if (contact(A.id, B.id)) {
        nv = -1;
        txt = `${A.name}与${B.name}在边境爆发摩擦，关系恶化。`;
      }
    } else if (v === 1) {
      if (r < 0.3) {
        nv = 2;
        txt = `${A.name}与${B.name}缔结同盟。`;
      } else if (r < 0.5) {
        nv = 0;
        txt = `${A.name}与${B.name}渐行渐远。`;
      }
    } else if (v === 2 && r < 0.15) {
      nv = 1;
      txt = `${A.name}背弃了与${B.name}的盟约。`;
    } else if (v === -1) {
      if (r < 0.3) {
        nv = 0;
        txt = `${A.name}与${B.name}达成谅解，紧张缓和。`;
      } else if (r < 0.45) {
        nv = -2;
        txt = `${A.name}与${B.name}的冲突升级为世仇。`;
      }
    } else if (v === -2 && r < 0.15) {
      nv = -1;
      txt = `${A.name}与${B.name}的世仇出现松动。`;
    }
    if (nv !== v && txt) {
      frelSet(ctx.frel, A.id, B.id, nv);
      chron(camp, "dip", txt);
    }
  }
  /* 势力盛衰与扩张 */
  ctx.factions.forEach((f) => {
    const t = ownOf(ctx, f.id).length,
      inWar = camp.wars.some((w) => w.a === f.id || w.b === f.id);
    if (!inWar) f.strain = Math.max(0, (f.strain || 0) - 3);
    if (t >= 4 && (f.strain || 0) < 25 && f.power < 5 && R() < 0.07) {
      f.power++;
      chron(camp, "war", `${f.name}势力壮大，升为 ${f.power} 级。`);
    }
    if (t === 0 && f.power > 1 && R() < 0.15) {
      f.power--;
      chron(camp, "war", `${f.name}失去全部据点，日渐衰落。`);
    }
    if (t > 0 && f.power >= 2 && (f.strain || 0) < 50 && R() < 0.12) {
      const free = ctx.locs.filter(
        (l) =>
          !l.ctrl &&
          (adj[l.id] || []).some((k) => (locOf(ctx, k) || {}).ctrl === f.id),
      );
      if (free.length) {
        const l = rpick(R, free);
        l.ctrl = f.id;
        chron(camp, "war", `${f.name}在「${l.name}」设立了据点。`);
      }
    } else if (t === 0 && R() < 0.12) {
      const free = ctx.locs.filter((l) => !l.ctrl);
      if (free.length) {
        const l = rpick(R, free);
        l.ctrl = f.id;
        f.home = l.id;
        chron(camp, "war", `${f.name}重整旗鼓，占据了「${l.name}」。`);
      }
    }
    const mine = ownOf(ctx, f.id);
    if (!mine.some((l) => l.id === f.home)) f.home = mine[0] ? mine[0].id : "";
  });
  /* 未参与行动的角色逐渐恢复 */
  const busy = new Set(camp.party.ids);
  ctx.roster.forEach((c) => {
    if (!busy.has(c.uid) && c.cond) {
      const cd = c.cond;
      cd.hp = Math.min(1, cd.hp + 0.2);
      cd.stb = Math.min(1, cd.stb + 0.15);
      cd.en = Math.min(1, cd.en + 0.3);
    }
  });
  const cnt = { "": 0 };
  ctx.factions.forEach((f) => {
    cnt[f.id] = 0;
  });
  ctx.locs.forEach((l) => {
    cnt[cnt[l.ctrl] !== undefined ? l.ctrl : ""] =
      (cnt[cnt[l.ctrl] !== undefined ? l.ctrl : ""] || 0) + 1;
  });
  camp.hist.push({ t: camp.turn, c: cnt });
  if (camp.hist.length > 80) camp.hist.shift();
  /* 委托期限 */
  if (camp.quest && camp.turn > camp.quest.deadline) {
    const f = facOf(ctx, camp.quest.fid);
    if (f) camp.rep[f.id] = clamp((camp.rep[f.id] || 0) - 1, -3, 3);
    chron(
      camp,
      "march",
      `委托「${camp.quest.title}」已过期${f ? `，${f.name}对你们的评价下降` : ""}。`,
    );
    camp.quest = null;
  }
}

/* ---------- 远征：行军、补给、遭遇 ---------- */
const BEAST_PRE = [
    "裂隙",
    "逆相",
    "灰烬",
    "回响",
    "断线",
    "蚀刻",
    "白噪",
    "沉眠",
  ],
  BEAST_SUF = ["猎犬", "爬行者", "蜃影", "啄食者", "傀儡", "守门兽"];
function genEnemies(R, kind, n, tier, fac) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const o = { tier: clamp(tier + Math.floor(R() * 3) - 1, 1, 9) };
    if (kind === "beast") {
      o.system = rpick(R, ["anomaly", "psi", "anomaly"]);
      o.origin = rpick(R, ["beast", "host", "warped", "voidborn"]);
    } else if (kind === "raider")
      o.origin = rpick(R, ["human", "beast", "mimic"]);
    else if (fac && fac.favored) o.system = fac.favored;
    const ch = newCharacter(o);
    ch.name =
      kind === "beast"
        ? rpick(R, BEAST_PRE) + rpick(R, BEAST_SUF)
        : kind === "raider"
          ? rpick(R, ["劫掠者", "流寇", "拾荒客", "逃兵"]) + (i + 1)
          : `${fac ? fac.name : "守军"}${rpick(R, ["哨兵", "斥候", "执行官", "卫士"])}`;
    ch.factionId = fac ? fac.id : "";
    delete ch.uid;
    out.push(ch);
  }
  return out;
}
function partyCheck(mem, key, dc, R) {
  const v = mem
    .filter((c) => condOf(c).hp > 0.05)
    .map((c) => derive(c).a[key])
    .sort((a, b) => b - a);
  if (!v.length) return { ok: false, score: 0, p: 0 };
  const score = v[0] + 0.25 * (v[1] || 0),
    p = clamp(0.5 + (score - dc) * 0.05, 0.08, 0.95);
  return { ok: R() < p, score: Math.round(score), p };
}
function partyRetreat(ctx, camp, lines) {
  const P = camp.party;
  P.supply = Math.max(0, P.supply - 20);
  if (P.from && locOf(ctx, P.from)) P.loc = P.from;
  P.route = null;
  P.path = [];
  partyOf(ctx, camp).forEach((c) => {
    const cd = condOf(c);
    cd.hp = Math.max(cd.hp, 0.15);
    cd.stb = Math.max(cd.stb, 0.2);
    addHist(c, camp.turn, "在一场败仗后狼狈撤退");
  });
  lines.push(
    `队伍溃退，回到「${(locOf(ctx, P.loc) || {}).name || "原地"}」，补给损失 20。`,
  );
}
function grantParty(ctx, camp, xp, focus, lines, R) {
  const mem = partyOf(ctx, camp);
  mem.forEach((c) => {
    grantXp(
      c,
      xp,
      {
        ...focus,
        [SYSTAT[c.system]]: ((focus && focus[SYSTAT[c.system]]) || 0) + 1,
      },
      camp.turn,
      R,
    ).forEach((u) => {
      lines.push(u);
      chron(camp, "grow", u);
    });
  });
  if (xp > 0) lines.push(`全队获得经验 ${Math.round(xp)}。`);
}
function partyBattle(ctx, camp, sc, b, lines, R) {
  const P = camp.party,
    mem = partyOf(ctx, camp).filter((c) => condOf(c).hp > 0.05),
    loc = locOf(ctx, P.loc);
  const tierAvg = mem.length ? sum(mem.map((c) => c.tier)) / mem.length : 1,
    fac = b.fid ? facOf(ctx, b.fid) : null;
  const foes = genEnemies(
    R,
    b.kind,
    b.n || Math.max(2, mem.length),
    clamp(Math.round(tierAvg) + (b.tier || 0), 1, 9),
    fac,
  );
  const res = skirmish(mem, foes, sc.mid || localWorld(ctx.world, loc), {
    log: true,
    useCond: true,
    rel: makeRel(ctx.crel),
    rng: R,
  });
  res.F.filter((f) => f.ti === 0).forEach((f) => {
    const c = mem.find((x) => charKey(x) === f.key),
      cd = condOf(c);
    cd.hp = clamp(f.hp / f.hpMax, 0.03, 1);
    cd.stb = clamp(f.stb / f.stbMax, 0.03, 1);
    cd.en = clamp(f.en / f.enMax, 0.05, 1);
  });
  const win = res.winner === "A";
  camp.last = camp.last || {};
  camp.last.battle = {
    win,
    draw: res.winner === "draw",
    rounds: res.rounds,
    foes: foes.map((c) => c.name),
    log: res.log.slice(0, 90),
  };
  lines.push(
    `遭遇战：${foes.map((c) => c.name).join("、")}。${win ? "你们取得了胜利" : res.winner === "draw" ? "双方脱离接触" : "你们败下阵来"}（${res.rounds} 回合）。`,
  );
  if (win) {
    const eT = sum(foes.map((c) => c.tier)) / foes.length;
    grantParty(
      ctx,
      camp,
      8 + 5 * eT + 3 * foes.length,
      { STR: 1, AGI: 1 },
      lines,
      R,
    );
    if (R() < 0.35) {
      const c = rpick(R, mem);
      const m = rpick(R, MARK_POOL.battle);
      addMark(c, m);
      lines.push(`${c.name}：${m}。`);
    }
    mem.forEach((c) =>
      addHist(c, camp.turn, `击败了${foes[0].name}等 ${foes.length} 个敌人`),
    );
    if (b.takeSide && loc) {
      const L = locOf(ctx, b.takeSide.loc);
      if (L) {
        L.ctrl = b.takeSide.win;
        chron(
          camp,
          "war",
          `远征队出手干预，${(facOf(ctx, b.takeSide.win) || {}).name}夺得了「${L.name}」。`,
        );
      }
    }
  } else partyRetreat(ctx, camp, lines);
  return win;
}
function applyOutcome(ctx, camp, sc, out, lines, R) {
  const P = camp.party,
    mem = partyOf(ctx, camp);
  if (out.text) lines.push(out.text);
  if (out.supply) {
    P.supply = clamp(P.supply + out.supply, 0, 100);
    lines.push(`补给 ${signed(out.supply)}`);
  }
  mem.forEach((c) => {
    const cd = condOf(c);
    if (out.hp) cd.hp = clamp(cd.hp + out.hp, 0.03, 1);
    if (out.stb) cd.stb = clamp(cd.stb + out.stb, 0.03, 1);
    if (out.en) cd.en = clamp(cd.en + out.en, 0.05, 1);
  });
  if (out.hp || out.stb)
    lines.push(
      "全队状态：" +
        [
          out.hp ? `生命 ${pctTxt(out.hp)}` : "",
          out.stb ? `稳定度 ${pctTxt(out.stb)}` : "",
        ]
          .filter(Boolean)
          .join("，"),
    );
  if (out.taint) {
    mem.forEach((c) => {
      c.taint = clamp((c.taint || 0) + out.taint, 0, 60);
    });
    lines.push(`异常侵蚀加深（+${out.taint}）。`);
  }
  if (out.mark && mem.length) {
    const c = rpick(R, mem);
    addMark(c, out.mark);
    addHist(c, camp.turn, out.mark);
    lines.push(`${c.name}：${out.mark}。`);
  }
  if (out.persona) {
    mem.forEach((c) => driftPersona(c, out.persona));
    lines.push("这段经历让队员的性格发生了些许变化。");
  }
  if (out.rep)
    Object.keys(out.rep).forEach((fid) => {
      const f = facOf(ctx, fid);
      if (!f) return;
      camp.rep[fid] = clamp((camp.rep[fid] || 0) + out.rep[fid], -3, 3);
      lines.push(`与「${f.name}」的声望 ${signed(out.rep[fid])}`);
    });
  if (out.rel) {
    const k = shiftRel(ctx.crel, out.rel.a, out.rel.b, out.rel.d, R);
    const A = ctx.roster.find((c) => c.uid === out.rel.a),
      B = ctx.roster.find((c) => c.uid === out.rel.b);
    if (k && A && B)
      lines.push(`${A.name}与${B.name}的关系变为「${REL_BY_ID[k].name}」。`);
  }
  if (out.newQuest) {
    camp.quest = out.newQuest;
    chron(camp, "march", `接下委托「${out.newQuest.title}」。`);
  }
  if (out.dropQuest) {
    camp.quest = null;
  }
  if (out.xp) grantParty(ctx, camp, out.xp, out.focus || {}, lines, R);
  if (out.hist) mem.forEach((c) => addHist(c, camp.turn, out.hist));
  if (out.battle) {
    const win = partyBattle(ctx, camp, sc, out.battle, lines, R);
    if (win && out.battle.onWin)
      applyOutcome(ctx, camp, sc, out.battle.onWin, lines, R);
    if (win && out.battle.quest && camp.quest) {
      const q = camp.quest;
      camp.quest = null;
      questReward(ctx, camp, q, lines, R);
    }
  }
}
function questReward(ctx, camp, q, lines, R) {
  const f = facOf(ctx, q.fid);
  lines.push(`委托「${q.title}」完成！`);
  if (f) {
    camp.rep[f.id] = clamp((camp.rep[f.id] || 0) + 1, -3, 3);
    lines.push(`与「${f.name}」的声望 +1`);
  }
  camp.party.supply = clamp(camp.party.supply + (q.reward.supply || 0), 0, 100);
  grantParty(ctx, camp, q.reward.xp, {}, lines, R);
  chron(camp, "march", `完成了${f ? f.name : ""}的委托「${q.title}」。`);
}

/* 遭遇模板：build 返回可序列化的场景，选项里只有数据，没有函数 */
function encCtx(ctx, camp, lw, loc, to) {
  const mem = partyOf(ctx, camp),
    m = worldMods(lw),
    tierAvg = mem.length ? sum(mem.map((c) => c.tier)) / mem.length : 1,
    rel = makeRel(ctx.crel);
  const ctrl = loc && loc.ctrl ? facOf(ctx, loc.ctrl) : null;
  const best =
    SYS_IDS.filter((k) => mem.some((c) => c.system === k)).sort(
      (a, b) => m.sys[b] - m.sys[a],
    )[0] || "psi";
  let neg = null,
    pos = null;
  for (let i = 0; i < mem.length; i++)
    for (let j = i + 1; j < mem.length; j++) {
      const v = rel(mem[i].uid, mem[j].uid);
      if (v < 0 && (!neg || v < neg.v)) neg = { a: mem[i], b: mem[j], v };
      if (v > 0 && (!pos || v > pos.v)) pos = { a: mem[i], b: mem[j], v };
    }
  return {
    ctx,
    camp,
    mem,
    tierAvg,
    idx: m.index,
    m,
    lw,
    loc,
    to,
    place: (to || loc || {}).name || "这里",
    phen: PHENOMENA.filter((p) => p.on(lw.dials)),
    bestSys: { sys: best, mod: m.sys[best] },
    ctrl,
    rep: ctrl ? camp.rep[ctrl.id] || 0 : 0,
    war: camp.wars.length > 0,
    neg,
    pos,
    mid: lw,
  };
}
const dcOf = (e, add = 0) => Math.round(8 + 2 * e.tierAvg + e.idx / 14 + add);
const ENC = [
  {
    id: "phenomenon",
    w: (e) => (e.phen.length ? 2 + e.phen.length : 0),
    build(e, R) {
      const p = rpick(R, e.phen),
        s = e.bestSys,
        stat = SYSTAT[s.sys];
      return {
        id: "phenomenon",
        title: p.name,
        text: p.ev.replace("{place}", e.place),
        opts: [
          {
            label: "谨慎观察",
            hint: "感知检定",
            check: { attr: "PER", dc: dcOf(e) },
            ok: {
              text: "你们记录下了它的规律，绕开了最危险的部分。",
              xp: 14,
              focus: { PER: 2 },
            },
            bad: { text: "还没看明白，它就先影响了你们。", stb: -0.08 },
          },
          {
            label: "强行穿越",
            hint: "意志检定",
            check: { attr: "WIL", dc: dcOf(e, 2) },
            ok: {
              text: "硬顶着穿了过去，比预想的顺利。",
              xp: 9,
              focus: { WIL: 2 },
            },
            bad: { text: "穿越途中被狠狠撞了一下。", hp: -0.1, stb: -0.1 },
          },
          {
            label: `借势（${SYSTEMS[s.sys].name}）`,
            hint: `${ATTR_NAME[stat]}检定，此地效率 ×${s.mod.toFixed(2)}`,
            check: {
              attr: stat,
              dc: dcOf(e, s.mod >= 1.3 ? -3 : s.mod < 0.9 ? 3 : 0),
            },
            ok: {
              text: "你们顺着它的势头发力，收获不小。",
              xp: 22,
              focus: { [stat]: 2 },
              supply: 8,
            },
            bad: {
              text: "力量被它反过来牵引，走偏了。",
              stb: -0.14,
              taint: s.sys === "anomaly" ? 3 : 0,
            },
          },
        ],
      };
    },
  },
  {
    id: "patrol",
    w: (e) => (e.ctrl ? (e.rep >= 1 ? 0.8 : 2.5) : 0),
    build(e, R) {
      const f = e.ctrl,
        opts = [];
      if (e.rep >= 1 || e.mem.some((c) => c.factionId === f.id))
        opts.push({
          label: "出示通行凭证",
          hint: `声望 ${signed(e.rep)}或成员隶属该势力`,
          ok: {
            text: `巡逻队认出了你们，客气地放行。`,
            xp: 6,
            rep: { [f.id]: 0 },
          },
        });
      opts.push({
        label: "交涉",
        hint: "魅力检定",
        check: { attr: "CHA", dc: dcOf(e, e.rep * -1.5) },
        ok: {
          text: "几句话之后，对方让开了路。",
          xp: 10,
          focus: { CHA: 2 },
          rep: { [f.id]: 1 },
        },
        bad: {
          text: "交涉不欢而散，他们扣下了一部分补给。",
          supply: -15,
          rep: { [f.id]: -1 },
        },
      });
      opts.push({
        label: "潜行绕开",
        hint: "敏捷检定",
        check: { attr: "AGI", dc: dcOf(e, 1) },
        ok: {
          text: "你们从巡逻线的缝隙里溜了过去。",
          xp: 11,
          focus: { AGI: 2 },
        },
        bad: {
          text: "被发现了！对方拔出武器。",
          battle: { kind: "patrol", fid: f.id, tier: 0 },
          rep: { [f.id]: -1 },
        },
      });
      opts.push({
        label: "强行突破",
        hint: "战斗",
        ok: {
          text: "你们决定硬闯。",
          battle: { kind: "patrol", fid: f.id, tier: 0 },
          rep: { [f.id]: -1 },
        },
      });
      return {
        id: "patrol",
        title: `${f.name}的巡逻队`,
        text: `「${e.place}」一带由${f.name}控制。一队巡逻员拦住了去路，要求盘查。`,
        opts,
      };
    },
  },
  {
    id: "beast",
    w: (e) =>
      2 +
      (["rift", "dream", "pit", "waste", "chrono", "float"].includes(
        (e.loc || {}).type,
      )
        ? 2
        : 0),
    build(e, R) {
      return {
        id: "beast",
        title: "异常生物",
        text: `${e.place}附近的阴影里，有什么东西在移动。它们的轮廓不太像这个世界里应有的样子。`,
        opts: [
          {
            label: "迎战",
            hint: "战斗",
            ok: { text: "你们摆开阵势。", battle: { kind: "beast", tier: 0 } },
          },
          {
            label: "引开它们",
            hint: "敏捷检定",
            check: { attr: "AGI", dc: dcOf(e) },
            ok: {
              text: "你们把它们引向了别处，悄悄通过。",
              xp: 9,
              focus: { AGI: 2 },
            },
            bad: {
              text: "引诱失败，它们扑了上来。",
              battle: { kind: "beast", tier: 0 },
            },
          },
          {
            label: "绕路撤退",
            hint: "意志检定",
            check: { attr: "WIL", dc: dcOf(e, -1) },
            ok: { text: "你们稳住心神，无声地退了出去。", supply: -6 },
            bad: { text: "撤退途中仍被追了一段。", hp: -0.08, supply: -6 },
          },
        ],
      };
    },
  },
  {
    id: "caravan",
    w: (e) =>
      ["city", "port", "fort"].includes((e.loc || {}).type) || e.ctrl
        ? 1.5
        : 0.6,
    build(e, R) {
      const f = e.ctrl;
      return {
        id: "caravan",
        title: "过路商队",
        text: "一支商队与你们在路上相遇，车上装着各色货物，领队打量着你们的装备。",
        opts: [
          {
            label: "做一笔交易",
            hint: "魅力检定",
            check: { attr: "CHA", dc: dcOf(e, -2) },
            ok: {
              text: "你们谈成了一笔划算的买卖。",
              supply: 25,
              xp: 6,
              focus: { CHA: 1 },
            },
            bad: { text: "被对方压了价，赔了些补给。", supply: -10 },
          },
          {
            label: "替他们护送一程",
            hint: "花费补给 6，换取经验与声望",
            ok: {
              text: "你们陪商队走了一段，换来了些许谢礼与口碑。",
              supply: -6,
              xp: 14,
              focus: { STR: 1, PER: 1 },
              rep: f ? { [f.id]: 1 } : {},
              persona: { A: 1 },
            },
          },
          {
            label: "各走各路",
            hint: "什么也不发生",
            ok: { text: "双方点头示意，擦肩而过。" },
          },
        ],
      };
    },
  },
  {
    id: "ruin",
    w: (e) =>
      ["chrono", "rift", "shrine", "dream", "forge"].includes(
        (e.loc || {}).type,
      )
        ? 2.2
        : 0.5,
    build(e, R) {
      return {
        id: "ruin",
        title: "残破的遗迹",
        text: `你们在「${e.place}」附近发现了一处半埋的遗迹，石壁上的刻痕似乎在缓慢变化。`,
        opts: [
          {
            label: "仔细探索",
            hint: "智识检定",
            check: { attr: "INT", dc: dcOf(e, 1) },
            ok: {
              text: "你们读懂了一部分刻痕，带走了有价值的东西。",
              xp: 26,
              focus: { INT: 3 },
              mark: rpick(R, MARK_POOL.relic),
              hist: "在遗迹中破译了古老的刻痕",
            },
            bad: { text: "刻痕反过来读取了你们的记忆。", stb: -0.12, taint: 2 },
          },
          {
            label: "强行挖掘",
            hint: "体魄检定",
            check: { attr: "STR", dc: dcOf(e) },
            ok: {
              text: "你们挖出了一些可用的物资。",
              supply: 30,
              xp: 8,
              focus: { STR: 2 },
            },
            bad: { text: "塌方了。", hp: -0.12 },
          },
          {
            label: "不去打扰",
            hint: "谨慎为上",
            ok: { text: "有些东西最好留在原地。", persona: { C: 1 } },
          },
        ],
      };
    },
  },
  {
    id: "refugees",
    w: (e) => (e.war ? 1.8 : 0.4),
    build(e, R) {
      const f = e.ctrl;
      return {
        id: "refugees",
        title: "逃难的人群",
        text: "一群扶老携幼的难民拦下了你们。他们说，前面的村子被战火吞了。",
        opts: [
          {
            label: "分出补给援助",
            hint: "花费补给 15",
            ok: {
              text: "你们把能分的都分了出去。",
              supply: -15,
              xp: 16,
              focus: { CHA: 1, WIL: 1 },
              persona: { A: 2 },
              rep: f ? { [f.id]: 1 } : {},
              hist: "在战乱中帮助了逃难的人",
            },
          },
          {
            label: "征用他们的物资",
            hint: "获得补给，但……",
            ok: {
              text: "你们拿走了他们仅剩的一点东西。",
              supply: 20,
              persona: { A: -3, N: 1 },
              hist: "在战乱中抢了难民的口粮",
            },
          },
          {
            label: "视而不见",
            hint: "继续赶路",
            ok: { text: "你们没有停下。" },
          },
        ],
      };
    },
  },
  {
    id: "quarrel",
    w: (e) => (e.neg ? 2.5 : 0),
    build(e, R) {
      const { a, b } = e.neg;
      return {
        id: "quarrel",
        title: "队内争执",
        text: `${a.name}与${b.name}的旧怨在疲惫中被点燃，两人在营火边争执起来，其他人不知该不该插手。`,
        opts: [
          {
            label: "出面调解",
            hint: "魅力检定",
            check: { attr: "CHA", dc: dcOf(e) },
            ok: {
              text: "几句话把火压了下去，两人各退一步。",
              xp: 10,
              focus: { CHA: 2 },
              rel: { a: a.uid, b: b.uid, d: 1 },
            },
            bad: {
              text: "调解不成，反而让局面更僵。",
              rel: { a: a.uid, b: b.uid, d: -1 },
              stb: -0.05,
            },
          },
          {
            label: "强硬压制",
            hint: "意志检定",
            check: { attr: "WIL", dc: dcOf(e, 1) },
            ok: {
              text: "一声厉喝之后，营地重新安静下来。",
              xp: 6,
              focus: { WIL: 2 },
            },
            bad: {
              text: "压制激起了更多不满。",
              stb: -0.07,
              rel: { a: a.uid, b: b.uid, d: -1 },
            },
          },
          {
            label: "任其发展",
            hint: "两人自己解决",
            ok: { text: "直到天亮，气氛都很尴尬。", stb: -0.04 },
          },
        ],
      };
    },
  },
  {
    id: "bond",
    w: (e) => (e.pos ? 1.2 : 0),
    build(e, R) {
      const { a, b } = e.pos;
      return {
        id: "bond",
        title: "守夜之谈",
        text: `夜深了，${a.name}与${b.name}轮流守夜。篝火噼啪作响，他们聊起了很久以前的事。`,
        opts: [
          {
            label: "促膝长谈",
            hint: "恢复稳定度，关系可能加深",
            ok: {
              text: "有些话说出来之后，心里轻了许多。",
              stb: 0.12,
              xp: 6,
              focus: { CHA: 1 },
              rel: R() < 0.3 ? { a: a.uid, b: b.uid, d: 1 } : null,
            },
          },
          {
            label: "各自沉默",
            hint: "什么也没发生",
            ok: { text: "火光映着两张沉默的脸。" },
          },
        ],
      };
    },
  },
  {
    id: "envoy",
    w: (e) => (e.camp.quest || !e.ctx.factions.length ? 0 : 1.4),
    build(e, R) {
      const { ctx, camp } = e,
        f = rpick(
          R,
          ctx.factions
            .filter((x) => (camp.rep[x.id] || 0) >= -1)
            .concat(ctx.factions.slice(0, 1)),
        ),
        from = camp.party.loc;
      const targets = ctx.locs.filter(
        (l) =>
          l.id !== from && (bfsPath(ctx.routes, from, l.id) || []).length <= 3,
      );
      if (!targets.length) return null;
      const t = rpick(R, targets),
        kind = R() < 0.5 ? "scout" : "clear",
        reward = { xp: 24 + 8 * Math.round(e.tierAvg), supply: 20 };
      const q = {
        fid: f.id,
        kind,
        target: t.id,
        title:
          kind === "scout"
            ? `侦察「${t.name}」`
            : `讨伐「${t.name}」的异常生物`,
        deadline: camp.turn + 10,
        reward,
      };
      return {
        id: "envoy",
        title: `${f.name}的使者`,
        text: `${f.name}的使者找到了你们，递来一份委托：${kind === "scout" ? `前往「${t.name}」侦察情况` : `清除盘踞在「${t.name}」的异常生物`}，十旬之内回复。报酬是 ${reward.xp} 点经验与一批补给。`,
        opts: [
          {
            label: "接受委托",
            hint: "限期 10 旬",
            ok: { text: "你们收下了委托书。", newQuest: q },
          },
          {
            label: "讨价还价",
            hint: "魅力检定，成功则报酬更高",
            check: { attr: "CHA", dc: dcOf(e, 1) },
            ok: {
              text: "使者咬着牙加了价。",
              newQuest: {
                ...q,
                reward: { xp: Math.round(reward.xp * 1.4), supply: 32 },
              },
              xp: 6,
              focus: { CHA: 1 },
            },
            bad: { text: "使者不悦，收回了委托。", rep: { [f.id]: -1 } },
          },
          { label: "婉拒", hint: "不接", ok: { text: "使者遗憾地离开了。" } },
        ],
      };
    },
  },
  {
    id: "calm",
    w: () => 0.8,
    build(e) {
      return {
        id: "calm",
        title: "平静的一旬",
        text: "路上出奇地安静。队员们借机整理装备、交换情报，久违地睡了个好觉。",
        opts: [
          {
            label: "继续",
            hint: "恢复少许状态",
            ok: { text: "难得的安宁。", hp: 0.06, stb: 0.06, en: 0.15 },
          },
        ],
      };
    },
  },
];
function battlefieldScenario(ctx, camp, b) {
  const A = facOf(ctx, b.a),
    B = facOf(ctx, b.b),
    loc = locOf(ctx, b.loc),
    e = encCtx(ctx, camp, localWorld(ctx.world, loc), loc, null);
  if (!A || !B) return null;
  return {
    id: "battlefield",
    title: `战场：${loc.name}`,
    text: `${A.name}与${B.name}正在「${loc.name}」交战——${b.win ? `${A.name}刚刚攻下了这里` : `${B.name}顶住了${A.name}的进攻`}。硝烟未散，双方都注意到了你们。`,
    loc: loc.id,
    opts: [
      {
        label: `助${A.name}`,
        hint: `与${B.name}的守军作战，胜则夺取此地`,
        ok: {
          text: `你们站到了${A.name}一边。`,
          battle: {
            kind: "patrol",
            fid: B.id,
            n: Math.max(2, e.mem.length),
            tier: 0,
            takeSide: { loc: loc.id, win: A.id },
          },
          rep: { [A.id]: 1, [B.id]: -1 },
        },
      },
      {
        label: `助${B.name}`,
        hint: `与${A.name}的攻方作战，胜则守住此地`,
        ok: {
          text: `你们站到了${B.name}一边。`,
          battle: {
            kind: "patrol",
            fid: A.id,
            n: Math.max(2, e.mem.length),
            tier: 0,
            takeSide: { loc: loc.id, win: B.id },
          },
          rep: { [B.id]: 1, [A.id]: -1 },
        },
      },
      {
        label: "暗中观察",
        hint: "感知检定",
        check: { attr: "PER", dc: dcOf(e, 1) },
        ok: {
          text: "你们摸清了双方的部署，悄悄离开。",
          xp: 16,
          focus: { PER: 2 },
        },
        bad: {
          text: "被哨兵发现，狼狈脱身。",
          hp: -0.08,
          rep: { [A.id]: -1, [B.id]: -1 },
        },
      },
      {
        label: "绕行",
        hint: "敏捷检定",
        check: { attr: "AGI", dc: dcOf(e) },
        ok: { text: "你们从战场边缘绕了过去。", xp: 6, focus: { AGI: 1 } },
        bad: { text: "流矢擦过了队伍。", hp: -0.1 },
      },
    ],
  };
}
function questFightScenario(ctx, camp, q) {
  const loc = locOf(ctx, q.target),
    e = encCtx(ctx, camp, localWorld(ctx.world, loc), loc, null);
  return {
    id: "questfight",
    title: `讨伐：${loc.name}`,
    text: `你们抵达「${loc.name}」，委托中提到的异常生物就盘踞在此，数量比想象的多。`,
    opts: [
      {
        label: "发起讨伐",
        hint: "战斗",
        ok: {
          text: "你们摆开阵势。",
          battle: {
            kind: "beast",
            tier: 1,
            n: Math.max(2, e.mem.length),
            quest: true,
          },
        },
      },
      {
        label: "放弃委托",
        hint: "撤走",
        ok: {
          text: "你们决定不再冒险，放弃了这份委托。",
          dropQuest: true,
          rep: { [q.fid]: -1 },
        },
      },
    ],
  };
}
function rollEncounter(ctx, camp, kind, lw, loc, to) {
  const R = ctx.R || Math.random,
    e = encCtx(ctx, camp, lw, loc, to);
  if (R() > (kind === "march" ? 0.32 + e.idx / 230 : 0.15)) return null;
  const list = ENC.map((x) => [x, x.w(e)]).filter((x) => x[1] > 0);
  let x = R() * sum(list.map((p) => p[1])),
    pick = list[list.length - 1][0];
  for (const [en, wv] of list) {
    x -= wv;
    if (x <= 0) {
      pick = en;
      break;
    }
  }
  const sc = pick.build(e, R) || ENC[ENC.length - 1].build(e, R);
  sc.mid = lw;
  return sc;
}

/* ---------- 回合推进 ---------- */
function setDest(ctx, camp, dest) {
  const P = camp.party,
    path = bfsPath(ctx.routes, P.loc, dest);
  if (!path || !path.length) return false;
  P.path = path;
  P.route = { to: path[0], left: edgeTurns(ctx.locs, P.loc, path[0]) };
  return true;
}
function stepTurn(ctx, camp, mode, R = ctx.R || Math.random) {
  ctx.R = R;
  const P = camp.party,
    mem = partyOf(ctx, camp);
  if (mode === "march" && !P.route) return false;
  camp.last = null;
  const here = locOf(ctx, P.loc),
    safe = isSafe(camp, here);
  advanceWorld(ctx, camp, R);
  const to = mode === "march" ? locOf(ctx, P.route.to) : null,
    lw =
      mode === "march" ? midWorld(ctx, here, to) : localWorld(ctx.world, here),
    m = worldMods(lw);
  let arrived = false;
  if (mode === "march") {
    P.supply = Math.max(0, P.supply - (5 + mem.length * 2));
    mem.forEach((c) => {
      condOf(c).en = Math.min(1, condOf(c).en + 0.1);
    });
    P.route.left--;
    if (P.route.left <= 0) {
      P.from = P.loc;
      P.loc = P.route.to;
      P.path.shift();
      arrived = true;
      P.route = P.path.length
        ? { to: P.path[0], left: edgeTurns(ctx.locs, P.loc, P.path[0]) }
        : null;
      chron(camp, "march", `远征队抵达「${locOf(ctx, P.loc).name}」。`);
    }
  } else if (mode === "rest") {
    const hp = safe ? 0.5 : 0.3,
      stb = safe ? 0.45 : 0.25;
    if (safe) P.supply = Math.min(100, P.supply + 12);
    else P.supply = Math.max(0, P.supply - 8);
    mem.forEach((c) => {
      const cd = condOf(c);
      cd.hp = Math.min(1, cd.hp + hp);
      cd.stb = Math.min(1, cd.stb + stb);
      cd.en = Math.min(1, cd.en + 0.6);
    });
    chron(
      camp,
      "march",
      `远征队在「${here.name}」休整${safe ? "，并补充了补给" : ""}。`,
    );
  } else {
    P.supply = Math.max(0, P.supply - 4);
    mem.forEach((c) => {
      const cd = condOf(c);
      cd.hp = Math.min(1, cd.hp + 0.1);
      cd.stb = Math.min(1, cd.stb + 0.1);
      cd.en = Math.min(1, cd.en + 0.2);
    });
  }
  const lines = [];
  mem.forEach((c) => {
    const cd = condOf(c);
    cd.stb = Math.max(0.03, cd.stb - m.ambientStb * 0.012);
    if (P.supply <= 0 && mode !== "rest") {
      cd.hp = Math.max(0.03, cd.hp - 0.1);
      cd.stb = Math.max(0.03, cd.stb - 0.06);
    }
  });
  if (P.supply <= 0 && mem.length && mode !== "rest")
    lines.push("补给耗尽，全队生命与稳定度下降。");
  /* 遭遇优先级：战场 > 委托讨伐 > 随机 */
  const at = locOf(ctx, P.loc);
  let sc = null;
  const bf = camp.battles.find((b) => b.loc === P.loc);
  if (mem.length && bf && (mode !== "march" || arrived))
    sc = battlefieldScenario(ctx, camp, bf);
  if (
    !sc &&
    mem.length &&
    arrived &&
    camp.quest &&
    camp.quest.target === P.loc
  ) {
    if (camp.quest.kind === "scout") {
      const q = camp.quest;
      camp.quest = null;
      questReward(ctx, camp, q, lines, R);
      camp.last = { title: "委托完成", lines: lines.slice() };
    } else sc = questFightScenario(ctx, camp, camp.quest);
  }
  if (
    !sc &&
    mem.length &&
    (mode === "march" || mode === "rest") &&
    !(arrived && P.route === null && false)
  )
    sc = rollEncounter(ctx, camp, mode, lw, at, to);
  if (sc) {
    camp.pending = sc;
    chron(camp, "event", `遭遇：${sc.title}。`);
  }
  if (lines.length && !camp.last) camp.last = { title: "行程", lines };
  return true;
}
function waitTurns(ctx, camp, n, R = ctx.R || Math.random) {
  for (let i = 0; i < n; i++) {
    if (camp.pending) break;
    stepTurn(ctx, camp, "wait", R);
    if (camp.pending) break;
  }
}
function resolveEncounter(ctx, camp, idx, R = ctx.R || Math.random) {
  ctx.R = R;
  const sc = camp.pending;
  if (!sc || !sc.opts[idx]) return null;
  const op = sc.opts[idx],
    mem = partyOf(ctx, camp),
    lines = [];
  let out = op.ok;
  if (op.check) {
    const ck = partyCheck(mem, op.check.attr, op.check.dc, R);
    lines.push(
      `${ATTR_NAME[op.check.attr]}检定：队伍 ${ck.score} 对难度 ${op.check.dc}（成功率 ${Math.round(ck.p * 100)}%），${ck.ok ? "成功" : "失败"}。`,
    );
    out = ck.ok ? op.ok : op.bad;
  }
  camp.last = { title: sc.title, lines };
  applyOutcome(ctx, camp, sc, out, lines, R);
  camp.pending = null;
  chron(
    camp,
    "event",
    `${sc.title}：${lines.find((l) => l && !/^(?:.{2,4}检定|补给|全队|与「)/.test(l)) || "已处理"}`,
  );
  return lines;
}
