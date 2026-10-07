/**
 * 牌堆工具：Fisher-Yates 洗牌（可注入随机源用于测试确定性）、顶牌抽取。
 */

/** Fisher-Yates 原地洗牌，返回新数组。rng 可注入（测试用固定种子）。 */
export function shuffle<T>(arr: readonly T[], rng: () => number = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

/** 从牌堆顶部抽一张（数组末端视为顶部），返回新牌堆与抽到的牌。 */
export function drawTop<T>(deck: readonly T[]): { card: T; deck: T[] } | null {
  if (deck.length === 0) return null;
  const next = deck.slice(0, -1);
  return { card: deck[deck.length - 1], deck: next };
}
