/**
 * per-player deck（个人卡组）单元测试。
 * 验证：每玩家从自己的卡组抽牌、不重复、卡组独立、未提供时保持全局牌堆。
 */
import { describe, expect, it } from 'vitest';
import { apply, createGame } from '../src/game';

describe('per-player deck（个人卡组）', () => {
  it('开局每人从各自卡组抽 1 张暗牌，剩余卡组对应减少', () => {
    const g = createGame(
      ['甲', '乙'],
      { playerCount: 2, enableRoyals: false, enableSpecialCards: false, playerDecks: { p0: ['sun_A', 'sun_2', 'sun_3', 'sun_4', 'sun_5'], p1: ['moon_A', 'moon_2', 'moon_3', 'moon_4', 'moon_5'] } },
      { rng: () => 0 },
    );
    expect(g.phase).toBe('playing');
    expect(g.playerDeck?.['p0'].length).toBe(4);
    expect(g.playerDeck?.['p1'].length).toBe(4);
    expect(g.players[0].hand).toHaveLength(1);
    expect(g.players[1].hand).toHaveLength(1);
  });

  it('抽牌从自己卡组且不重复', () => {
    const g0 = createGame(
      ['甲', '乙'],
      { playerCount: 2, enableRoyals: false, enableSpecialCards: false, playerDecks: { p0: ['sun_A', 'sun_2', 'sun_3', 'sun_4', 'sun_5'], p1: ['moon_A', 'moon_2', 'moon_3', 'moon_4', 'moon_5'] } },
      { rng: () => 0 },
    );
    let g = g0;
    const seen = new Set<string>();
    let draws = 0;
    // p0 持续抽牌直到卡组抽完（1-5 点总和 15，不会爆）
    while (g.playerDeck!['p0'].length > 0) {
      g = apply(g, { type: 'hit', playerId: 'p0' });
      const drawn = g.players[0].hand[g.players[0].hand.length - 1];
      expect(seen.has(drawn.defId)).toBe(false);
      seen.add(drawn.defId);
      draws += 1;
      // 抽牌后仍未停牌、仍在自己回合（1-5 点不会爆）
      expect(g.players[0].status).toBe('active');
      expect(g.players[0].isTurn).toBe(true);
    }
    expect(draws).toBe(4); // 暗牌 1 + 抽 4 = 5 张全部不重复
    expect(seen.size).toBe(4);
  });

  it('两玩家卡组独立，互不影响', () => {
    const g0 = createGame(
      ['甲', '乙'],
      { playerCount: 2, enableRoyals: false, enableSpecialCards: false, playerDecks: { p0: ['sun_2', 'sun_3', 'sun_4'], p1: ['moon_2', 'moon_3', 'moon_4'] } },
      { rng: () => 0 },
    );
    const p0Before = g0.playerDeck!['p0'].length;
    const p1Before = g0.playerDeck!['p1'].length;
    const g = apply(g0, { type: 'hit', playerId: 'p0' });
    expect(g.playerDeck!['p0'].length).toBe(p0Before - 1);
    expect(g.playerDeck!['p1'].length).toBe(p1Before);
    // p1 手牌不变
    expect(g.players[1].hand).toEqual(g0.players[1].hand);
  });

  it('未提供个人卡组时保持全局牌堆（playerDeck 为空）', () => {
    const g = createGame(['甲', '乙'], { playerCount: 2, enableRoyals: false, enableSpecialCards: false }, { rng: () => 0 });
    expect(g.playerDeck).toBeUndefined();
    expect(g.deck.length).toBeGreaterThan(0);
  });
});
