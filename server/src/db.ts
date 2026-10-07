/**
 * 阶段 4：SQLite 持久化（node:sqlite，开发期）。
 *
 * 表结构：
 *  - users:     用户（昵称 + 密码哈希 + 金币）
 *  - cards:     牌库（从引擎特殊卡定义导入，用于图鉴与收藏）
 *  - user_cards: 玩家拥有的卡（收藏）
 *
 * 数据文件默认位于 <包根>/data/moon21.db，可通过环境变量 MOON21_DB 覆盖。
 */
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBaseDeckDefs, SPECIAL_CARDS } from '@moon21/engine';
import type {
  BuyResponse,
  CatalogResponse,
  CollectionCard,
  CollectionResponse,
  DeckCard,
  DeckEquipResponse,
  DeckResponse,
  Rarity,
  ShopItem,
  ShopResponse,
  UserProfile,
} from '@moon21/shared';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', 'data');

let db: DatabaseSync | null = null;

/** 卡牌表行 */
interface CardRow {
  id: string;
  name: string;
  series: string;
  rarity: string;
  suit: string;
  base_value: number;
  effect_json: string;
  description: string;
}

/** 用户表行 */
interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  coins: number;
  created_at: string;
}

function getDb(): DatabaseSync {
  if (!db) throw new Error('数据库尚未初始化，请先调用 initDb()');
  return db;
}

