import { motion } from 'framer-motion';
import type { CardInstance, EffectTrigger, EffectType } from '@moon21/shared';

const TRIGGER_ZH: Record<EffectTrigger, string> = {
  OnDraw: '抽到时',
  OnReveal: '亮牌时',
  OnStand: '停牌时',
  OnCompare: '比点时',
  OnRoundEnd: '回合结束时',
  Passive: '被动',
};

const TYPE_ZH: Record<EffectType, string> = {
  adjustValue: '调整点数',
  swapCard: '互换手牌',
  redraw: '弃牌重抽',
  negate: '压制对手',
  split: '拆分',
  discardRedraw: '弃牌重抽（停牌）',
  doubleOrNothing: '加倍',
  forceRedraw: '强制重抽',
  fixedValue: '固定点数',
  raise: '加注',
};

const RARITY_ZH: Record<string, { tag: string; text: string; ring: string }> = {
  common: { tag: '普通', text: 'text-parchment/80', ring: 'ring-parchment/40' },
  rare: { tag: '稀有', text: 'text-sky-300', ring: 'ring-sky-400/70' },
  epic: { tag: '史诗', text: 'text-purple-300', ring: 'ring-purple-400/70' },
  legendary: { tag: '传说', text: 'text-amber-300', ring: 'ring-amber-400/80' },
};

interface Props {
  card: CardInstance;
  ownerName: string;
  onClose: () => void;
}

export function CardDetailModal({ card, ownerName, onClose }: Props) {
  const rarity = card.rarity ? RARITY_ZH[card.rarity] : undefined;
  const trigger = card.effectTrigger ? TRIGGER_ZH[card.effectTrigger] : undefined;
  const type = card.effectType ? TYPE_ZH[card.effectType] : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <motion.div
        className={`w-full max-w-sm gold-frame rounded-xl bg-felt/95 p-6 shadow-gold ${rarity?.ring ?? ''} ring-1`}
        initial={{ opacity: 0, scale: 0.9, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 12 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 卡名 + 稀有度 */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <h3 className="font-display tracking-[0.2em] text-gold text-xl">「{card.name}」</h3>
          <span className={`px-2 py-0.5 rounded-full border text-xs ${rarity?.text ?? 'text-parchment/70'} border-current`}>
            {rarity?.tag ?? ''}
          </span>
        </div>

        {/* 基础信息 */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-4">
          <div>
            <div className="text-parchment/50 text-xs">所属系列</div>
            <div className="text-parchment">{card.series ?? '—'}</div>
          </div>
          <div>
            <div className="text-parchment/50 text-xs">持有者</div>
            <div className="text-parchment">{ownerName}</div>
          </div>
          <div>
            <div className="text-parchment/50 text-xs">触发时机</div>
            <div className="text-parchment">{trigger ?? '—'}</div>
          </div>
          <div>
            <div className="text-parchment/50 text-xs">效果类型</div>
            <div className="text-parchment">{type ?? '—'}</div>
          </div>
        </div>

        {/* 效果描述 */}
        <div className="gold-frame rounded-lg px-3 py-2 bg-black/30 mb-5">
          <div className="text-parchment/50 text-xs mb-1">技能详情</div>
          <div className="text-parchment text-sm leading-relaxed">
            {card.description ?? '（暂无描述）'}
          </div>
        </div>

        <button
          className="w-full rounded-lg border border-gold/60 py-2 text-gold hover:bg-gold/10 transition-colors text-sm tracking-widest"
          onClick={onClose}
        >
          关闭
        </button>
      </motion.div>
    </div>
  );
}
