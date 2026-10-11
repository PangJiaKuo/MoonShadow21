/**
 * 书院奇谈（校园主题）13 张特殊卡单元测试。
 * 覆盖：触发时机正确、效果结算正确、边界情况（手牌不足/对手无亮牌/随机压制未触发等）。
 */
import { describe, expect, it, vi } from 'vitest';
import type { CardInstance, GameState } from '@moon21/shared';
import { buildDeckDefs } from '../src/cards';
import { apply } from '../src/game';
import { makeSpecialCard, processUnresolvedDraw } from '../src/effects';

const DEFS = buildDeckDefs();

let uid = 0;
function card(defId: string, value: number, faceDown = false): CardInstance {
  const d = DEFS.find((x) => x.id === defId)!;
  uid += 1;
  return {
    uid: `t${uid}`,
    defId,
    name: d.name,
    suit: d.suit,
    rank: d.rank,
    value,
    faceDown,
    pendingValue: false,
  };
}
function special(defId: string, faceDown = false): CardInstance {
  return makeSpecialCard(defId, faceDown);
}
function score(h: CardInstance[]): number {
  return h.reduce((s, c) => s + (c.pendingValue ? 0 : c.value), 0);
}

interface MakeOpts {
  deck?: CardInstance[];
  unresolvedA?: string[];
  unresolvedB?: string[];
  usedA?: Record<string, boolean>;
  standA?: boolean;
  standB?: boolean;
}
function makeGame(handA: CardInstance[], handB: CardInstance[] = [], opts: MakeOpts = {}): GameState {
  const { deck = [], unresolvedA = [], unresolvedB = [], usedA = {}, standA = false, standB = false } = opts;
  return {
    id: 'test',
    config: { playerCount: 2, targetScore: 21, winPoints: 3, mode: 'duel', enableRoyals: true, enableSpecialCards: false },
    phase: 'playing',
    deck,
    players: [
      {
        id: 'p0', name: '甲', seat: 0, hand: handA, score: score(handA),
        status: standA ? 'stood' : 'active', isTurn: true, isHost: true,
        turnStage: standA ? 'stood' : 'awaitingAction',
        flags: { unresolvedDraw: unresolvedA, mustHit: false, doubled: false, used: usedA }, coins: 0, bet: 0,
      },
      {
        id: 'p1', name: '乙', seat: 1, hand: handB, score: score(handB),
        status: standB ? 'stood' : 'active', isTurn: false, isHost: false,
        turnStage: standB ? 'stood' : 'stood',
        flags: { unresolvedDraw: unresolvedB, mustHit: false, doubled: false, used: {} }, coins: 0, bet: 0,
      },
    ],
    currentPlayerIndex: 0,
    round: 1,
    points: { p0: 0, p1: 0 },
    pot: 0,
    winnerIds: [],
    eliminatedIds: [],
    log: [],
  };
}

function resolve(g: GameState, pid: string, optionId: string, value?: number): GameState {
  const pd = g.pending!;
  return apply(g, { type: 'resolveChoice', playerId: pid, decisionId: pd.id, optionId, value });
}

describe('笔记（普通 / OnDraw 点数 1-3）', () => {
  it('抽到时生成 1-3 选点决策，选择后生效', () => {
    const note = special('note');
    const g0 = makeGame([note, card('sun_2', 2)], [card('sun_5', 5)], { unresolvedA: [note.uid] });
    const g1 = apply(g0, { type: 'hit', playerId: 'p0' });
    expect(g1.pending?.effectType).toBe('adjustValue');
    expect(g1.pending?.options.filter((o) => o.id !== 'skip').map((o) => o.value)).toEqual([1, 2, 3]);
    const g2 = resolve(g1, 'p0', '2', 2);
    expect(g2.players[0].hand.find((c) => c.uid === note.uid)?.value).toBe(2);
  });
});

