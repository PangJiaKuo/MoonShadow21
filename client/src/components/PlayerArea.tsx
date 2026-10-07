import { motion } from 'framer-motion';
import type { CardInstance, PlayerState } from '@moon21/shared';
import { CardView } from './CardView';

interface Props {
  player: PlayerState;
  faceUp: boolean;
  align: 'top' | 'bottom';
  showScore: boolean;
  showCoins?: boolean;
  onInspect?: (card: CardInstance) => void;
}

const STATUS_BADGE: Record<PlayerState['status'], { text: string; cls: string }> = {
  active: { text: '行动中', cls: 'text-gold border-gold/60' },
  stood: { text: '停牌', cls: 'text-parchment/70 border-parchment/40' },
  busted: { text: '爆牌', cls: 'text-crimson border-crimson/60' },
};

export function PlayerArea({ player, faceUp, align, showScore, showCoins, onInspect }: Props) {
  const isActive = player.status === 'active';
  const statusText = isActive
    ? player.isTurn
      ? '行动中'
      : '等待中'
    : STATUS_BADGE[player.status].text;
  const statusCls = isActive
    ? player.isTurn
      ? STATUS_BADGE.active.cls
      : 'text-parchment/50 border-parchment/30'
    : STATUS_BADGE[player.status].cls;
  const scoreColor =
    player.status === 'busted' ? 'text-crimson' : player.score > 18 ? 'text-ember' : 'text-gold';

  const info = (
    <div className="flex items-center gap-3">
      <span className="font-display tracking-wider text-sm">{player.name}</span>
      <span className={`px-2 py-0.5 rounded-full border text-xs ${statusCls}`}>{statusText}</span>
      <span className="text-sm">
        点数 <span className={`font-bold text-lg ${scoreColor}`}>{showScore ? player.score : '?'}</span>
        <span className="text-parchment/40"> / 21</span>
      </span>
      {showCoins && (
        <span className="text-xs text-brass">币 {player.coins} · 投 {player.bet}</span>
      )}
    </div>
  );

  return (
    <div className={`flex flex-col gap-2 ${align === 'bottom' ? '' : 'items-end'}`}>
      {align === 'top' && info}
      <motion.div
        className="flex gap-1.5"
        initial={false}
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.08 } } }}
      >
        {player.hand.map((c) => (
          <motion.div key={c.uid} variants={{ show: { opacity: 1, y: 0 }, hidden: { opacity: 0, y: -18 } }} initial="hidden" animate="show">
            <CardView card={c} faceUp={faceUp || !c.faceDown} size={align === 'top' ? 'sm' : 'md'} onInspect={onInspect} />
          </motion.div>
        ))}
      </motion.div>
      {align === 'bottom' && info}
    </div>
  );
}
