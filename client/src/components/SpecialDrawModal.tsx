import { motion } from 'framer-motion';
import type { CardInstance, EffectTrigger, EffectType } from '@moon21/shared';
import { CARD_ART } from '../cardArt';

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

/**
 * "抽到特殊牌"展示层：抽到特殊卡时，先展示这张牌的样子（卡面）与其技能效果，
 * 玩家点"继续"后再进入效果选择/后续流程。
 */
export function SpecialDrawModal({
  card,
  ownerName,
  onContinue,
}: {
  card: CardInstance;
  ownerName: string;
  onContinue: () => void;
}) {
  const rarity = card.rarity ? RARITY_ZH[card.rarity] : undefined;
  const trigger = card.effectTrigger ? TRIGGER_ZH[card.effectTrigger] : undefined;
  const type = card.effectType ? TYPE_ZH[card.effectType] : undefined;
  const art = CARD_ART[card.defId];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <motion.div
        className={`w-full max-w-sm gold-frame rounded-2xl bg-felt/95 p-6 shadow-gold ring-1 ${rarity?.ring ?? ''} max-h-[92vh] overflow-y-auto`}
        initial={{ opacity: 0, scale: 0.85, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="text-center mb-4">
          <div className="text-gold/70 text-xs tracking-[0.4em]">✦ 抽到特殊牌 ✦</div>
        </div>

        {/* 牌的样子：卡面大图 */}
        <div className="flex justify-center mb-4">
          <div className={`relative w-40 h-56 rounded-xl gold-frame overflow-hidden ${rarity?.ring ?? ''} ring-1`}>
            {art ? (
              <img src={art} alt={card.name} className="w-full h-full object-cover" draggable={false} />
            ) : (
              <div className="w-full h-full card-face flex items-center justify-center text-gold text-3xl">✦</div>
            )}
            {/* 卡名底标 */}
            <div className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1.5 text-center">
              <span className="text-gold text-sm font-display tracking-widest">「{card.name}」</span>
            </div>
            {/* 稀有度角标 */}
            <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full bg-black/60 text-xs text-gold">
              {rarity?.tag ?? ''}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-4">
          <div>
            <div className="text-parchment/50 text-xs">点数</div>
            <div className="text-gold text-xl font-bold">{card.value}</div>
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

        <div className="gold-frame rounded-lg px-3 py-2 bg-black/30 mb-5">
          <div className="text-parchment/50 text-xs mb-1">技能效果</div>
          <div className="text-parchment text-sm leading-relaxed">
            {card.description ?? '（暂无描述）'}
          </div>
        </div>

        <button
          className="w-full rounded-lg border border-gold/60 py-2 text-gold hover:bg-gold/10 transition-colors text-sm tracking-widest"
          onClick={onContinue}
        >
          继续
        </button>
      </motion.div>
    </div>
  );
}
