/**
 * 阶段 4：对局胜利金币发放单元测试。
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { createUser, findUserById, initDb } from '../src/db';
import { WIN_COINS, rewardWinnersCore } from '../src/reward';

before(() => {
  process.env.MOON21_DB = ':memory:';
  initDb();
});

describe('对局胜利金币', () => {
  it('胜者账号获得金币，游客与未胜账号不加', () => {
    const win = createUser('win', 'h');
    const loser = createUser('loser', 'h');
    const guest = createUser('guest', 'h');
    assert.ok(win && loser && guest);
    const players = [
      { userId: win.id, seat: 0 },
      { userId: loser.id, seat: 1 },
      { userId: null, seat: 2 },
    ];
    const { count } = rewardWinnersCore([0], players);
    assert.equal(count, 1);
    assert.equal(findUserById(win.id)?.coins, WIN_COINS);
    assert.equal(findUserById(loser.id)?.coins, 0);
    assert.equal(findUserById(guest.id)?.coins, 0);
  });

  it('胜者座位无账号（游客）不发放', () => {
    const u = createUser('u1', 'h');
    assert.ok(u);
    const { count } = rewardWinnersCore([0], [{ userId: null, seat: 0 }]);
    assert.equal(count, 0);
    assert.equal(findUserById(u.id)?.coins, 0);
  });

  it('平局多胜者：都为账号时全部发放', () => {
    const a = createUser('tiea', 'h');
    const b = createUser('tieb', 'h');
    assert.ok(a && b);
    const players = [
      { userId: a.id, seat: 0 },
      { userId: b.id, seat: 1 },
    ];
    const { count } = rewardWinnersCore([0, 1], players);
    assert.equal(count, 2);
    assert.equal(findUserById(a.id)?.coins, WIN_COINS);
    assert.equal(findUserById(b.id)?.coins, WIN_COINS);
  });
});
