import { AnimatePresence, motion } from 'framer-motion';
import type { GameState, RoundResultReason } from '@moon21/shared';
import { useGameStore } from '../store/useGameStore';

const REASON_TEXT: Record<RoundResultReason, string> = {
  blackjack: '黑杰克！恰好 21 点',
  closest: '点数最接近 21',
  tie: '点数相同，平局',
  allBust: '全员爆牌，无人获胜',
};

export function ResultOverlay({ game }: { game: GameState }) {
  const nextRound = useGameStore((s) => s.nextRound);
  const backToMenu = useGameStore((s) => s.backToMenu);

  const isOver = game.phase === 'gameOver';
  const result = game.roundResult;
  if (game.phase !== 'roundEnd' && game.phase !== 'gameOver') return null;
  if (!result) return null;

  const winnerNames = result.winnerIds.map((id) => game.players.find((p) => p.id === id)?.name).join('、');

  return (
    <AnimatePresence>
      <motion.div
        className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <motion.div
          className="card-face gold-frame rounded-2xl p-8 w-[24rem] text-center shadow-gold-lg"
          initial={{ scale: 0.7, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: 'spring', damping: 18, stiffness: 220 }}
        >
          <div className="text-4xl mb-2">{result.winnerIds.length ? '✦' : '✧'}</div>
          <h2 className="font-display text-2xl text-gold tracking-widest mb-1">
            {isOver ? '对局结束' : winnerNames ? `${winnerNames} 获胜` : '本局无胜者'}
          </h2>
          <p className="text-parchment/70 text-sm mb-4">{REASON_TEXT[result.reason]}</p>

          <div className="space-y-1.5 mb-5 text-sm">
            {game.players.map((p) => {
              const isWin = result.winnerIds.includes(p.id);
              return (
                <div key={p.id} className="flex justify-between px-4 py-1 rounded gold-frame">
                  <span className={isWin ? 'text-gold' : ''}>
                    {p.name}
                    {isWin ? '  ✦' : ''}
                  </span>
                  <span className={p.status === 'busted' ? 'text-crimson' : 'text-parchment'}>
                    {p.score} 点
                    {game.config.mode === 'stake'
                      ? ` · 币 ${p.coins}`
                      : game.config.mode !== 'duel'
                        ? ` · 积分 ${game.points[p.id] ?? 0}`
                        : ` · 局分 ${game.points[p.id] ?? 0}`}
                  </span>
                </div>
              );
            })}
          </div>

          {isOver ? (
            <div className="text-gold mb-4">
              总冠军：<span className="font-display text-xl">{game.winnerIds.map((id) => game.players.find((p) => p.id === id)?.name).join('、')}</span>
            </div>
          ) : null}

          <div className="flex justify-center gap-4">
            {!isOver && (
              <button
                className="px-6 py-2 rounded-lg font-display tracking-widest gold-frame text-gold hover:bg-brass/15 active:scale-95 transition"
                onClick={nextRound}
              >
                下一轮
              </button>
            )}
            <button
              className="px-6 py-2 rounded-lg font-display tracking-widest gold-frame text-parchment hover:bg-brass/15 active:scale-95 transition"
              onClick={backToMenu}
            >
              返回主菜单
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