describe('食堂（普通 / OnDraw 手牌≥3 时 0/2/4）', () => {
  it('手牌不少于 3 张时可选 0/2/4', () => {
    const canteen = special('canteen');
    const g0 = makeGame([canteen, card('sun_2', 2), card('sun_3', 3)], [card('sun_5', 5)], {
      unresolvedA: [canteen.uid],
    });
    const g1 = processUnresolvedDraw(g0, 'p0');
    expect(g1.pending?.effectType).toBe('adjustValue');
    expect(g1.pending?.options.filter((o) => o.id !== 'skip').map((o) => o.value)).toEqual([0, 2, 4]);
  });
  it('手牌不足 3 张时点数无效（0 点）且无决策', () => {
    const canteen = special('canteen');
    const g0 = makeGame([canteen, card('sun_2', 2)], [card('sun_5', 5)], { unresolvedA: [canteen.uid] });
    const g1 = processUnresolvedDraw(g0, 'p0');
    expect(g1.pending).toBeFalsy();
    expect(g1.players[0].hand.find((c) => c.uid === canteen.uid)?.value).toBe(0);
  });
});

describe('闹钟（普通 / OnStand 弃自己抽 1 后必须停）', () => {
  it('停牌时自动弃自己、抽一张、保持停牌并轮到对方', () => {
    const alarm = special('alarm_clock');
    const g0 = makeGame([card('sun_2', 2), alarm], [card('sun_5', 5)], { deck: [card('flower_3', 3)] });
    const g1 = apply(g0, { type: 'stand', playerId: 'p0' });
    expect(g1.pending).toBeFalsy();
    expect(g1.players[0].hand.some((c) => c.uid === alarm.uid)).toBe(false);
    expect(g1.players[0].hand.some((c) => c.defId === 'flower_3')).toBe(true);
    expect(g1.players[0].score).toBe(5); // 2 + 3
    expect(g1.players[0].status).toBe('stood');
    expect(g1.players[0].flags.used.alarm_clock).toBe(true);
    expect(g1.players[1].isTurn).toBe(true);
  });
});

describe('选修课（稀有 / OnDraw 点数 2-5 或 8-11）', () => {
  it('抽到时生成 2-5 与 8-11 的选点决策', () => {
    const elective = special('elective');
    const g0 = makeGame([elective, card('sun_2', 2)], [card('sun_5', 5)], {
      deck: [card('sun_3', 3)],
      unresolvedA: [elective.uid],
    });
    const g1 = apply(g0, { type: 'hit', playerId: 'p0' });
    expect(g1.pending?.effectType).toBe('adjustValue');
    expect(g1.pending?.options.filter((o) => o.id !== 'skip').map((o) => o.value)).toEqual([2, 3, 4, 5, 8, 9, 10, 11]);
    const g2 = resolve(g1, 'p0', '10', 10);
    expect(g2.players[0].hand.find((c) => c.uid === elective.uid)?.value).toBe(10);
  });
});

describe('社团（稀有 / OnDraw 与对手暗牌互换）', () => {
  it('抽到时与上一家一张暗牌互换', () => {
    const club = special('club');
    const oppHidden = card('moon_K', 13, true);
    const g0 = makeGame([club, card('sun_2', 2)], [card('sun_5', 5), oppHidden], { unresolvedA: [club.uid] });
    const g1 = apply(g0, { type: 'hit', playerId: 'p0' });
    expect(g1.pending?.effectType).toBe('swapCard');
    const g2 = resolve(g1, 'p0', 'h0');
    expect(g2.players[0].hand.some((c) => c.uid === oppHidden.uid)).toBe(true);
    expect(g2.players[1].hand.some((c) => c.defId === 'club')).toBe(true);
  });
  it('上一家无暗牌时效果无效', () => {
    const club = special('club');
    const g0 = makeGame([club, card('sun_2', 2)], [card('sun_5', 5)], { unresolvedA: [club.uid] });
    const g1 = apply(g0, { type: 'hit', playerId: 'p0' });
    expect(g1.pending).toBeFalsy();
  });
});

describe('室友（稀有 / 被动 50% 压制对手特殊卡）', () => {
  it('随机命中时压制上一家特殊卡（点数归零无决策）', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1); // 0.1 < 0.5 → 触发
    const roommate = special('roommate');
    const silver = special('silver_moon');
    const g0 = makeGame([silver, card('sun_2', 2)], [roommate, card('sun_5', 5)], {
      deck: [card('sun_3', 3)],
      unresolvedA: [silver.uid],
    });
    const g1 = apply(g0, { type: 'hit', playerId: 'p0' });
    expect(g1.pending).toBeFalsy();
    expect(g1.players[0].hand.find((c) => c.uid === silver.uid)?.value).toBe(0);
    vi.restoreAllMocks();
  });
  it('随机未命中时不压制，效果照常触发', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9); // 0.9 > 0.5 → 未触发
    const roommate = special('roommate');
    const silver = special('silver_moon');
    const g0 = makeGame([silver, card('sun_2', 2)], [roommate, card('sun_5', 5)], {
      deck: [card('sun_3', 3)],
      unresolvedA: [silver.uid],
    });
    const g1 = apply(g0, { type: 'hit', playerId: 'p0' });
    expect(g1.pending?.effectType).toBe('adjustValue');
    vi.restoreAllMocks();
  });
});

