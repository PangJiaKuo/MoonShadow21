import { useState } from 'react';
import type { GameState } from '@moon21/shared';
import { useGameStore } from '../store/useGameStore';

export function ActionBar({ game }: { game: GameState }) {
  const dispatch = useGameStore((s) => s.dispatch);
  const myEngineId = useGameStore((s) => s.myEngineId);
  const current = game.players[game.currentPlayerIndex];
  const pending = current.hand.find((c) => c.pendingValue);
  // 可行动：轮到我（myEngineId 为空 = 本地热座可操作任意行动者）
  const canAct =
    game.phase === 'playing' &&
    current.status === 'active' &&
    current.isTurn &&
    (myEngineId === null || current.id === myEngineId);
  const [val, setVal] = useState(0);

  const btn =
    'px-6 py-2 rounded-lg font-display tracking-widest gold-frame text-gold hover:bg-brass/15 active:scale-95 transition';

  // 抽到皇帝/皇后：先选择点数（0-13）
  if (pending && canAct) {
    return (
      <div className="gold-frame rounded-xl px-4 py-3 flex items-center gap-4">
        <span className="text-sm">
          为「{pending.name}」设定点数
        </span>
        <input
          type="range"
          min={0}
          max={13}
          value={val}
          onChange={(e) => setVal(Number(e.target.value))}
          className="flex-1 accent-brass"
        />
        <span className="text-gold text-xl w-8 text-center">{val}</span>
        <button
          className={btn}
          onClick={() =>
            dispatch({ type: 'setValue', playerId: current.id, uid: pending.uid, value: val })
          }
        >
          确认
        </button>
      </div>
    );
  }

  if (game.phase !== 'playing') {
    return <div className="text-center text-parchment/50 text-sm">本轮已结算</div>;
  }

  if (!canAct) {
    return (
      <div className="text-center text-parchment/60 text-sm">
        等待 <span className="text-gold">{current.name}</span> 行动…
      </div>
    );
  }

  return (
    <div className="flex justify-center gap-4">
      <button
        className={btn}
        onClick={() => dispatch({ type: 'hit', playerId: current.id })}
      >
        抽牌
      </button>
      <button
        className={btn}
        onClick={() => dispatch({ type: 'stand', playerId: current.id })}
      >
        停牌
      </button>
    </div>
  );
}
