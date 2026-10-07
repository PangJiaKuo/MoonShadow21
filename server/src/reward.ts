/**
 * 阶段 4：对局胜利金币发放（纯逻辑，可单元测试）。
 * 按「全局胜者的座位号」与「房间玩家的账号绑定」匹配，为胜者账号 +WIN_COINS。
 */
import { addCoins } from './db';

/** 每场对局胜利发放金币数 */
export const WIN_COINS = 5;

/** 参与奖励判定的玩家（座位号 + 可选账号） */
export interface RewardablePlayer {
  userId?: string;
  seat: number;
}

export interface RewardResult {
  /** 已发放金币的账号 id */
  rewarded: Set<string>;
  count: number;
}

/** 为指定胜者座位对应的账号发放金币。 */
export function rewardWinnersCore(
  winnerSeats: number[],
  players: RewardablePlayer[],
): RewardResult {
  const rewarded = new Set<string>();
  const seatSet = new Set(winnerSeats);
  for (const p of players) {
    if (p.userId && seatSet.has(p.seat)) {
      addCoins(p.userId, WIN_COINS);
      rewarded.add(p.userId);
    }
  }
  return { rewarded, count: rewarded.size };
}
