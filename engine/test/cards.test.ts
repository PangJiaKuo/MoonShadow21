import { describe, expect, it } from 'vitest';
import { buildDeckDefs, DECK_SIZE, SUITS, rankValue, ROYAL_DEFS } from '../src/cards';
import { shuffle } from '../src/deck';

describe('牌库构造', () => {
  it('共 54 张：4 花色 × 13 + 皇帝皇后', () => {
    const defs = buildDeckDefs();
    expect(defs.length).toBe(54);
    expect(DECK_SIZE).toBe(54);
    expect(SUITS).toHaveLength(4);
    expect(ROYAL_DEFS.map((d) => d.name)).toEqual(['皇帝', '皇后']);
  });

  it('每个花色含 A..K 共 13 张', () => {
    const defs = buildDeckDefs();
    for (const suit of SUITS) {
      const count = defs.filter((d) => d.suit === suit).length;
      expect(count).toBe(13);
    }
  });

  it('数字牌点数：A=1, J=11, Q=12, K=13, 2-10 面值', () => {
    expect(rankValue('A')).toBe(1);
    expect(rankValue('2')).toBe(2);
    expect(rankValue('10')).toBe(10);
    expect(rankValue('J')).toBe(11);
    expect(rankValue('Q')).toBe(12);
    expect(rankValue('K')).toBe(13);
  });

  it('皇帝皇后 baseValue 为 -1（待定）', () => {
    for (const d of ROYAL_DEFS) {
      expect(d.kind).toBe('royal');
      expect(d.baseValue).toBe(-1);
    }
  });
});

describe('洗牌', () => {
  it('打乱后元素集合不变', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffle(arr);
    expect(out).toHaveLength(arr.length);
    expect([...out].sort()).toEqual([...arr].sort());
  });

  it('不修改原数组', () => {
    const arr = [1, 2, 3, 4, 5];
    shuffle(arr);
    expect(arr).toEqual([1, 2, 3, 4, 5]);
  });

  it('固定随机源可复现', () => {
    const rng = () => 0.5;
    const a = shuffle([1, 2, 3, 4, 5, 6], rng);
    const b = shuffle([1, 2, 3, 4, 5, 6], rng);
    expect(a).toEqual(b);
  });
});
