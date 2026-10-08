'use strict';
/* ==========================================================================
   万象工坊 · 静态界面文案的中英对照表 + 应用逻辑
   这里只覆盖 body.html 里固定不变的外壳文字（标题、按钮、说明）。
   角色、世界、势力等由 JS 生成的内容，各自在生成时就已经是双语的。
   ========================================================================== */
const STRINGS = {
  skip: { zh: '跳到内容', en: 'Skip to content' },
  brand: { zh: '万象工坊', en: 'Realm Forge' },
  'nav.aria': { zh: '工坊分区', en: 'Workshop sections' },
  'nav.guide': { zh: '体系总览', en: 'Overview' },
  'nav.world': { zh: '世界法则', en: 'World' },
  'nav.map': { zh: '地图地点', en: 'Map' },
  'nav.fac': { zh: '势力关系', en: 'Factions' },
  'nav.char': { zh: '角色工坊', en: 'Characters' },
  'nav.camp': { zh: '远征', en: 'Expedition' },
  'nav.sim': { zh: '推演', en: 'Simulate' },
  'tblock.title': { zh: '前往世界法则', en: 'Go to World Laws' },
  'tblock.world': { zh: '当前世界', en: 'Current World' },
  'tblock.index': { zh: '违常指数', en: 'Abnormality' },

  'hero.h1': { zh: '先调法则，再造人物，<br>最后让他们碰撞。', en: 'Tune the laws first,<br>then forge people — and let them collide.' },
  'hero.lead': { zh: '万象工坊是一个可以改写物理定律的沙盒。世界由八个法则旋钮定义，地图上的每个地点还能局部改写它们；魔法、异常、超能力与权能都要付出代价；角色属于势力、彼此之间有恩怨。派一支队伍去远征，他们会在行军中遭遇事件、在战争里改变领土，并随着经历真正成长。', en: "Realm Forge is a sandbox for rewriting the laws of physics. Eight dials define a world, and every place on its map can bend them further still; magic, anomaly, psionics, and dominion all exact a price; characters belong to factions and carry grudges with each other. Send a party on an expedition and they'll run into events on the road, shift territory in wars, and genuinely grow from what they live through." },
  'hero.hint': { zh: '点一个世界模板，雷达图会跟着变化。', en: 'Pick a world preset and watch the radar chart change.' },
  'hero.btnWorld': { zh: '调整这个世界', en: 'Tune this world' },
  'hero.btnChar': { zh: '直接创建角色', en: 'Jump to character creation' },
  'hero.figNote': { zh: '红色 = 偏离常识物理的部分', en: 'Red = deviation from mundane physics' },

  'sec.layers': { zh: '八层结构', en: 'Eight Layers' },
  'sec.layersSub': { zh: '上一层的输出，是下一层的输入。你可以只玩其中一层，也可以让八层一起运转，让一支队伍真正在这个世界里活一遍。', en: "Each layer's output feeds the next. Play with just one, or let all eight run together and watch a party actually live a life in this world." },
  'layer1.h': { zh: '法则层', en: 'Physics' },
  'layer1.p': { zh: '八个旋钮改写世界：重力、时间、空间、熵律、灵能、异常、因果、心念。它们共同输出「违常指数」、各体系的效率修正，以及这个世界里会发生的异象。', en: 'Eight dials rewrite the world: gravity, time, space, entropy, aether, anomaly, causality, and mind-over-matter. Together they produce an "Abnormality Index," an efficiency modifier for every power system, and the phenomena this world will produce.' },
  'layer2.h': { zh: '空间层', en: 'Geography' },
  'layer2.p': { zh: '地图由地点与路线组成。每个地点是一种类型（都会、灵脉圣地、裂隙区、时间遗迹……），会在世界旋钮之上再叠加一层局部偏移，所以同一个世界里，相隔一条路线就可能是另一套物理。', en: "The map is places and routes. Each place has a type (metropolis, ley shrine, rift zone, chrono ruin...) that layers a local offset on top of the world's dials — so one route over, you can find an entirely different physics." },
  'layer3.h': { zh: '体系层', en: 'Power Systems' },
  'layer3.p': { zh: '魔法、异常、超能力、权能四套能力逻辑。每一套都必须回答四个问题：力量从哪来？付出什么？受什么限制？失控会怎样？', en: 'Magic, Anomaly, Psionics, and Dominion — four distinct logics. Each must answer four questions: where does the power come from? What does it cost? What limits it? What happens when it slips control?' },
  'layer4.h': { zh: '能力层', en: 'Abilities' },
  'layer4.p': { zh: '能力 = 域 × 效果 × 形态 × 触发 × 代价 × 限制。十八个域（物质到虚无）由位阶逐步解锁，十种效果自由组合，因此能生成的能力几乎不会重复。', en: 'An ability = Domain × Effect × Form × Trigger × Cost × Limit. Eighteen domains (Matter to Void) unlock by tier, and ten effects combine freely, so almost no two generated abilities look alike.' },
  'layer5.h': { zh: '角色层', en: 'Characters' },
  'layer5.p': { zh: '十五种出身决定身体构造与先天特质；六维属性按位阶预算分配；五维性格生成阵营与言行习惯；外观带着能力显现出来的「异象特征」。', en: 'Fifteen origins set body and innate traits; six stats are allocated from a tier-based budget; a Big Five personality drives alignment and mannerisms; and appearance carries the "anomalous tells" that a power leaves behind.' },
  'layer6.h': { zh: '社会层', en: 'Society' },
  'layer6.p': { zh: '角色隶属于势力，势力之间有同盟与死敌，角色之间有亲人、宿敌与债务。势力会自行宣战、媾和、扩张与衰落，地图上的地点会因此易主——这一切在后台随时间持续演化，不需要玩家推动。', en: "Characters belong to factions; factions hold alliances and blood feuds; characters carry kinship, nemeses, and debts. Factions declare war, sue for peace, expand and decline on their own, and places on the map change hands as a result — all of it evolving in the background over time, with no need for the player to push it." },
  'layer7.h': { zh: '成长层', en: 'Growth' },
  'layer7.p': { zh: '角色在远征与战斗中获得经验，位阶提升时按这段经历的侧重分配属性点，位阶跨过门槛时能力还会进化出新的形态。经历会留下烙印与个人史，性格也可能被漫长的旅途悄悄改变。', en: 'Characters earn experience from expeditions and battle; leveling up allocates stat points weighted by what that experience emphasized, and crossing a tier threshold can evolve an ability into a new form. Experiences leave marks and a personal history, and personality itself can quietly shift over a long journey.' },
  'layer8.h': { zh: '推演层', en: 'Simulation' },
  'layer8.p': { zh: '回合制对抗，支持单挑与最多 5 对 5 的小队战，可以指定战场地点，再用蒙特卡洛估算胜率；远征标签页则是同一套引擎的持续版本——每一次行军、每一场遭遇战都在真正修改角色与世界。', en: 'A turn-based engine supports 1v1 duels and squads up to 5v5, at a battlefield of your choosing, with Monte Carlo win-rate estimates; the Expedition tab is the same engine running continuously — every march and every skirmish genuinely changes the characters and the world.' },

  'sec.rules': { zh: '四条设计准则', en: 'Four Design Principles' },
  'rule1.h': { zh: '违常必有价', en: 'Every Break Has a Price' },
  'rule1.p': { zh: '任何违背常规物理的能力，都要同时声明代价、限制与弱点。没有代价的力量，只会让故事失去张力。', en: 'Any power that breaks normal physics must declare its cost, limit, and weakness in the same breath. Power without a price only drains a story of its tension.' },
  'rule2.h': { zh: '世界定上限，角色定形状', en: 'The World Sets the Ceiling, the Character Sets the Shape' },
  'rule2.p': { zh: '同一个能力，在灵潮都市与灵能荒漠里的强度可以相差三倍。世界决定「能不能」，角色决定「怎么用」。', en: 'The same ability can differ threefold in strength between an Aether-Tide City and an Aether Desert. The world decides whether something is possible; the character decides how it gets used.' },
  'rule3.h': { zh: '体系互相克制', en: 'The Systems Counter Each Other' },
  'rule3.p': { zh: '魔法克异常，异常克超能力，超能力克魔法；权能凌驾其上，却被自己的戒律束缚。没有绝对的强者。', en: "Magic counters Anomaly, Anomaly counters Psionics, Psionics counters Magic; Dominion stands above all three, yet is bound by its own precept. No one is the absolute strongest." },
  'rule4.h': { zh: '稳定度是第二条命', en: 'Stability Is a Second Life Bar' },
  'rule4.p': { zh: '精神、信息、概念类攻击与异常侵蚀会消耗稳定度。生命归零是死亡，稳定度归零是被现实抹去。', en: 'Mind, Information, and Concept attacks — and anomalous corrosion — drain Stability. Zero HP means death; zero Stability means reality erases you.' },

  'sec.systems': { zh: '四大能力体系', en: 'The Four Power Systems' },
  'tri.h': { zh: '体系克制关系', en: 'System Counters' },
  'tri.sub': { zh: '箭头指向被克制的一方', en: 'Arrows point to the countered side' },
  'tri.note': { zh: '克制方威力 ×1.25，被克制方 ×0.8。权能对三者都是 ×1.15，反过来被它们攻击时只受 ×0.9，但权能会以一定概率违背戒律而遭到反噬。', en: "The countering side hits at ×1.25, the countered side at ×0.8. Dominion hits all three at ×1.15 and takes only ×0.9 from them in return — but it carries its own chance of breaking its precept and suffering backlash." },

  'sec.tiers': { zh: '位阶', en: 'Tiers' },
  'sec.formula': { zh: '规则速查', en: 'Quick Reference' },
  'formula.summary': { zh: '展开公式与判定细节', en: 'Expand formulas & resolution details' },
  'f.budget.t': { zh: '属性预算', en: 'Stat Budget' }, 'f.budget.d': { zh: '总点数 = 42 + 6 × 位阶；每项 1 至 20（随机生成时不低于 3）。超支的每一点会让稳定度上限 −2。最终属性 = 分配值 + 出身修正（1 至 24）。', en: 'Total points = 42 + 6 × Tier; each stat ranges 1–20 (never below 3 on random generation). Every point over budget costs −2 to the Stability cap. Final stat = allocated value + origin modifier (1–24).' },
  'f.hp.t': { zh: '生命', en: 'HP' }, 'f.hp.d': { zh: '30 + 体魄 × 5 + 意志 × 2 + 位阶 × 12', en: '30 + Strength × 5 + Willpower × 2 + Tier × 12' },
  'f.res.t': { zh: '体系资源', en: 'System Resource' }, 'f.res.d': { zh: '20 + 意志 × 3 + 智识 × 2 + 位阶 × 8。魔法称灵能，异常称渗流，超能力称精力，权能称权柄。', en: "20 + Willpower × 3 + Intellect × 2 + Tier × 8. Called Aether for Magic, Seepage for Anomaly, Energy for Psionics, and Authority for Dominion." },
  'f.stb.t': { zh: '稳定度', en: 'Stability' }, 'f.stb.d': { zh: '40 + 意志 × 3 + 感知 + 出身与被动修正，最低 20。', en: '40 + Willpower × 3 + Perception + origin and passive modifiers, minimum 20.' },
  'f.core.t': { zh: '核心能力威力', en: 'Core Ability Power' }, 'f.core.d': { zh: '8 + 位阶 × 2.2 + 主属性 × 1.1。战斗技为其 75%，消耗为核心的 40%。', en: "8 + Tier × 2.2 + primary stat × 1.1. A Combat Skill deals 75% of this; its cost is 40% of the Core Ability's." },
  'f.hit.t': { zh: '命中', en: 'Hit Chance' }, 'f.hit.d': { zh: '85% + 敏捷差 × 1.5% + 感知差 × 0.5% − 对方闪避，限制在 40% 至 97%。敏捷会被重力偏离削弱最多 25%。', en: "85% + Agility difference × 1.5% + Perception difference × 0.5% − target's Dodge, clamped to 40–97%. Agility can be reduced by up to 25% from gravity deviation." },
  'f.dmg.t': { zh: '伤害', en: 'Damage' }, 'f.dmg.d': { zh: '基础值 × 世界修正 × 出身加成 × 体系克制 × 抗性 × 随机(0.88 至 1.12) × 暴击(1.5)，再减去防御的 60%（异常技能只减 30%）。', en: 'Base × world modifier × origin bonus × system counter × resistance × random(0.88–1.12) × crit(1.5), minus 60% of Defense (only 30% against Anomaly abilities).' },
  'f.stbdmg.t': { zh: '稳定度伤害', en: 'Stability Damage' }, 'f.stbdmg.d': { zh: '精神、信息、概念域的技能造成伤害的 25% 稳定度伤害；异常体系再加 15%。', en: 'Mind, Information, and Concept-domain abilities deal 25% of their damage again as Stability damage; the Anomaly system adds another 15%.' },
  'f.twist.t': { zh: '因果偏转', en: 'Causal Deflection' }, 'f.twist.d': { zh: '每次攻击有 因果松弛 × 15% 的概率被命运接管：必定暴击或必定落空。', en: 'Every attack has a Causal Slack × 15% chance of fate taking over: a guaranteed crit, or a guaranteed miss.' },
  'f.backlash.t': { zh: '反噬', en: 'Backlash' }, 'f.backlash.d': { zh: '魔法在灵能偏离 55 越远越易反噬；异常随异常浓度与空间褶皱上升；超能力在精力低于 25% 时暴走；权能视因果松弛而定。', en: "Magic backfires more the further Aether Density strays from 55; Anomaly rises with Anomaly Density and Spatial Fold; Psionics surges below 25% Energy; Dominion depends on Causal Slack." },
  'f.local.t': { zh: '局部法则', en: 'Local Physics' }, 'f.local.d': { zh: '地点的实际旋钮 = 世界旋钮 + 该地点的偏移（限制在 0 至 100）。在某地推演时，一切世界修正都按这里的数值计算。', en: "A place's actual dials = world dials + that place's offset (clamped 0–100). Simulating at a place always uses these local values for every world modifier." },
  'f.synergy.t': { zh: '小队默契', en: 'Squad Synergy' }, 'f.synergy.d': { zh: '队友之间每一级正向关系 +2% 输出，每一级负向关系 −3%；同势力的队友每人 +2%。总修正限制在 ×0.85 至 ×1.15。', en: 'Each level of positive relationship between teammates adds +2% output; each level of negative relationship costs −3%; same-faction teammates add +2% each. Total modifier is clamped to ×0.85–×1.15.' },
  'f.grudge.t': { zh: '宿怨与犹豫', en: 'Grudges & Hesitation' }, 'f.grudge.d': { zh: '对阵关系为负的对手，伤害 +4% 每级；对阵关系为正的对手，伤害 −4% 每级。', en: 'Damage against an opponent with a negative relationship: +4% per level. Damage against one with a positive relationship: −4% per level.' },
  'f.order.t': { zh: '小队行动', en: 'Squad Turn Order' }, 'f.order.d': { zh: '按先攻排序依次行动。攻击优先选生命低、被自己克制、有仇的目标；辅助技能会去援助全队最虚弱的人。', en: 'Acts in Initiative order. Attacks prioritize low-HP, countered, or hated targets; support skills go to the weakest member of the team.' },
  'f.heat.t': { zh: '白热化', en: 'Escalation' }, 'f.heat.d': { zh: '第 9 回合起，所有伤害每回合递增 7%，保证对局最终会分出胜负。', en: 'From round 9 on, all damage climbs 7% per round, guaranteeing the fight eventually resolves.' },
  'f.facbonus.t': { zh: '势力加成', en: 'Faction Bonus' }, 'f.facbonus.d': { zh: '成员使用势力偏好的体系时，该体系威力 +5%。', en: "When a member uses their faction's favored system, that system's power gets +5%." },
  'f.xp.t': { zh: '晋升经验', en: 'Level-Up XP' }, 'f.xp.d': { zh: '升到下一位阶所需经验 = 40 × 位阶 + 10 × 位阶²，晋升时获得 6 点属性分配点，按这段经历里各属性被「使用」的次数加权随机分配。', en: 'XP needed for the next tier = 40 × Tier + 10 × Tier². Leveling up grants 6 stat points, randomly weighted by how often each stat was "exercised" during that stretch of experience.' },
  'f.evo.t': { zh: '能力进化', en: 'Ability Evolution' }, 'f.evo.d': { zh: '位阶每跨过一个新域的解锁门槛，有 40% 的概率让一项战斗技或辅助技进化为该新域的能力。', en: 'Every time a tier-up crosses a new domain\'s unlock threshold, there is a 40% chance a Combat or Utility Skill evolves into an ability of that new domain.' },
  'f.check.t': { zh: '远征检定', en: 'Expedition Checks' }, 'f.check.d': { zh: '取队伍中该属性最高的两人（次高者打 25% 折扣）算出队伍分数，与事件难度比较：成功率 = 50% + (分数 − 难度) × 5%，限制在 8% 至 95% 之间。', en: 'Takes the two highest values of the relevant stat in the party (the second at a 25% discount) as the party score, compared against the event\'s difficulty: success rate = 50% + (score − difficulty) × 5%, clamped to 8–95%.' },
  'f.dc.t': { zh: '事件难度', en: 'Event Difficulty' }, 'f.dc.d': { zh: '基础难度 = 8 + 2 × 队伍平均位阶 + 局部违常指数 ÷ 14，再按具体事件调整。', en: "Base difficulty = 8 + 2 × the party's average tier + local Abnormality Index ÷ 14, then adjusted per event." },

  'sec.howto': { zh: '怎么玩', en: 'How to Play' },
  howto1: { zh: '<b>调世界。</b>选模板或拧旋钮，看违常指数与各体系的效率变化。', en: '<b>Tune a world.</b> Pick a preset or turn the dials, and watch the Abnormality Index and each system\'s efficiency shift.' },
  howto2: { zh: '<b>画地图。</b>生成一张区域地图，给每个地点选类型、指定控制势力，必要时微调局部偏移。', en: '<b>Draw a map.</b> Generate a regional map, assign a type and controlling faction to each place, and fine-tune local offsets if you like.' },
  howto3: { zh: '<b>立势力。</b>编辑势力的理念与关系；点「一键生成群像」可以直接得到一批有归属、有恩怨的角色。', en: '<b>Set up factions.</b> Edit their ideology and relations; "Generate a Cast" instantly gives you a batch of characters with affiliations and grudges already in place.' },
  howto4: { zh: '<b>造角色。</b>指定位阶、体系、出身与所属势力，或随机重铸；每一块内容都能单独重掷、手动微调。', en: '<b>Build a character.</b> Set tier, system, origin, and faction, or randomize everything; every block can be individually re-rolled or hand-tuned.' },
  howto5: { zh: '<b>做推演。</b>选单挑或小队，选一个战场地点，看战报与胜率；换个地点，结果会完全不同。', en: '<b>Run a simulation.</b> Choose a duel or a squad fight, pick a battlefield, and read the battle report and win rate; change the location and the outcome changes with it.' },
  howto6: { zh: '<b>去远征。</b>挑几名角色组成远征队，在地图上行军。路上会遭遇事件、战斗、委托，世界也在后台继续打仗与扩张——回头再看，角色已经不是出发时的样子了。', en: "<b>Go on an expedition.</b> Pick a few characters, form a party, and march across the map. You'll hit events, battles, and commissions along the way, while the world keeps fighting and expanding in the background — look back later and the characters won't be who they were when they left." },

  'world.archive': { zh: '世界档案', en: 'World Profile' },
  'world.archiveSub': { zh: '选模板，或从头调', en: 'Pick a preset, or tune from scratch' },
  'world.name': { zh: '世界名称', en: 'World Name' },
  'world.btnRandName': { zh: '随机名', en: 'Randomize' },
  'world.btnRandWorld': { zh: '随机生成整个世界', en: 'Randomize entire world' },
  'world.dials': { zh: '法则旋钮', en: 'Law Dials' },
  'world.dialsSub': { zh: '红线 = 与常识物理的偏离', en: 'Red line = deviation from mundane physics' },
  'world.readout': { zh: '违常读数', en: 'Abnormality Reading' },
  'world.index': { zh: '违常指数', en: 'Abnormality Index' },
  'world.efficiency': { zh: '体系效率', en: 'System Efficiency' },
  'world.efficiencySub': { zh: '相对常态的威力倍率', en: 'Power multiplier relative to baseline' },
  'world.phenomena': { zh: '此世界的异象', en: 'Phenomena in This World' },
  'world.btnEvent': { zh: '抽取一次世界事件', en: 'Roll a world event' },

  'map.title': { zh: '区域地图', en: 'Regional Map' },
  'map.sub': { zh: '点击选中，拖动可移动地点', en: 'Click to select; drag to move a place' },
  'map.aria': { zh: '区域地图', en: 'Regional map' },
  'map.btnGen': { zh: '按当前世界重新生成地图', en: 'Regenerate map for this world' },
  'map.btnAdd': { zh: '新增地点', en: 'Add a place' },

  'fac.title': { zh: '势力', en: 'Factions' },
  'fac.btnAdd': { zh: '新增势力', en: 'Add faction' },
  'fac.btnCast': { zh: '一键生成群像', en: 'Generate a cast' },
  'fac.castNote': { zh: '「一键生成群像」会随机创建 8 名带有势力、驻地与关系的角色并加入名册，可以立刻拿去组队推演。', en: '"Generate a cast" randomly creates 8 characters with factions, home bases, and relationships already set, and adds them to the roster — ready to squad up right away.' },
  'fac.network': { zh: '关系网', en: 'Relationship Web' },
  'fac.networkSub': { zh: '点击节点，高亮它的关系', en: 'Click a node to highlight its relationships' },
  'fac.netAria': { zh: '势力与角色关系网', en: 'Faction and character relationship network' },
  'fac.legendPos': { zh: '友好、同盟、亲近', en: 'Friendly, allied, close' },
  'fac.legendNeg': { zh: '敌对、死敌、仇怨', en: 'Hostile, nemesis, blood feud' },
  'fac.legendMem': { zh: '隶属', en: 'Membership' },
  'fac.legendNote': { zh: '大圆 = 势力，小点 = 角色（颜色为体系）', en: 'Large circle = faction, small dot = character (colored by system)' },

  'char.basic': { zh: '基本设定', en: 'Basics' },
  'char.basicSub': { zh: '改动会立刻反映在右侧角色卡', en: 'Changes appear immediately on the character card to the right' },
  'char.btnNew': { zh: '随机重铸全部', en: 'Randomize everything' },
  'char.btnSave': { zh: '存入名册', en: 'Save to roster' },
  'char.name': { zh: '名字', en: 'Name' },
  'char.btnRename': { zh: '换一个', en: 'Reroll' },
  'char.tierLine': { zh: '位阶 <b id="tierLab"></b>', en: 'Tier <b id="tierLab"></b>' },
  'char.system': { zh: '能力体系', en: 'Power System' },
  'char.origin': { zh: '出身与身体构造', en: 'Origin & Physiology' },
  'char.archetype': { zh: '定位', en: 'Archetype' },
  'char.faction': { zh: '所属势力', en: 'Faction' },
  'char.rank': { zh: '职级', en: 'Rank' },
  'char.loc': { zh: '驻地', en: 'Home Base' },
  'char.attrs': { zh: '六维属性', en: 'Six Stats' },
  'char.btnRerollAttrs': { zh: '重掷属性分配', en: 'Reroll stat allocation' },
  'char.persona': { zh: '五维性格', en: 'Big Five Personality' },
  'char.personaSub': { zh: '拖动后阵营与性格描述会跟着变', en: 'Alignment and description update as you drag' },
  'char.btnRerollPersona': { zh: '重掷性格与动机', en: 'Reroll personality & motivation' },
  'char.other': { zh: '其他内容', en: 'Other' },
  'char.otherSub': { zh: '逐块重掷，不影响别处', en: 'Reroll one block at a time without affecting the rest' },
  'char.btnRerollLook': { zh: '重掷外观', en: 'Reroll appearance' },
  'char.btnRerollAbil': { zh: '重掷能力', en: 'Reroll abilities' },
  'char.btnRerollBg': { zh: '重掷背景', en: 'Reroll background' },
  'char.roster': { zh: '名册', en: 'Roster' },
  'char.ioSummary': { zh: '导入与导出', en: 'Import & Export' },
  'char.ioNote': { zh: '导出会把整个名册变成一段文字，复制保存即可；把它粘贴回来并点击导入，就能恢复。', en: 'Exporting turns the whole roster into a block of text you can copy and save; paste it back in and click import to restore it.' },
  'char.ioPlaceholder': { zh: '在这里粘贴导入的内容，或点击导出后复制', en: 'Paste the import text here, or click Export to copy it' },
  'char.btnExport': { zh: '导出名册', en: 'Export roster' },
  'char.btnImport': { zh: '导入', en: 'Import' },

  'camp.buildTitle': { zh: '组建远征队', en: 'Form an Expedition' },
  'camp.buildSub': { zh: '从名册中选人，指定出发地点', en: 'Pick people from the roster and choose a starting point' },
  'camp.buildNote': { zh: '远征会真正改变角色：他们在路上获得的经验、伤痕与经历都会保留下来，即使远征结束也不会消失。人数上限 6 人。', en: 'An expedition genuinely changes characters: the experience, scars, and history they gain on the road stay with them even after the expedition ends. Max party size: 6.' },
  'camp.startLoc': { zh: '出发地点', en: 'Starting Point' },
  'camp.btnStart': { zh: '开始远征', en: 'Begin expedition' },
  'camp.supply': { zh: '补给', en: 'Supply' },
  'camp.encounter': { zh: '遭遇', en: 'Encounter' },
  'camp.action': { zh: '行动', en: 'Actions' },
  'camp.dest': { zh: '目的地', en: 'Destination' },
  'camp.btnMarchOne': { zh: '行军一旬', en: 'March one turn' },
  'camp.btnMarchAuto': { zh: '连续行军', en: 'March continuously' },
  'camp.btnRest': { zh: '扎营（1 旬）', en: 'Camp (1 turn)' },
  'camp.btnWait1': { zh: '等待（1 旬）', en: 'Wait (1 turn)' },
  'camp.btnWait5': { zh: '等待 5 旬', en: 'Wait 5 turns' },
  'camp.party': { zh: '远征队', en: 'Party' },
  'camp.addAria': { zh: '加入远征队', en: 'Add to party' },
  'camp.btnAdd': { zh: '加入', en: 'Add' },
  'camp.btnReset': { zh: '重新组队（重置远征）', en: 'Re-form party (reset expedition)' },
  'camp.map': { zh: '沿途地图', en: 'Route Map' },
  'camp.mapSub': { zh: '点击地点前往', en: 'Click a place to travel there' },
  'camp.mapAria': { zh: '远征地图', en: 'Expedition map' },
  'camp.territory': { zh: '天下大势', en: 'State of the World' },
  'camp.chron': { zh: '纪事', en: 'Chronicle' },
  'camp.chronSub': { zh: '最近发生的事，包含战争与外交', en: 'Recent events, including wars and diplomacy' },

  'sim.title': { zh: '推演场地', en: 'Simulation Ground' },
  'sim.duel': { zh: '单挑', en: 'Duel' },
  'sim.squad': { zh: '小队对抗', en: 'Squad Battle' },
  'sim.modeAria': { zh: '推演模式', en: 'Simulation mode' },
  'sim.battlefield': { zh: '战场', en: 'Battlefield' },
  'sim.sideA': { zh: '甲方', en: 'Side A' },
  'sim.sideB': { zh: '乙方', en: 'Side B' },
  'sim.btnRun': { zh: '开始推演', en: 'Run simulation' },
  'sim.btnOpp': { zh: '换一个随机对手', en: 'New random opponent' },
  'sim.btnMap': { zh: '去看地图', en: 'View map' },
  'sim.hint': { zh: '每次推演都会用新的随机数打一场完整的对局，并另外模拟数百场来估算胜率。', en: 'Each run plays a full match with fresh randomness, then simulates hundreds more in the background to estimate the win rate.' },
};

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => { const s = STRINGS[el.getAttribute('data-i18n')]; if (s) el.textContent = tf(s); });
  document.querySelectorAll('[data-i18n-html]').forEach((el) => { const s = STRINGS[el.getAttribute('data-i18n-html')]; if (s) el.innerHTML = tf(s); });
  document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    el.getAttribute('data-i18n-attr').split(';').forEach((pair) => {
      const [attr, key] = pair.split(':'); const s = STRINGS[key];
      if (attr && s) el.setAttribute(attr, tf(s));
    });
  });
  document.documentElement.lang = LANG === 'en' ? 'en' : 'zh-CN';
  const lbl = $('#langToggleLabel'); if (lbl) lbl.textContent = LANG === 'en' ? '中文' : 'EN';
}
/* 切换语言后，静态外壳文字走 applyI18n；所有由 JS 生成的动态内容（角色卡、地图、势力、推演……）
   都要用新语言重新渲染一遍，所以把 init 阶段用到的渲染函数在这里再跑一次。 */
function renderEverything() {
  applyI18n();
  state.sim.opp = null; /* 随手生成的随机对手只是便利默认值，不是用户主动创建的内容，切换语言时一并刷新 */
  buildDials(); buildCharControls(); renderGuideStatic(); syncCharControls(); syncDials();
  renderWorldAll(false); renderCard(); renderRoster(); renderEvents();
  renderMap(); renderFacAll(); renderSim(); renderCamp();
}
function setLangAndRerender(l) { setLang(l); STORE.set('lang', l); renderEverything(); }
function bindLangToggle() {
  $('#langToggle').addEventListener('click', () => setLangAndRerender(getLang() === 'en' ? 'zh' : 'en'));
}
