/**
 * 特殊卡系统单元测试。
 * 覆盖 10 张卡：触发时机正确、效果结算正确、边界情况（对手无暗牌/非全太阳/被沉默压制等）。
 */
import { describe, expect, it } from 'vitest';
import type { CardInstance, GameState, PlayerFlags } from '@moon21/shared';
import { buildDeckDefs } from '../src/cards';
import { apply, settleRound } from '../src/game';
import { makeSpecialCard } from '../src/effects';

const DEFS = buildDeckDefs();

let uid = 0;
function card(defId: string, value: number, faceDown = false, pendingValue = false): CardInstance {
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
    pendingValue,
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
  flagsB?: Partial<PlayerFlags>;
}
function makeGame(handA: CardInstance[], handB: CardInstance[] = [], opts: MakeOpts = {}): GameState {
  const {
    deck = [],
    unresolvedA = [],
    unresolvedB = [],
    usedA = {},
    standA = false,
    standB = false,
    flagsB = {},
  } = opts;
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
        flags: { unresolvedDraw: unresolvedA, mustHit: false, doubled: false, used: usedA }, coins: 0, bet: 0
      },
      {
        id: 'p1', name: '乙', seat: 1, hand: handB, score: score(handB),
        status: standB ? 'stood' : 'active', isTurn: false, isHost: false,
        turnStage: standB ? 'stood' : 'stood',
        flags: { unresolvedDraw: unresolvedB, mustHit: false, doubled: false, used: {}, ...flagsB }, coins: 0, bet: 0
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

describe('银月（adjustValue 1-5）', () => {
  it('抽到时生成 1-5 的选点决策，选择后生效', () => {
    const silver = special('silver_moon');
    const g0 = makeGame([silver], [card('sun_5', 5)], { deck: [card('sun_3', 3)], unresolvedA: [silver.uid] });
    const g1 = apply(g0, { type: 'hit', playerId: 'p0' });
    expect(g1.pending?.effectType).toBe('adjustValue');
    expect(g1.pending?.options.filter((o) => o.id !== 'skip').map((o) => o.value)).toEqual([1, 2, 3, 4, 5]);
    const g2 = resolve(g1, 'p0', '3', 3);
    expect(g2.players[0].hand.find((c) => c.uid === silver.uid)?.value).toBe(3);
    expect(g2.players[0].flags.unresolvedDraw).not.toContain(silver.uid);
  });
});

describe('蒸汽核心（全太阳则 9/10）', () => {
  it('手牌全为太阳时可选 9 或 10', () => {
    const steam = special('steam_core');
    const g0 = makeGame([card('sun_2', 2), card('sun_3', 3), steam], [card('sun_5', 5)], {
      unresolvedA: [steam.uid],
    });
    const g1 = apply(g0, { type: 'hit', playerId: 'p0' });
    expect(g1.pending?.effectType).toBe('adjustValue');
    expect(g1.pending?.options.filter((o) => o.id !== 'skip').map((o) => o.value)).toEqual([9, 10]);
    const g2 = resolve(g1, 'p0', '9', 9);
    expect(g2.players[0].hand.find((c) => c.uid === steam.uid)?.value).toBe(9);
  });
  it('手牌非全太阳时点数无效（0 点）', () => {
    const steam = special('steam_core');
    const g0 = makeGame([card('sun_2', 2), card('moon_3', 3), steam], [card('sun_5', 5)], {
      deck: [card('sun_A', 1)],
      unresolvedA: [steam.uid],
    });
    const g1 = apply(g0, { type: 'hit', playerId: 'p0' });
    expect(g1.pending).toBeFalsy();
    expect(g1.players[0].hand.find((c) => c.uid === steam.uid)?.value).toBe(0);
  });
});

describe('替身（swapCard 与对手暗牌互换）', () => {
  it('抽到时与对手一张暗牌互换', () => {
    const standIn = special('stand_in');
    const oppHidden = card('moon_K', 13, true);
    const g0 = makeGame([standIn], [card('sun_5', 5), oppHidden], { unresolvedA: [standIn.uid] });
    const g1 = apply(g0, { type: 'hit', playerId: 'p0' });
    expect(g1.pending?.effectType).toBe('swapCard');
    const g2 = resolve(g1, 'p0', 'h0');
    expect(g2.players[0].hand.some((c) => c.uid === oppHidden.uid)).toBe(true);
    expect(g2.players[1].hand.some((c) => c.defId === 'stand_in')).toBe(true);
  });
  it('对手无暗牌时效果无效', () => {
    const standIn = special('stand_in');
    const g0 = makeGame([standIn], [card('sun_5', 5)], { unresolvedA: [standIn.uid] });
    const g1 = apply(g0, { type: 'hit', playerId: 'p0' });
    expect(g1.pending).toBeFalsy();
  });
});

describe('命运硬币（redraw 弃一张重抽）', () => {
  it('弃置所选手牌并重抽一张', () => {
    const fate = special('fate_coin');
    const discardable = card('sun_2', 2);
    const g0 = makeGame([fate, discardable], [card('sun_5', 5)], {
      deck: [card('flower_3', 3)],
      unresolvedA: [fate.uid],
    });
    const g1 = apply(g0, { type: 'hit', playerId: 'p0' });
    expect(g1.pending?.effectType).toBe('redraw');
    const g2 = resolve(g1, 'p0', `d${discardable.uid}`);
    expect(g2.players[0].hand.some((c) => c.uid === discardable.uid)).toBe(false);
    expect(g2.players[0].hand.some((c) => c.defId === 'flower_3')).toBe(true);
  });
});

describe('沉默（Passive 压制对手特殊卡）', () => {
  it('持有沉默时对手的 OnDraw 效果无效', () => {
    const silence = special('silence');
    const silver = special('silver_moon');
    const g0 = makeGame([silence, card('sun_2', 2)], [silver, card('sun_5', 5)], {
      deck: [card('sun_3', 3)],
      unresolvedB: [silver.uid],
    });
    const g1 = apply(g0, { type: 'stand', playerId: 'p0' }); // 甲停牌，轮到乙
    expect(g1.players[1].isTurn).toBe(true);
    const g2 = apply(g1, { type: 'hit', playerId: 'p1' });
    expect(g2.pending).toBeFalsy();
    expect(g2.players[1].hand.find((c) => c.uid === silver.uid)?.value).toBe(0);
  });
});

describe('双生（split 拆成两张减半）', () => {
  it('拆分后得到两张点数减半的牌', () => {
    const twin = special('twin'); // baseValue 8
    const g0 = makeGame([twin], [card('sun_5', 5)], { unresolvedA: [twin.uid] });
    const g1 = apply(g0, { type: 'hit', playerId: 'p0' });
    expect(g1.pending?.effectType).toBe('split');
    const g2 = resolve(g1, 'p0', 'yes');
    const halves = g2.players[0].hand.filter((c) => c.defId === 'twin_half');
    expect(halves).toHaveLength(2);
    expect(halves.every((c) => c.value === 4)).toBe(true);
  });
  it('选择保留则原牌不动', () => {
    const twin = special('twin');
    const g0 = makeGame([twin], [card('sun_5', 5)], { unresolvedA: [twin.uid] });
    const g1 = apply(g0, { type: 'hit', playerId: 'p0' });
    const g2 = resolve(g1, 'p0', 'no');
    expect(g2.players[0].hand.find((c) => c.uid === twin.uid)?.value).toBe(8);
    expect(g2.players[0].hand.filter((c) => c.defId === 'twin_half')).toHaveLength(0);
  });
});

describe('回溯（OnStand 弃一张重抽并停牌）', () => {
  it('停牌时可选回溯，重抽后保持停牌并轮到对方', () => {
    const rewind = special('rewind');
    const sun2 = card('sun_2', 2);
    const g0 = makeGame([sun2, rewind], [card('sun_5', 5)], { deck: [card('flower_3', 3)] });
    const g1 = apply(g0, { type: 'stand', playerId: 'p0' });
    expect(g1.pending?.effectType).toBe('discardRedraw');
    const g2 = resolve(g1, 'p0', `d${sun2.uid}`);
    expect(g2.players[0].status).toBe('stood');
    expect(g2.players[0].hand.some((c) => c.defId === 'flower_3')).toBe(true);
    expect(g2.players[0].flags.used.rewind).toBe(true);
    expect(g2.players[1].isTurn).toBe(true);
  });
  it('选择不发动则保持停牌', () => {
    const rewind = special('rewind');
    const g0 = makeGame([card('sun_2', 2), rewind], [card('sun_5', 5)]);
    const g1 = apply(g0, { type: 'stand', playerId: 'p0' });
    const g2 = resolve(g1, 'p0', 'skip');
    expect(g2.players[0].status).toBe('stood');
    expect(g2.players[1].isTurn).toBe(true);
  });
});

describe('赌徒（doubleOrNothing 加倍）', () => {
  it('声明加倍后必须抽牌，未爆则点数×2', () => {
    const gambler = special('gambler');
    const g0 = makeGame([gambler, card('sun_2', 2)], [card('sun_5', 5)], {
      deck: [card('sun_A', 1)],
      unresolvedA: [gambler.uid],
    });
    const g1 = apply(g0, { type: 'hit', playerId: 'p0' });
    expect(g1.pending?.effectType).toBe('doubleOrNothing');
    const g2 = resolve(g1, 'p0', 'yes');
    expect(g2.players[0].flags.doubled).toBe(true);
    expect(g2.players[0].flags.mustHit).toBe(true);
    expect(() => apply(g2, { type: 'stand', playerId: 'p0' }, true)).toThrow();
    const g3 = apply(g2, { type: 'hit', playerId: 'p0' }); // 赌徒7+2=9，抽1=10 → ×2=20
    expect(g3.players[0].score).toBe(20);
    expect(g3.players[0].flags.doubled).toBe(false);
    expect(g3.players[0].flags.doubled).toBe(false);
  });
  it('放弃加倍则无加倍标记', () => {
    const gambler = special('gambler');
    const g0 = makeGame([gambler], [card('sun_2', 2)], {
      deck: [card('sun_3', 3)],
      unresolvedA: [gambler.uid],
    });
    const g1 = apply(g0, { type: 'hit', playerId: 'p0' });
    const g2 = resolve(g1, 'p0', 'no');
    expect(g2.players[0].flags.doubled).toBe(false);
    expect(g2.players[0].flags.mustHit).toBe(false);
  });
});

describe('守夜人（OnCompare 强制对手重抽）', () => {
  it('对手 21 点时暂停结算，可强制其重抽', () => {
    const watch = special('night_watch');
    const g0 = makeGame(
      [watch, card('sun_2', 2)],
      [card('sun_10', 10), card('moon_J', 11)],
      { standA: true, standB: true },
    );
    const g1 = settleRound(g0);
    expect(g1.pending?.effectType).toBe('forceRedraw');
    const g2 = resolve(g1, 'p0', 'tp1');
    expect(g2.players[0].hand.some((c) => c.defId === 'night_watch')).toBe(false);
    expect(g2.players[0].flags.used.night_watch).toBe(true);
    expect(g2.phase).toBe('roundEnd');
  });
  it('选择不发动则正常结算', () => {
    const watch = special('night_watch');
    const g0 = makeGame(
      [watch, card('sun_2', 2)],
      [card('sun_10', 10), card('moon_J', 11)],
      { standA: true, standB: true },
    );
    const g1 = settleRound(g0);
    const g2 = resolve(g1, 'p0', 'skip');
    expect(g2.phase).toBe('roundEnd');
  });
});

describe('皇帝密令（fixedValue 13 + 不可停牌）', () => {
  it('选择使用后点数固定 13，本回合不可停牌，抽完可停', () => {
    const decree = special('imperial_decree');
    const g0 = makeGame([decree], [card('sun_5', 5)], {
      deck: [card('flower_3', 3)],
      unresolvedA: [decree.uid],
    });
    const g1 = apply(g0, { type: 'hit', playerId: 'p0' }); // 触发皇帝密令决策
    expect(g1.pending?.effectType).toBe('fixedValue');
    const gA = resolve(g1, 'p0', 'use');
    expect(gA.players[0].hand.find((c) => c.uid === decree.uid)?.value).toBe(13);
    expect(gA.players[0].flags.mustHit).toBe(true);
    expect(() => apply(gA, { type: 'stand', playerId: 'p0' }, true)).toThrow();
    const gB = apply(gA, { type: 'hit', playerId: 'p0' }); // 抽 3 → 13+3=16
    expect(gB.players[0].score).toBe(16);
    expect(gB.players[0].flags.mustHit).toBe(false);
  });
  it('选择不使用则点数归零且不强制抽牌', () => {
    const decree = special('imperial_decree');
    const g0 = makeGame([decree, card('sun_2', 2)], [card('sun_5', 5)], {
      deck: [card('flower_3', 3)],
      unresolvedA: [decree.uid],
    });
    const g1 = apply(g0, { type: 'hit', playerId: 'p0' });
    expect(g1.pending?.effectType).toBe('fixedValue');
    const gS = resolve(g1, 'p0', 'skip');
    expect(gS.players[0].hand.find((c) => c.uid === decree.uid)?.value).toBe(0);
    expect(gS.players[0].flags.mustHit).toBe(false);
    expect(() => apply(gS, { type: 'stand', playerId: 'p0' }, true)).not.toThrow();
  });
});

describe('特殊卡可选择不使用效果', () => {
  it('银月选“不使用效果”则保持 0 点并清除待结算', () => {
    const silver = special('silver_moon');
    const g0 = makeGame([silver, card('sun_2', 2)], [card('sun_5', 5)], {
      unresolvedA: [silver.uid],
    });
    const g1 = apply(g0, { type: 'hit', playerId: 'p0' });
    expect(g1.pending?.effectType).toBe('adjustValue');
    expect(g1.pending?.options.some((o) => o.id === 'skip')).toBe(true);
    const gS = resolve(g1, 'p0', 'skip');
    expect(gS.players[0].hand.find((c) => c.uid === silver.uid)?.value).toBe(0);
    expect(gS.players[0].flags.unresolvedDraw).not.toContain(silver.uid);
  });
  it('命运硬币选“不使用效果”则保留原手牌不弃牌', () => {
    const fate = special('fate_coin');
    const sun2 = card('sun_2', 2);
    const g0 = makeGame([fate, sun2], [card('sun_5', 5)], {
      deck: [card('flower_3', 3)],
      unresolvedA: [fate.uid],
    });
    const g1 = apply(g0, { type: 'hit', playerId: 'p0' });
    expect(g1.pending?.effectType).toBe('redraw');
    expect(g1.pending?.options.some((o) => o.id === 'skip')).toBe(true);
    const gS = resolve(g1, 'p0', 'skip');
    expect(gS.players[0].hand.some((c) => c.uid === sun2.uid)).toBe(true);
    expect(gS.players[0].hand.some((c) => c.defId === 'flower_3')).toBe(false);
  });
});


describe('沉默压制皇帝密令（特殊效果被压制则点数归零）', () => {
  it('被沉默压制时皇帝密令不再固定 13', () => {
    const silence = special('silence');
    const decree = special('imperial_decree');
    const g0 = makeGame([decree, card('sun_2', 2)], [silence, card('sun_5', 5)], {
      deck: [card('flower_3', 3)],
      unresolvedA: [decree.uid],
    });
    const g1 = apply(g0, { type: 'hit', playerId: 'p0' }); // 对手沉默压制
    expect(g1.players[0].hand.find((c) => c.uid === decree.uid)?.value).toBe(0);
    expect(g1.players[0].flags.mustHit).toBe(false);
  });
});

describe('特殊卡结算导致爆牌后推进回合', () => {
  it('银月选点后爆牌，自动轮到对手（不卡住）', () => {
    const silver = special('silver_moon');
    // 甲：10+13+银月(0) = 23，已超 21；触发银月选点
    const g0 = makeGame([card('sun_10', 10), card('moon_K', 13), silver], [card('sun_5', 5)], {
      unresolvedA: [silver.uid],
    });
    const g1 = apply(g0, { type: 'hit', playerId: 'p0' });
    expect(g1.pending?.effectType).toBe('adjustValue');
    const g2 = resolve(g1, 'p0', '5', 5); // 银月=5 → 28 爆牌
    expect(g2.players[0].status).toBe('stood'); // 新规则：爆牌自动停牌
    // 修复后必须推进回合，轮到对手
    expect(g2.players[1].isTurn).toBe(true);
    expect(g2.currentPlayerIndex).toBe(1);
  });
  it('特殊卡结算爆牌且对手也已爆，则直接结算', () => {
    const silver = special('silver_moon');
    const g0 = makeGame(
      [card('sun_10', 10), card('moon_K', 13), silver],
      [card('sun_10', 10), card('flower_K', 13)],
      { standB: true, unresolvedA: [silver.uid] },
    );
    const g1 = apply(g0, { type: 'hit', playerId: 'p0' });
    const g2 = resolve(g1, 'p0', '5', 5); // 甲爆，乙已停牌（10+13 也爆）→ 直接结算
    expect(g2.players[0].status).toBe('busted'); // 结算时统一揭晓爆牌
    expect(g2.phase).toBe('roundEnd');
  });
});
