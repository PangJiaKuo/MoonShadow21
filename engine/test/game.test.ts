import { describe, expect, it } from 'vitest';
import type { CardInstance, GameState } from '@moon21/shared';
import { buildDeckDefs } from '../src/cards';
import { apply, createGame, nextRound, settleRound } from '../src/game';

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

/** 手搓一个对局状态：甲先手、乙后手，手牌与牌堆完全可控。 */
function makeGame(handA: CardInstance[], handB: CardInstance[], deck: CardInstance[] = []): GameState {
  return {
    id: 'test',
    config: { playerCount: 2, targetScore: 21, winPoints: 3, mode: 'duel', enableRoyals: true, enableSpecialCards: false },
    phase: 'playing',
    deck,
    players: [
      { id: 'p0', name: '甲', seat: 0, hand: handA, score: handA.reduce((s, c) => s + (c.pendingValue ? 0 : c.value), 0), status: 'active', isTurn: true, isHost: true, turnStage: 'awaitingAction', flags: { unresolvedDraw: [], mustHit: false, doubled: false, used: {} }, coins: 0, bet: 0 },
      { id: 'p1', name: '乙', seat: 1, hand: handB, score: handB.reduce((s, c) => s + (c.pendingValue ? 0 : c.value), 0), status: 'active', isTurn: false, isHost: false, turnStage: 'stood', flags: { unresolvedDraw: [], mustHit: false, doubled: false, used: {} }, coins: 0, bet: 0 },
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

describe('创建对局（发牌）', () => {
  it('2 人各发 1 张暗牌，牌堆剩 52，先手为 0 号', () => {
    const g = createGame(['甲', '乙'], { enableSpecialCards: false });
    expect(g.players).toHaveLength(2);
    expect(g.deck).toHaveLength(52);
    for (const p of g.players) {
      expect(p.hand).toHaveLength(1);
      expect(p.hand.filter((c) => c.faceDown)).toHaveLength(1);
    }
    expect(g.currentPlayerIndex).toBe(0);
    expect(g.phase).toBe('playing');
  });

  it('玩家数与 names 不一致时报错', () => {
    expect(() => createGame(['甲', '乙'], { playerCount: 3 })).toThrow();
  });

  it('enableRoyals=false 时牌堆不含皇帝皇后', () => {
    const g = createGame(['甲', '乙'], { enableRoyals: false, enableSpecialCards: false });
    const all = [...g.deck, ...g.players.flatMap((p) => p.hand)];
    expect(all.some((c) => c.suit === 'special')).toBe(false);
  });
});

describe('抽牌 / 停牌 / 爆牌', () => {
  it('抽牌加入手牌并更新点数', () => {
    const g0 = makeGame([card('sun_A', 1), card('moon_2', 2)], [card('star_5', 5)], [card('flower_3', 3)]);
    const g1 = apply(g0, { type: 'hit', playerId: 'p0' });
    expect(g1.players[0].hand).toHaveLength(3);
    expect(g1.players[0].score).toBe(6);
    expect(g1.players[0].status).toBe('active');
  });

  it('手牌 21 点即黑杰克，直接结算', () => {
    const g0 = makeGame([card('sun_A', 1), card('moon_K', 13), card('star_7', 7)], [card('flower_5', 5)]);
    // 甲 21 点停牌 -> 乙也停 -> 结算
    const g1 = apply(g0, { type: 'stand', playerId: 'p0' });
    const g2 = apply(g1, { type: 'stand', playerId: 'p1' });
    expect(g2.phase).toBe('roundEnd');
    expect(g2.roundResult?.reason).toBe('blackjack');
    expect(g2.roundResult?.winnerIds).toEqual(['p0']);
  });
});

describe('爆牌判定', () => {
  it('抽牌后超过 21 自动停牌并轮转（爆牌留待结算揭晓）', () => {
    const g0 = makeGame([card('sun_10', 10), card('moon_10', 10)], [card('star_2', 2)], [card('flower_5', 5)]);
    const g1 = apply(g0, { type: 'hit', playerId: 'p0' }); // 10+10+5=25 > 21
    expect(g1.players[0].status).toBe('stood'); // 新规则：爆牌自动停牌
    expect(g1.players[1].isTurn).toBe(true);
  });
});

describe('结算与胜负', () => {
  it('双方停牌，点数高者胜（closest）', () => {
    const g0 = makeGame([card('sun_10', 10), card('moon_8', 8)], [card('star_5', 5), card('flower_7', 7)]);
    const g1 = apply(g0, { type: 'stand', playerId: 'p0' }); // 18
    const g2 = apply(g1, { type: 'stand', playerId: 'p1' }); // 12
    expect(g2.roundResult?.winnerIds).toEqual(['p0']);
    expect(g2.roundResult?.reason).toBe('closest');
  });

  it('同分平局，两个赢家（tie）', () => {
    const g0 = makeGame([card('sun_10', 10), card('moon_8', 8)], [card('star_9', 9), card('flower_9', 9)]);
    const g1 = apply(g0, { type: 'stand', playerId: 'p0' });
    const g2 = apply(g1, { type: 'stand', playerId: 'p1' });
    expect(g2.roundResult?.winnerIds.sort()).toEqual(['p0', 'p1']);
    expect(g2.roundResult?.reason).toBe('tie');
  });

  it('全部爆牌则无人获胜（allBust）', () => {
    const g0 = makeGame([card('sun_10', 10), card('moon_K', 13)], [card('star_10', 10), card('flower_K', 13)]);
    const g1 = apply(g0, { type: 'stand', playerId: 'p0' });
    const g2 = apply(g1, { type: 'stand', playerId: 'p1' });
    expect(g2.roundResult?.winnerIds).toEqual([]);
    expect(g2.roundResult?.reason).toBe('allBust');
  });
});

describe('皇帝 / 皇后（可调点数）', () => {
  it('抽到皇帝后必须先 setValue 才能继续', () => {
    const g0 = makeGame([card('sun_A', 1), card('moon_2', 2)], [card('star_5', 5)], [card('emperor', 0, false, true)]);
    const g1 = apply(g0, { type: 'hit', playerId: 'p0' });
    const emperor = g1.players[0].hand.find((c) => c.defId === 'emperor')!;
    expect(emperor.pendingValue).toBe(true);
    // 未选点前不可再抽牌
    expect(() => apply(g1, { type: 'hit', playerId: 'p0' }, true)).toThrow();
    // 设点为 5
    const g2 = apply(g1, { type: 'setValue', playerId: 'p0', uid: emperor.uid, value: 5 });
    expect(g2.players[0].score).toBe(8); // 1+2+5
    expect(g2.players[0].hand.find((c) => c.uid === emperor.uid)?.pendingValue).toBe(false);
  });

  it('皇帝设为 0 点不计入总和', () => {
    const g0 = makeGame([card('sun_10', 10), card('moon_8', 8)], [card('star_5', 5)], [card('queen', 0, false, true)]);
    const g1 = apply(g0, { type: 'hit', playerId: 'p0' });
    const queen = g1.players[0].hand.find((c) => c.defId === 'queen')!;
    const g2 = apply(g1, { type: 'setValue', playerId: 'p0', uid: queen.uid, value: 0 });
    expect(g2.players[0].score).toBe(18);
  });

  it('setValue 超出 0-13 报错', () => {
    const g0 = makeGame([card('sun_A', 1)], [card('star_5', 5)], [card('emperor', 0, false, true)]);
    const g1 = apply(g0, { type: 'hit', playerId: 'p0' });
    const emperor = g1.players[0].hand.find((c) => c.defId === 'emperor')!;
    expect(() => apply(g1, { type: 'setValue', playerId: 'p0', uid: emperor.uid, value: 14 }, true)).toThrow();
  });
});

describe('duel 模式：轮流坐庄与积分', () => {
  it('下一轮先手轮换（甲 -> 乙）', () => {
    const g0 = createGame(['甲', '乙'], { enableSpecialCards: false });
    const g1 = apply(g0, { type: 'stand', playerId: 'p0' });
    const g2 = apply(g1, { type: 'stand', playerId: 'p1' });
    const g3 = nextRound(g2);
    expect(g3.round).toBe(2);
    expect(g3.currentPlayerIndex).toBe(1);
    expect(g3.players[1].isTurn).toBe(true);
  });

  it('赢家获得积分', () => {
    const g0 = makeGame([card('sun_10', 10), card('moon_8', 8)], [card('star_5', 5), card('flower_7', 7)]);
    const g1 = apply(g0, { type: 'stand', playerId: 'p0' });
    const g2 = apply(g1, { type: 'stand', playerId: 'p1' });
    expect(g2.points.p0).toBe(1);
    expect(g2.points.p1).toBe(0);
  });
});

describe('points / elimination 模式', () => {
  it('points 模式先到 winPoints 者获胜', () => {
    const g0 = makeGame([card('sun_10', 10), card('moon_8', 8)], [card('star_5', 5), card('flower_7', 7)]);
    const cfg = { ...g0.config, mode: 'points' as const, winPoints: 1 };
    const g0b = { ...g0, config: cfg };
    const g1 = apply(g0b, { type: 'stand', playerId: 'p0' });
    const g2 = apply(g1, { type: 'stand', playerId: 'p1' });
    expect(g2.phase).toBe('gameOver');
    expect(g2.winnerIds).toEqual(['p0']);
  });

  it('elimination 模式淘汰爆牌者与点数最低者', () => {
    // 甲爆牌，乙 12 点 -> 甲出局
    const g0 = makeGame([card('sun_10', 10), card('moon_K', 13)], [card('star_5', 5), card('flower_7', 7)]);
    const g0b = { ...g0, config: { ...g0.config, mode: 'elimination' as const } };
    const g1 = apply(g0b, { type: 'stand', playerId: 'p0' });
    const g2 = apply(g1, { type: 'stand', playerId: 'p1' });
    expect(g2.eliminatedIds).toContain('p0');
    expect(g2.eliminatedIds).not.toContain('p1');
  });
});

describe('非法动作守卫', () => {
  it('非本回合玩家动作被拒绝', () => {
    const g0 = makeGame([card('sun_A', 1)], [card('star_5', 5)]);
    expect(() => apply(g0, { type: 'hit', playerId: 'p1' }, true)).toThrow();
  });

  it('对局结束后动作被拒绝', () => {
    const g0 = makeGame([card('sun_10', 10), card('moon_8', 8)], [card('star_5', 5), card('flower_7', 7)]);
    const g0b = { ...g0, config: { ...g0.config, mode: 'points' as const, winPoints: 1 } };
    const g1 = apply(g0b, { type: 'stand', playerId: 'p0' });
    const g2 = apply(g1, { type: 'stand', playerId: 'p1' });
    expect(g2.phase).toBe('gameOver');
    expect(() => apply(g2, { type: 'hit', playerId: 'p0' }, true)).toThrow();
  });
});

// 兼容 settleRound 直接导出被引用
void settleRound;
