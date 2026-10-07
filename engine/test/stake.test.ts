import { describe, it, expect } from 'vitest';
import { apply, createGame, settleRound } from '../src/game';

/** 积分赛对局：无皇家、无特殊卡，固定随机源 */
function stakeGame(names: string[]) {
  return createGame(
    names,
    { mode: 'stake', enableRoyals: false, enableSpecialCards: false },
    { rng: () => 0.5 },
  );
}

describe('积分赛（stake）', () => {
  it('初始每人 10 币，首轮自动投 1 币底注', () => {
    const g = stakeGame(['A', 'B']);
    expect(g.pot).toBe(0);
    expect(g.players[0].coins).toBe(9);
    expect(g.players[0].bet).toBe(1);
    expect(g.players[1].coins).toBe(9);
    expect(g.players[1].bet).toBe(1);
  });

  it('非积分赛模式不投注', () => {
    const g = createGame(['A', 'B'], { mode: 'duel', enableRoyals: false, enableSpecialCards: false }, { rng: () => 0.5 });
    expect(g.players[0].coins).toBe(10);
    expect(g.players[0].bet).toBe(0);
  });

  it('停牌后产出加注决策，可加注并计入本轮投注', () => {
    const g = stakeGame(['A', 'B']);
    const r = apply(g, { type: 'stand', playerId: 'p0' });
    expect(r.pending?.effectType).toBe('raise');
    expect(r.pending?.playerId).toBe('p0');
    expect(r.pending?.max).toBe(9);

    const r2 = apply(r, { type: 'resolveChoice', playerId: 'p0', decisionId: r.pending!.id, optionId: 'amount', value: 3 });
    expect(r2.players[0].coins).toBe(6); // 9 - 3
    expect(r2.players[0].bet).toBe(4); // 1 + 3
    expect(r2.pending).toBeNull(); // 加注后推进回合
    expect(r2.currentPlayerIndex).toBe(1);
  });

  it('加注不超过持有币数（超限自动截断）', () => {
    const g = stakeGame(['A', 'B']);
    const r = apply(g, { type: 'stand', playerId: 'p0' });
    const r2 = apply(r, { type: 'resolveChoice', playerId: 'p0', decisionId: r.pending!.id, optionId: 'amount', value: 999 });
    expect(r2.players[0].coins).toBe(0);
    expect(r2.players[0].bet).toBe(10);
  });

  it('选择不加注时投注保持底注', () => {
    const g = stakeGame(['A', 'B']);
    const r = apply(g, { type: 'stand', playerId: 'p0' });
    const r2 = apply(r, { type: 'resolveChoice', playerId: 'p0', decisionId: r.pending!.id, optionId: 'none' });
    expect(r2.players[0].coins).toBe(9);
    expect(r2.players[0].bet).toBe(1);
  });

  it('结算后唯一胜者赢得奖池，筹码总量守恒', () => {
    const g = stakeGame(['A', 'B']);
    let r = apply(g, { type: 'stand', playerId: 'p0' });
    r = apply(r, { type: 'resolveChoice', playerId: 'p0', decisionId: r.pending!.id, optionId: 'none' });
    r = apply(r, { type: 'stand', playerId: 'p1' });
    r = apply(r, { type: 'resolveChoice', playerId: 'p1', decisionId: r.pending!.id, optionId: 'none' });
    expect(['roundEnd', 'gameOver']).toContain(r.phase);
    const total = r.players.reduce((s, p) => s + p.coins, 0);
    expect(total).toBe(20); // 初始 10+10，奖池结算后回到胜者筹码
    const winner = r.roundResult!.winnerIds;
    if (winner.length === 1) {
      expect(r.players.find((p) => p.id === winner[0])!.coins).toBe(11); // 9 + 2 奖池
    }
  });

  it('平局时并列最高分平分奖池，余数留桌', () => {
    const g = stakeGame(['A', 'B']);
    g.players[0].hand[0].value = 5;
    g.players[0].hand[0].pendingValue = false;
    g.players[1].hand[0].value = 5;
    g.players[1].hand[0].pendingValue = false;
    const r = settleRound(g);
    expect(r.roundResult!.winnerIds.sort()).toEqual(['p0', 'p1']);
    expect(r.players[0].coins).toBe(10); // 9 + 1 平分
    expect(r.players[1].coins).toBe(10);
    expect(r.pot).toBe(0);
  });

  it('平局奖池有余数时留桌滚存到下一轮', () => {
    const g = stakeGame(['A', 'B']);
    g.players[0].hand[0].value = 5;
    g.players[0].hand[0].pendingValue = false;
    g.players[1].hand[0].value = 5;
    g.players[1].hand[0].pendingValue = false;
    g.players[0].bet = 1;
    g.players[1].bet = 1;
    g.players[0].coins = 9;
    g.players[1].coins = 9;
    const r = settleRound(g);
    // 奖池 2，平分 2/2=1 整除，无余数
    expect(r.pot).toBe(0);
  });

  it('币数用尽的玩家出局，剩一人获胜', () => {
    const g = stakeGame(['A', 'B']);
    g.players[0].hand[0].value = 5;
    g.players[0].hand[0].pendingValue = false;
    g.players[1].hand[0].value = 2;
    g.players[1].hand[0].pendingValue = false;
    g.players[1].coins = 0;
    g.players[1].bet = 0;
    const r = settleRound(g);
    expect(r.eliminatedIds).toContain('p1');
    expect(r.phase).toBe('gameOver');
    expect(r.winnerIds).toEqual(['p0']);
    expect(r.players[0].coins).toBe(10); // 9 + 1 奖池
  });
});
