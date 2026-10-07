/**
 * 阶段 4：数据库层单元测试（Node 原生 test runner + 内存 SQLite）。
 * 覆盖：用户创建/查询、密码哈希存储、金币增减、初始卡组发放、图鉴与收藏。
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  addCoins,
  createUser,
  findUserByUsername,
  findUserById,
  getCatalog,
  getCollection,
  grantInitialCards,
  initDb,
} from '../src/db';

// 内存数据库：必须在 initDb 之前设置环境变量
before(() => {
  process.env.MOON21_DB = ':memory:';
  initDb();
});

describe('用户', () => {
  it('创建用户：昵称唯一、初始 0 金币', () => {
    const u = createUser('alice', 'hash1');
    assert.ok(u);
    assert.equal(u.username, 'alice');
    assert.equal(u.coins, 0);
    assert.ok(u.id);
  });

  it('重复昵称返回 null', () => {
    assert.equal(createUser('alice', 'hash2'), null);
  });

  it('按昵称 / ID 查询，返回密码哈希与画像', () => {
    const found = findUserByUsername('alice');
    assert.ok(found);
    assert.equal(found.passwordHash, 'hash1');
    assert.equal(found.profile.username, 'alice');
    assert.equal(findUserById(found.id)?.coins, 0);
  });

  it('金币增减', () => {
    const u = createUser('bob', 'h');
    assert.ok(u);
    addCoins(u.id, 10);
    assert.equal(findUserById(u.id)?.coins, 10);
  });
});

describe('卡牌收藏', () => {
  it('图鉴含全部特殊卡，游客 count 为 0', () => {
    const catalog = getCatalog(null);
    assert.ok(catalog.cards.length >= 10);
    assert.ok(catalog.cards.every((c) => c.count === 0));
    assert.ok(catalog.cards[0].series);
  });

  it('注册发放初始卡组：全部特殊卡各 1 张', () => {
    const u = createUser('carol', 'h');
    assert.ok(u);
    const granted = grantInitialCards(u.id);
    assert.ok(granted >= 10);
    const coll = getCollection(u.id);
    assert.ok(coll.cards.length >= 10);
    assert.ok(coll.cards.every((c) => c.count === 1));
  });

  it('收藏会反映图鉴中已登录用户的拥有数量', () => {
    const u = createUser('dave', 'h');
    assert.ok(u);
    grantInitialCards(u.id);
    const catalog = getCatalog(u.id);
    assert.ok(catalog.cards.some((c) => c.count > 0));
  });

  it('重复发放不产生重复收藏', () => {
    const u = createUser('erin', 'h');
    assert.ok(u);
    grantInitialCards(u.id);
    grantInitialCards(u.id);
    const coll = getCollection(u.id);
    assert.ok(coll.cards.every((c) => c.count === 1));
  });
});
