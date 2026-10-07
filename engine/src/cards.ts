/**
 * 牌库定义：共 54 张。
 *  - 4 花色（太阳 sun / 月亮 moon / 星辰 star / 花朵 flower）各 13 张
 *  - 皇帝 Emperor、皇后 Queen 2 张特殊牌（点数 0-13 可调）
 */
import type { CardDef, Rank, Suit } from '@moon21/shared';

export const SUITS: Suit[] = ['sun', 'moon', 'star', 'flower'];

export const RANK_ORDER: Rank[] = [
  'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K',
];

const SUIT_LABEL: Record<Suit, string> = {
  sun: '太阳',
  moon: '月亮',
  star: '星辰',
  flower: '花朵',
  special: '特殊',
};

/** 数字牌 A=1、2-10 面值；人头牌 J=11、Q=12、K=13。 */
export function rankValue(rank: Rank): number {
  switch (rank) {
    case 'A':
      return 1;
    case 'J':
      return 11;
    case 'Q':
      return 12;
    case 'K':
      return 13;
    default:
      return parseInt(rank, 10);
  }
}

export function suitLabel(suit: Suit): string {
  return SUIT_LABEL[suit];
}

/** 皇帝/皇后：点数待定（0-13），baseValue 记为 -1。 */
export const ROYAL_DEFS: CardDef[] = [
  { id: 'emperor', name: '皇帝', suit: 'special', rank: 'Emperor', kind: 'royal', baseValue: -1 },
  { id: 'queen', name: '皇后', suit: 'special', rank: 'Queen', kind: 'royal', baseValue: -1 },
];

/** 构造完整 54 张牌定义。 */
export function buildDeckDefs(): CardDef[] {
  const defs: CardDef[] = [];
  for (const suit of SUITS) {
    for (const rank of RANK_ORDER) {
      const kind = rank === 'A' || /^[0-9]+$/.test(rank) ? 'number' : 'court';
      defs.push({
        id: `${suit}_${rank}`,
        name: `${SUIT_LABEL[suit]}·${rank}`,
        suit,
        rank,
        kind,
        baseValue: rankValue(rank),
      });
    }
  }
  return [...defs, ...ROYAL_DEFS];
}

export const DECK_SIZE = buildDeckDefs().length; // 54

/** 52 张基础花色牌（卡组初始内容，不含皇帝皇后）。 */
export function buildBaseDeckDefs(): CardDef[] {
  return buildDeckDefs().filter((d) => d.kind !== 'royal');
}