describe('小组作业（稀有 / OnDraw 弃 1 张重抽 1 张）', () => {
  it('弃置所选手牌并重抽一张', () => {
    const group = special('group_work');
    const discardable = card('sun_2', 2);
    const g0 = makeGame([group, discardable], [card('sun_5', 5)], {
      deck: [card('flower_3', 3)],
      unresolvedA: [group.uid],
    });
    const g1 = apply(g0, { type: 'hit', playerId: 'p0' });
    expect(g1.pending?.effectType).toBe('redraw');
    const g2 = resolve(g1, 'p0', `d${discardable.uid}`);
    expect(g2.players[0].hand.some((c) => c.uid === discardable.uid)).toBe(false);
    expect(g2.players[0].hand.some((c) => c.defId === 'flower_3')).toBe(true);
  });
});

describe('通宵（史诗 / OnStand 弃自己令对手弃 1 重抽 1）', () => {
  it('停牌时自动弃自己，令上一家弃一张重抽一张', () => {
    const nighter = special('all_nighter');
    const oppCard = card('sun_5', 5);
    const g0 = makeGame([card('sun_2', 2), nighter], [oppCard], { deck: [card('flower_3', 3)] });
    const g1 = apply(g0, { type: 'stand', playerId: 'p0' });
    expect(g1.pending).toBeFalsy();
    expect(g1.players[0].hand.some((c) => c.uid === nighter.uid)).toBe(false);
    expect(g1.players[1].hand.some((c) => c.uid === oppCard.uid)).toBe(false);
    expect(g1.players[1].hand.some((c) => c.defId === 'flower_3')).toBe(true);
    expect(g1.players[1].score).toBe(3);
    expect(g1.players[0].flags.used.all_nighter).toBe(true);
    expect(g1.players[0].status).toBe('stood');
  });
});

describe('奖学金（史诗 / OnDraw 自动再抽 1 张，未爆则 ×2）', () => {
  it('自动再抽一张，抽后未爆则总点数 ×2（翻倍后超限则自动停牌）', () => {
    const sc = special('scholarship'); // 10 点
    const g0 = makeGame([card('sun_2', 2), sc], [card('sun_5', 5)], {
      deck: [card('sun_A', 1)],
      unresolvedA: [sc.uid],
    });
    const g1 = processUnresolvedDraw(g0, 'p0');
    expect(g1.pending).toBeFalsy();
    // 2 + 10 + 1 = 13 → ×2 = 26 > 21 → 自动停牌
    expect(g1.players[0].hand.some((c) => c.defId === 'sun_A')).toBe(true);
    expect(g1.players[0].score).toBe(26);
    expect(g1.players[0].status).toBe('stood');
  });
  it('自动再抽后已爆牌则不翻倍，直接自动停牌', () => {
    const sc = special('scholarship');
    const g0 = makeGame([card('sun_10', 10), sc], [card('sun_5', 5)], {
      deck: [card('sun_5', 5)],
      unresolvedA: [sc.uid],
    });
    const g1 = processUnresolvedDraw(g0, 'p0');
    // 10 + 10 = 20，抽 5 → 25 > 21 → 不翻倍，自动停牌
    expect(g1.players[0].score).toBe(25);
    expect(g1.players[0].status).toBe('stood');
  });
});

