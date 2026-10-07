/**
 * 人机对战：AI 决策逻辑单元测试。
 */
import { describe, expect, it } from 'vitest';
import type { GameAction, GameState, PendingDecision } from '@moon21/shared';
import { apply, createGame } from '../src/game';
import { AI_STAND_THRESHOLD, bestRoyalValue, chooseAction } from '../src/ai';

/** 让 AI 连续行动直到轮到人类或回合结束 */
function runAi(game: GameState, aiId: string): { game: GameState; actions: GameAction[] } {
  let g = game;
  const actions: GameAction[] = [];
  let guard = 0;
  for (;;) {
    if (g.phase === 'roundEnd' || g.phase === 'gameOver') break;
    const ai = g.players.find((p) => p.id === aiId)!;
    if (!ai.isTurn && g.pending?.playerId !== aiId) break;
    const action = chooseAction(g, aiId);
    if (!action) break;
    actions.push(action);
    g = apply(g, action, true);
    if (++guard > 200) throw new Error('AI 循环超限');
  }
  return { game: g, actions };
}

function fixedRng(): number {
  return 0;
}

describe('chooseAction 基本决策', () => {
  it('导出停牌阈值常量', () => {
    expect(AI_STAND_THRESHOLD).toBe(16);
  });

  it('持有待定点数牌时返回 setValue（取不爆且尽量大的点数）', () => {
    let g = createGame(['人类', '电脑'], { enableSpecialCards: false }, { rng: fixedRng });
    const me = g.players[1];
    const royal = { ...me.hand[0], pendingValue: true, value: 0, rank: 'Emperor' as const, suit: 'special' as const };
    g = {
      ...g,
      players: g.players.map((p) =>
        p.id === me.id
          ? { ...p, hand: [royal, ...p.hand.slice(1)], score: 10, isTurn: true, status: 'active' as const }
          : p,
      ),
      currentPlayerIndex: 1,
      phase: 'playing',
      pending: null,
    };
    const action = chooseAction(g, me.id) as Extract<GameAction, { type: 'setValue' }>;
    expect(action.type).toBe('setValue');
    expect(action.uid).toBe(royal.uid);
    expect(action.value).toBe(11); // 10 + 11 = 21，不爆最大
  });

  it('点数达到阈值时选择停牌', () => {
    let g = createGame(['人类', '电脑'], { enableSpecialCards: false }, { rng: fixedRng });
    g = {
      ...g,
      players: g.players.map((p) =>
        p.id === 'p1'
          ? { ...p, score: 18, isTurn: true, status: 'active' as const, hand: p.hand.map((c) => ({ ...c, pendingValue: false })) }
          : p,
      ),
      currentPlayerIndex: 1,
      phase: 'playing',
      pending: null,
    };
    const action = chooseAction(g, 'p1');
    expect(action?.type).toBe('stand');
  });

  it('点数低于阈值时选择抽牌', () => {
    let g = createGame(['人类', '电脑'], { enableSpecialCards: false }, { rng: fixedRng });
    g = {
      ...g,
      players: g.players.map((p) =>
        p.id === 'p1'
          ? { ...p, score: 8, isTurn: true, status: 'active' as const, hand: p.hand.map((c) => ({ ...c, pendingValue: false })) }
          : p,
      ),
      currentPlayerIndex: 1,
      phase: 'playing',
      pending: null,
    };
    const action = chooseAction(g, 'p1');
    expect(action?.type).toBe('hit');
  });
});

describe('chooseAction 特殊卡决策', () => {
  it('adjustValue：选不爆且最大的点数（银月）', () => {
    const g = createGame(['人类', '电脑'], {}, { rng: fixedRng });
    const pending: PendingDecision = {
      id: 'd1',
      playerId: 'p1',
      cardUid: 'c1',
      effectType: 'adjustValue',
      kind: 'adjustValue',
      title: '银月',
      description: '选点',
      options: [
        { id: '1', label: '1', value: 1 },
        { id: '3', label: '3', value: 3 },
        { id: '5', label: '5', value: 5 },
      ],
    };
    const withPending = {
      ...g,
      players: g.players.map((p) => (p.id === 'p1' ? { ...p, score: 17 } : p)),
      pending,
    };
    const action = chooseAction(withPending, 'p1') as Extract<GameAction, { type: 'resolveChoice' }>;
    expect(action.type).toBe('resolveChoice');
    // 17 + 5 = 22 > 21（爆）；17 + 3 = 20 不爆最大 -> 选 3
    expect(action.value).toBe(3);
    expect(action.optionId).toBe('3');
  });

  it('待处理决策属于对手时返回 null', () => {
    const g = createGame(['人类', '电脑'], {}, { rng: fixedRng });
    const pending: PendingDecision = {
      id: 'd2',
      playerId: 'p0',
      cardUid: 'c1',
      effectType: 'adjustValue',
      kind: 'adjustValue',
      title: '银月',
      description: '对手决策',
      options: [{ id: '1', label: '1', value: 1 }],
    };
    expect(chooseAction({ ...g, pending }, 'p1')).toBeNull();
  });
});

describe('AI 完整对局（纯基础牌）', () => {
  it('人类停牌后，AI 自动打完本轮到结算', () => {
    let g = createGame(['人类', '电脑'], { enableSpecialCards: false }, { rng: fixedRng });
    // 手动构造：人类已停牌、AI 轮到；清掉双方待定点牌
    g = {
      ...g,
      players: g.players.map((p) =>
        p.id === 'p0'
          ? { ...p, status: 'stood' as const, isTurn: false, hand: p.hand.map((c) => ({ ...c, pendingValue: false })) }
          : { ...p, isTurn: true, status: 'active' as const, hand: p.hand.map((c) => ({ ...c, pendingValue: false })) },
      ),
      currentPlayerIndex: 1,
      phase: 'playing',
      pending: null,
    };
    const r = runAi(g, 'p1');
    expect(r.actions.length).toBeGreaterThan(0);
    expect(['roundEnd', 'gameOver']).toContain(r.game.phase);
  });
});

describe('bestRoyalValue', () => {
  it('不爆且尽量大', () => {
    const g = createGame(['a', 'b'], {}, { rng: fixedRng });
    const ai = { ...g.players[1], score: 10 };
    expect(bestRoyalValue(ai, 21)).toBe(11);
  });

  it('点数已高时取 0 或非负最小（不爆）', () => {
    const g = createGame(['a', 'b'], {}, { rng: fixedRng });
    const ai = { ...g.players[1], score: 24 };
    expect(bestRoyalValue(ai, 21)).toBe(0);
  });
});