/** 初始化数据库：建表 + 首次导入牌库。 */
export function initDb(): void {
  if (db) return;
  const file = process.env.MOON21_DB ?? path.join(DATA_DIR, 'moon21.db');
  mkdirSync(path.dirname(file), { recursive: true });
  db = new DatabaseSync(file);
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      username      TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      coins         INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cards (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      series      TEXT NOT NULL,
      rarity      TEXT NOT NULL,
      suit        TEXT NOT NULL,
      base_value  INTEGER NOT NULL,
      effect_json TEXT,
      description TEXT
    );
    CREATE TABLE IF NOT EXISTS user_cards (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      card_id     TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      obtained_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_user_cards_user ON user_cards(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_cards_card ON user_cards(card_id);
    CREATE TABLE IF NOT EXISTS decks (
      id            TEXT PRIMARY KEY,
      user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name          TEXT NOT NULL,
      card_ids_json TEXT NOT NULL,
      is_default    INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_decks_user ON decks(user_id);
  `);
  seedCards();
}

/** 用引擎的最新特殊卡定义同步 cards 表（upsert），保证点数/稀有度等始终与代码一致。 */
function seedCards(): void {
  const insert = getDb().prepare(
    `INSERT INTO cards (id, name, series, rarity, suit, base_value, effect_json, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       series = excluded.series,
       rarity = excluded.rarity,
       suit = excluded.suit,
       base_value = excluded.base_value,
       effect_json = excluded.effect_json,
       description = excluded.description`,
  );
  for (const c of SPECIAL_CARDS) {
    insert.run(
      c.id,
      c.name,
      c.series,
      c.rarity,
      c.suit,
      c.baseValue,
      JSON.stringify(c.effect),
      c.description,
    );
  }
}

function toProfile(row: UserRow): UserProfile {
  return { id: row.id, username: row.username, coins: row.coins, createdAt: row.created_at };
}

/* ------------------------- 用户 ------------------------- */

export function createUser(username: string, passwordHash: string): UserProfile | null {
  const exists = getDb()
    .prepare('SELECT id FROM users WHERE username = ?')
    .get(username);
  if (exists) return null;
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO users (id, username, password_hash, coins, created_at)
       VALUES (?, ?, ?, 0, ?)`,
    )
    .run(id, username, passwordHash, createdAt);
  return { id, username, coins: 0, createdAt };
}

export function findUserByUsername(username: string): { id: string; passwordHash: string; profile: UserProfile } | null {
  const row = getDb().prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRow | undefined;
  if (!row) return null;
  return { id: row.id, passwordHash: row.password_hash, profile: toProfile(row) };
}

export function findUserById(id: string): UserProfile | null {
  const row = getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
  return row ? toProfile(row) : null;
}

/** 对局胜利发放金币。 */
export function addCoins(userId: string, amount: number): UserProfile | null {
  if (amount <= 0) return null;
  getDb().prepare('UPDATE users SET coins = coins + ? WHERE id = ?').run(amount, userId);
  return findUserById(userId);
}

/* ------------------------- 卡牌收藏 ------------------------- */

/** 注册时发放的初始卡组：全部特殊卡各 1 张。 */
export function grantInitialCards(userId: string): number {
  const now = new Date().toISOString();
  const insert = getDb().prepare(
    'INSERT INTO user_cards (id, user_id, card_id, obtained_at) VALUES (?, ?, ?, ?)',
  );
  let granted = 0;
  for (const c of SPECIAL_CARDS) {
    const owned = getDb()
      .prepare('SELECT id FROM user_cards WHERE user_id = ? AND card_id = ?')
      .get(userId, c.id);
    if (owned) continue;
    insert.run(randomUUID(), userId, c.id, now);
    granted++;
  }
  return granted;
}

function rowToCard(row: CardRow, count: number): CollectionCard {
  let effect: { trigger?: string; type?: string; params?: Record<string, unknown> } = {};
  try {
    effect = row.effect_json ? JSON.parse(row.effect_json) : {};
  } catch {
    effect = {};
  }
  return {
    cardId: row.id,
    name: row.name,
    series: row.series,
    rarity: row.rarity as Rarity,
    suit: row.suit as CollectionCard['suit'],
    baseValue: row.base_value,
    effectTrigger: effect.trigger as CollectionCard['effectTrigger'],
    effectType: effect.type as CollectionCard['effectType'],
    description: row.description,
    count,
  };
}

/** 图鉴：全部卡，count 为当前用户拥有张数（游客传 null → 0）。 */
export function getCatalog(userId?: string | null): CatalogResponse {
  const rows = getDb()
    .prepare('SELECT * FROM cards ORDER BY rarity DESC, id')
    .all() as unknown as CardRow[];
  const cards = rows.map((r) =>
    rowToCard(r, userId ? countOwned(userId, r.id) : 0),
  );
  return { cards };
}

/** 收藏：当前用户拥有的卡及张数。 */
export function getCollection(userId: string): CollectionResponse {
  const rows = getDb()
    .prepare(
      `SELECT c.*, COUNT(uc.id) AS cnt
       FROM cards c
       JOIN user_cards uc ON uc.card_id = c.id AND uc.user_id = ?
       GROUP BY c.id ORDER BY c.rarity DESC, c.id`,
    )
    .all(userId) as unknown as (CardRow & { cnt: number })[];
  const cards = rows.map((r) => rowToCard(r, r.cnt));
  return { cards };
}

function countOwned(userId: string, cardId: string): number {
  const r = getDb()
    .prepare('SELECT COUNT(*) AS n FROM user_cards WHERE user_id = ? AND card_id = ?')
    .get(userId, cardId) as { n: number };
  return r.n;
}

/** 供 /health 等调试使用。 */
export function dbStats(): { users: number; cards: number; userCards: number } {
  const one = (sql: string) => (getDb().prepare(sql).get() as { n: number }).n;
  return { users: one('SELECT COUNT(*) AS n FROM users'), cards: one('SELECT COUNT(*) AS n FROM cards'), userCards: one('SELECT COUNT(*) AS n FROM user_cards') };
}

/* ------------------------- 卡组与商城（阶段 4.5） ------------------------- */
const BASE_DEFS = buildBaseDeckDefs();
export const SHOP_PRICE = 100;

/** 确保用户有默认卡组（初始 52 张花色牌），懒创建。返回 card_ids。 */
export function ensureDeck(userId: string): string[] {
  const row = getDb()
    .prepare('SELECT card_ids_json FROM decks WHERE user_id = ? AND is_default = 1')
    .get(userId) as { card_ids_json: string } | undefined;
  if (row) return JSON.parse(row.card_ids_json) as string[];
  const ids = BASE_DEFS.map((d) => d.id);
  getDb()
    .prepare('INSERT INTO decks (id, user_id, name, card_ids_json, is_default) VALUES (?, ?, ?, ?, 1)')
    .run(randomUUID(), userId, '默认卡组', JSON.stringify(ids));
  return ids;
}

/** 卡组详情（基础牌 + 已放入的特殊卡）。 */
export function getDeckCards(userId: string): DeckResponse {
  const ids = ensureDeck(userId);
  const cards: DeckCard[] = ids.map((id) => {
    const base = BASE_DEFS.find((d) => d.id === id);
    if (base) {
      return { cardId: id, name: base.name, suit: base.suit, rank: base.rank, value: base.baseValue, base: true };
    }
    const sp = SPECIAL_CARDS.find((c) => c.id === id);
    if (!sp) return { cardId: id, name: '未知卡', suit: 'special', rank: '', value: 0, base: true };
    return {
      cardId: id,
      name: sp.name,
      suit: 'special',
      rank: 'Special',
      value: sp.baseValue,
      rarity: sp.rarity,
      series: sp.series,
      effectType: sp.effect.type,
      description: sp.description,
      base: false,
    };
  });
  return { cards, size: cards.length };
}

/** 商城商品列表（特殊卡 + 价格 + 是否已拥有）。 */
export function getShop(userId: string): ShopResponse {
  const ownedSet = new Set(
    (getDb().prepare('SELECT card_id FROM user_cards WHERE user_id = ?').all(userId) as { card_id: string }[]).map((r) => r.card_id),
  );
  const items: ShopItem[] = SPECIAL_CARDS.map((c) => ({
    cardId: c.id,
    name: c.name,
    series: c.series,
    rarity: c.rarity,
    value: c.baseValue,
    price: SHOP_PRICE,
    effectType: c.effect.type,
    description: c.description,
    owned: ownedSet.has(c.id),
  }));
  return { items };
}

/** 购买特殊卡：扣金币，加入「已拥有特殊卡」，不自动进卡组。 */
export function buySpecialCard(userId: string, cardId: string): BuyResponse {
  const user = findUserById(userId);
  if (!user) return { ok: false, coins: 0, error: '用户不存在' };
  const sp = SPECIAL_CARDS.find((c) => c.id === cardId);
  if (!sp) return { ok: false, coins: user.coins, error: '商品不存在' };
  if (user.coins < SHOP_PRICE) return { ok: false, coins: user.coins, error: `金币不足（需 ${SHOP_PRICE}）` };
  const owned = getDb().prepare('SELECT id FROM user_cards WHERE user_id = ? AND card_id = ?').get(userId, cardId);
  if (owned) return { ok: false, coins: user.coins, error: '已拥有该卡，可在卡组页装备' };
  getDb().prepare('UPDATE users SET coins = coins - ? WHERE id = ?').run(SHOP_PRICE, userId);
  getDb()
    .prepare('INSERT INTO user_cards (id, user_id, card_id, obtained_at) VALUES (?, ?, ?, ?)')
    .run(randomUUID(), userId, cardId, new Date().toISOString());
  const updated = findUserById(userId)!;
  return {
    ok: true,
    coins: updated.coins,
    item: {
      cardId: sp.id,
      name: sp.name,
      series: sp.series,
      rarity: sp.rarity,
      value: sp.baseValue,
      price: SHOP_PRICE,
      effectType: sp.effect.type,
      description: sp.description,
      owned: true,
    },
  };
}

/** 装备已拥有的特殊卡到卡组：替换一张同点数卡（基础牌或已放入的特殊卡）。 */
export function equipSpecialCard(userId: string, cardId: string, targetCardId: string): DeckEquipResponse {
  const sp = SPECIAL_CARDS.find((c) => c.id === cardId);
  if (!sp) return { ok: false, error: '特殊卡不存在' };
  const deck = ensureDeck(userId);
  const owned = getDb().prepare('SELECT id FROM user_cards WHERE user_id = ? AND card_id = ?').get(userId, cardId);
  if (!owned) return { ok: false, error: '你尚未拥有该特殊卡' };
  if (!deck.includes(targetCardId)) return { ok: false, error: '目标卡不在卡组中' };
  if (cardId === targetCardId) return { ok: false, error: '目标卡不能是自身' };
  const target =
    BASE_DEFS.find((d) => d.id === targetCardId) ?? SPECIAL_CARDS.find((c) => c.id === targetCardId);
  if (!target || target.baseValue !== sp.baseValue) return { ok: false, error: `只能替换 ${sp.baseValue} 点的牌` };
  const newDeck = deck.map((id) => (id === targetCardId ? cardId : id));
  getDb()
    .prepare('UPDATE decks SET card_ids_json = ? WHERE user_id = ? AND is_default = 1')
    .run(JSON.stringify(newDeck), userId);
  const cards = getDeckCards(userId).cards;
  return { ok: true, cards, size: cards.length, replacedCardId: targetCardId };
}