describe('论文（史诗 / OnDraw 全手牌 ±1）', () => {
  it('选择 +1 时全手牌点数 +1', () => {
    const thesis = special('thesis'); // 7 点
    const sun2 = card('sun_2', 2);
    const g0 = makeGame([thesis, sun2], [card('sun_5', 5)], { unresolvedA: [thesis.uid] });
    const g1 = apply(g0, { type: 'hit', playerId: 'p0' });
    expect(g1.pending?.effectType).toBe('adjustAll');
    const g2 = resolve(g1, 'p0', 'up');
    expect(g2.players[0].hand.find((c) => c.uid === thesis.uid)?.value).toBe(8);
    expect(g2.players[0].hand.find((c) => c.uid === sun2.uid)?.value).toBe(3);
    expect(g2.players[0].score).toBe(11);
  });
  it('选择 -1 时全手牌点数 -1，最低不低于 1', () => {
    const thesis = special('thesis');
    const sunA = card('sun_A', 1);
    const g0 = makeGame([thesis, sunA], [card('sun_5', 5)], { unresolvedA: [thesis.uid] });
    const g1 = apply(g0, { type: 'hit', playerId: 'p0' });
    const g2 = resolve(g1, 'p0', 'down');
    expect(g2.players[0].hand.find((c) => c.uid === thesis.uid)?.value).toBe(6);
    expect(g2.players[0].hand.find((c) => c.uid === sunA.uid)?.value).toBe(1); // 不低于 1
  });
});

describe('保研（传说 / OnDraw 点数任选 1-13）', () => {
  it('抽到时生成 1-13 的选点决策', () => {
    const pg = special('postgrad');
    const g0 = makeGame([pg, card('sun_2', 2)], [card('sun_5', 5)], { unresolvedA: [pg.uid] });
    const g1 = apply(g0, { type: 'hit', playerId: 'p0' });
    expect(g1.pending?.effectType).toBe('adjustValue');
    expect(g1.pending?.options.filter((o) => o.id !== 'skip').map((o) => o.value)).toEqual(
      Array.from({ length: 13 }, (_, i) => i + 1),
    );
    const g2 = resolve(g1, 'p0', '13', 13);
    expect(g2.players[0].hand.find((c) => c.uid === pg.uid)?.value).toBe(13);
  });
});

describe('退学（传说 / OnDraw 弃自己移除对手 1 张亮牌）', () => {
  it('选择后弃自己并移除上一家一张亮牌', () => {
    const dropout = special('dropout');
    const oppCard = card('sun_5', 5);
    const g0 = makeGame([dropout, card('sun_2', 2)], [card('moon_3', 3), oppCard], { unresolvedA: [dropout.uid] });
    const g1 = apply(g0, { type: 'hit', playerId: 'p0' });
    expect(g1.pending?.effectType).toBe('removeOpponentCard');
    const g2 = resolve(g1, 'p0', 'r1'); // 移除 sun_5
    expect(g2.players[0].hand.some((c) => c.uid === dropout.uid)).toBe(false);
    expect(g2.players[1].hand.some((c) => c.uid === oppCard.uid)).toBe(false);
    expect(g2.players[1].hand.some((c) => c.defId === 'moon_3')).toBe(true);
  });
  it('上一家无亮牌时效果无效', () => {
    const dropout = special('dropout');
    const g0 = makeGame([dropout, card('sun_2', 2)], [card('moon_3', 3, true)], { unresolvedA: [dropout.uid] });
    const g1 = apply(g0, { type: 'hit', playerId: 'p0' });
    expect(g1.pending).toBeFalsy();
  });
});

describe('毕业（传说 / OnDraw 补到 21 的差值）', () => {
  it('自动将点数设为「21 - 其余手牌点数」', () => {
    const grad = special('graduation'); // 初始 12
    const g0 = makeGame([card('sun_10', 10), grad], [card('sun_5', 5)], { unresolvedA: [grad.uid] });
    const g1 = processUnresolvedDraw(g0, 'p0');
    expect(g1.pending).toBeFalsy();
    expect(g1.players[0].hand.find((c) => c.uid === grad.uid)?.value).toBe(11); // 21 - 10
    expect(g1.players[0].score).toBe(21);
  });
  it('其余手牌已超 21 时点数取 0', () => {
    const grad = special('graduation');
    const g0 = makeGame([card('sun_10', 10), card('moon_K', 13), grad], [card('sun_5', 5)], {
      unresolvedA: [grad.uid],
    });
    const g1 = processUnresolvedDraw(g0, 'p0');
    expect(g1.players[0].hand.find((c) => c.uid === grad.uid)?.value).toBe(0);
    expect(g1.players[0].score).toBe(23);
  });
});
