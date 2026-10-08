import { motion } from 'framer-motion';
import type { CardInstance } from '@moon21/shared';
import { royalIcon, SUIT_META } from './suitIcon';
import { CARD_ART, SUIT_ART } from '../cardArt';

interface Props {
  card: CardInstance;
  /** true=显示正面（自己的明牌、翻开的暗牌）；false=显示牌背 */
  faceUp: boolean;
  size?: 'sm' | 'md';
  /** 点击特殊卡查看技能详情（仅特殊卡明牌触发） */
  onInspect?: (card: CardInstance) => void;
}

/**
 * 稀有度样式（Tailwind 需静态完整类名）
 */
const RARITY: Record<string, { color: string; ring: string; tag: string }> = {
  common: { color: 'text-parchment/80', ring: 'ring-parchment/30', tag: '普通' },
  rare: { color: 'text-sky-300', ring: 'ring-sky-400/70', tag: '稀有' },
  epic: { color: 'text-purple-300', ring: 'ring-purple-400/70', tag: '史诗' },
  legendary: { color: 'text-amber-300', ring: 'ring-amber-400/80', tag: '传说' },
};

/**
 * 卡牌：翻转动画用 rotateY，但两面用 opacity 显式控制可见性。
 * 不依赖 backface-visibility（在 3D 上下文被压平时会失效，导致暗牌内容泄漏）。
 * opacity 保证非当前朝向的一面完全不可见，信息永不泄漏。
 */
export function CardView({ card, faceUp, size = 'md', onInspect }: Props) {
  const dims = size === 'sm' ? 'w-11 h-16' : 'w-16 h-24';
  const meta = SUIT_META[card.suit];
  const isSpecial = Boolean(card.rarity);
  const isRoyal = card.suit === 'special' && !isSpecial;
  const rarity = card.rarity ? RARITY[card.rarity] : undefined;
  const clickable = isSpecial && faceUp && Boolean(onInspect);

  const icon = isRoyal ? royalIcon(card.rank) : isSpecial ? '✦' : meta.icon;
  const label = isSpecial
    ? card.name.length > 2
      ? card.name.slice(0, 2)
      : card.name
    : isRoyal
      ? card.rank === 'Emperor'
        ? '皇帝'
        : '皇后'
      : card.rank;
  const valText = isSpecial
    ? String(card.value)
    : isRoyal
      ? card.pendingValue
        ? '?'
        : String(card.value)
      : String(card.value);
  const color = isSpecial ? rarity!.color : meta.color;

  return (
    <div
      className={`${dims} relative shrink-0 ${clickable ? 'cursor-pointer hover:z-10 hover:scale-105 transition-transform' : ''}`}
      style={{ perspective: 900 }}
      onClick={clickable ? () => onInspect!(card) : undefined}
    >
      <motion.div
        className="absolute inset-0"
        initial={false}
        animate={{ rotateY: faceUp ? 180 : 0 }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
      >
        {/* 牌背：faceUp 时隐藏 */}
        <motion.div
          className="card-back absolute inset-0 rounded-lg gold-frame flex items-center justify-center"
          initial={false}
          animate={{ opacity: faceUp ? 0 : 1 }}
          transition={{ duration: 0.2 }}
        >
          <span className="text-brass text-lg">✦</span>
        </motion.div>
        {/* 牌面：仅 faceUp 时显示 */}
        <motion.div
          className={`card-face absolute inset-0 rounded-lg gold-frame ${rarity?.ring ?? ''} ${isSpecial ? 'ring-2' : ''}`}
          style={{ transform: 'rotateY(180deg)' }}
          initial={false}
          animate={{ opacity: faceUp ? 1 : 0 }}
          transition={{ duration: 0.2 }}
        >
          {(() => {
            const art = isSpecial ? CARD_ART[card.defId] ?? '/cards/silver_moon.jpg' : SUIT_ART[card.suit];
            if (!art) return null;
            return (
              <>
                <img src={art} alt="" className="absolute inset-0 w-full h-full object-cover rounded-lg" draggable={false} />
                <div className="absolute inset-0 rounded-lg bg-abyss/30" />
              </>
            );
          })()}
          <div className="relative z-10 w-full h-full flex flex-col items-center justify-between px-1 py-1.5 [text-shadow:0_1px_3px_rgba(0,0,0,0.95)]">
            <div className="w-full flex justify-between items-baseline text-[0.6rem] leading-none" style={{ color }}>
              <span>{label}</span>
              <span>{valText}</span>
            </div>
            <div className="text-2xl leading-none" style={{ color }}>
              {icon}
            </div>
            <div className="w-full text-center text-[0.55rem] leading-none" style={{ color }}>
              {isSpecial
                ? `${rarity!.tag} · ${card.value}点`
                : isRoyal
                  ? card.pendingValue
                    ? '待定点数'
                    : `${card.value}点`
                  : `${card.value}点`}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
