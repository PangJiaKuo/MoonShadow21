import { useState } from 'react';
import { motion } from 'framer-motion';
import type { GameState } from '@moon21/shared';
import { useGameStore } from '../store/useGameStore';

/**
 * 特殊卡效果决策模态框。
 * 当 engine 需要玩家选择（选点数/选目标/确认加倍等）时弹出，提交 resolveChoice。
 */
export function PendingModal({ game }: { game: GameState }) {
  const dispatch = useGameStore((s) => s.dispatch);
  const pending = game.pending;
  const [raiseAmt, setRaiseAmt] = useState(0);
  if (!pending) return null;

  // 积分赛加注：输入加注数（0 至持有币数）
  if (pending.kind === 'raise') {
    const max = pending.max ?? 0;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-abyss/80 backdrop-blur-sm p-4">
        <motion.div
          className="card-face gold-frame rounded-2xl p-6 w-full max-w-md shadow-gold flex flex-col gap-4"
          initial={{ opacity: 0, scale: 0.92, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <h2 className="font-display text-xl text-gold tracking-widest text-center">{pending.title}</h2>
          <p className="text-parchment/70 text-sm text-center">{pending.description}</p>
          <input
            type="number"
            min={0}
            max={max}
            value={raiseAmt}
            onChange={(e) => setRaiseAmt(Math.max(0, Math.min(max, Number(e.target.value) || 0)))}
            className="bg-felt gold-frame rounded-lg px-3 py-2 text-center text-gold font-display focus:outline-none focus:ring-1 focus:ring-brass"
          />
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => dispatch({ type: 'resolveChoice', playerId: pending.playerId, decisionId: pending.id, optionId: 'none' })}
              className="px-4 py-2 rounded-lg font-display tracking-wider text-sm gold-frame text-parchment/70 hover:bg-brass/20 active:scale-95 transition"
            >
              不加注
            </button>
            <button
              onClick={() => dispatch({ type: 'resolveChoice', playerId: pending.playerId, decisionId: pending.id, optionId: 'amount', value: raiseAmt })}
              className="px-4 py-2 rounded-lg font-display tracking-wider text-sm gold-frame text-gold hover:bg-brass/20 active:scale-95 transition"
            >
              确认加注 {raiseAmt} 币
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-abyss/80 backdrop-blur-sm p-4">
      <motion.div
        className="card-face gold-frame rounded-2xl p-6 w-full max-w-md shadow-gold flex flex-col gap-4"
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <h2 className="font-display text-xl text-gold tracking-widest text-center">{pending.title}</h2>
        <p className="text-parchment/70 text-sm text-center">{pending.description}</p>

        <div className="flex flex-wrap gap-2 justify-center">
          {pending.options.map((o) => (
            <button
              key={o.id}
              onClick={() =>
                dispatch({
                  type: 'resolveChoice',
                  playerId: pending.playerId,
                  decisionId: pending.id,
                  optionId: o.id,
                  value: o.value,
                })
              }
              className="px-4 py-2 rounded-lg font-display tracking-wider text-sm gold-frame text-gold hover:bg-brass/20 active:scale-95 transition"
            >
              {o.label}
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
