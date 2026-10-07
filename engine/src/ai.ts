/**
 * 人机对战：AI 决策逻辑（纯函数，可单元测试）。
 *
 * 返回该 AI 玩家「下一步」应执行的动作；无动作返回 null。
 * 由前端在轮到 AI 时定时调用并派发，直到轮到人类或对局结束。
 */
import type { GameAction, GameState, PendingDecision, PlayerState } from '@moon21/shared';

/** AI 停牌阈值：点数 >= 此值停牌，否则抽牌 */
export const AI_STAND_THRESHOLD = 16;

export function chooseAction(game: GameState, aiId: string): GameAction | null {
  const ai = game.players.find((p) => p.id === aiId);
  if (!ai) return null;

  // 1) 存在待处理的特殊卡决策
  if (game.pending) {
    if (game.pending.playerId !== aiId) return null;
    return resolvePending(game.pending, ai, game.config.targetScore, aiId);
  }

  if (game.phase !== 'playing' || !ai.isTurn || ai.status !== 'active') return null;

  // 2) 有未结算的 OnDraw 特殊卡 → 发一个占位动作触发引擎结算（引擎会优先处理）
  if (ai.flags.unresolvedDraw.length > 0) {
    return ai.flags.mustHit ? { type: 'hit', playerId: aiId } : { type: 'stand', playerId: aiId };
  }

  // 3) 有待定点数的牌（皇帝/皇后）→ 设一个不爆且尽量大的点数
  const pend = ai.hand.find((c) => c.pendingValue);
  if (pend) {
    return {
      type: 'setValue',
      playerId: aiId,
      uid: pend.uid,
      value: bestRoyalValue(ai, game.config.targetScore),
    };
  }

  // 4) 本回合必须抽牌（皇帝密令 / 赌徒加倍）
  if (ai.flags.mustHit) return { type: 'hit', playerId: aiId };

  // 5) 正常策略：够高就停，否则抽
  return ai.score >= AI_STAND_THRESHOLD
    ? { type: 'stand', playerId: aiId }
    : { type: 'hit', playerId: aiId };
}

/** 皇帝/皇后设点：使总分不爆且尽量大 */
export function bestRoyalValue(ai: PlayerState, target: number): number {
  const base = ai.score; // scoreOf 已忽略 pendingValue 的牌
  return Math.min(13, Math.max(0, target - base));
}

/** 自动选择待处理决策：adjustValue 取不爆且最大的点数，其余取第一个可选项 */
function resolvePending(
  pending: PendingDecision,
  ai: PlayerState,
  target: number,
  aiId: string,
): GameAction {
  let chosen = pending.options[0];
  if (pending.kind === 'adjustValue') {
    for (const o of pending.options) {
      const v = o.value ?? 0;
      if (ai.score + v <= target && v > (chosen.value ?? -1)) chosen = o;
    }
  }
  return {
    type: 'resolveChoice',
    playerId: aiId,
    decisionId: pending.id,
    optionId: chosen.id,
    value: chosen.value,
  };
}
