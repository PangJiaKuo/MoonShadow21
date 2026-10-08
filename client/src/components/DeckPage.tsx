import { useEffect, useState } from 'react';
import type { CollectionCard, DeckCard } from '@moon21/shared';
import { buildBaseDeckDefs } from '@moon21/engine';
import { api } from '../net/api';
import { useAuthStore } from '../store/useAuthStore';
import { useGameStore } from '../store/useGameStore';
import { CARD_ART, SUIT_ART } from '../cardArt';

const RARITY: Record<string, { tag: string; text: string; ring: string }> = {
  common: { tag: '普通', text: 'text-parchment/70', ring: 'ring-parchment/40' },
  rare: { tag: '稀有', text: 'text-sky-300', ring: 'ring-sky-400/70' },
  epic: { tag: '史诗', text: 'text-purple-300', ring: 'ring-purple-400/70' },
  legendary: { tag: '传说', text: 'text-amber-300', ring: 'ring-amber-400/80' },
};
const SUIT_ICON: Record<string, string> = { sun: '☀', moon: '🌙', star: '⭐', flower: '🌸' };

/** 阶段 4.5：卡组（每人独立 52 张）+ 已拥有特殊卡，点击同点数牌装备替换。 */
export function DeckPage() {
  const token = useAuthStore((s) => s.token);
  const setScreen = useGameStore((s) => s.setScreen);
  const [deckCards, setDeckCards] = useState<DeckCard[]>([]);
  const [ownedCards, setOwnedCards] = useState<CollectionCard[]>([]);
  const [selected, setSelected] = useState<CollectionCard | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(!!token);

  const load = () => {
    if (!token) {
      setDeckCards(
        buildBaseDeckDefs().map((d) => ({ cardId: d.id, name: d.name, suit: d.suit, rank: d.rank, value: d.baseValue, base: true })),
      );
      return;
    }
    setLoading(true);
    setError('');
    Promise.all([api.deck(token), api.collection(token)])
      .then(([d, c]) => {
        setDeckCards(d.cards);
        setOwnedCards(c.cards);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  };
  useEffect(load, [token]);

  const inDeck = (id: string) => deckCards.some((c) => c.cardId === id);
  const specialCount = deckCards.filter((c) => !c.base).length;

  const equip = async (target: DeckCard) => {
    if (!token || !selected) return;
    setMsg('');
    try {
      const r = await api.equip(token, { cardId: selected.cardId, targetCardId: target.cardId });
      if (r.ok) {
        if (r.cards) setDeckCards(r.cards);
        setSelected(null);
        setMsg(`已将「${selected.name}」（${selected.baseValue} 点）放入卡组，替换了一张 ${selected.baseValue} 点的牌`);
      } else {
        setMsg(r.error ?? '装备失败');
      }
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  const canTarget = (card: DeckCard) => !!selected && card.value === selected.baseValue;

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-display tracking-[0.25em] text-gold text-xl">卡组</h1>
            <div className="text-[11px] text-parchment/50 mt-1">
              {token
                ? `共 ${deckCards.length} 张 · 已放入特殊卡 ${specialCount} 张 · 每人独立、抽牌不重复`
                : '基础 52 张 · 登录后可购买特殊卡，点击装备替换进卡组'}
            </div>
          </div>
          <div className="flex gap-2">
            {token && (
              <button
                className="px-4 py-1.5 rounded-lg gold-frame text-gold text-sm hover:bg-brass/15 transition"
                onClick={() => setScreen('shop')}
              >
                商城
              </button>
            )}
            <button
              className="px-4 py-1.5 rounded-lg gold-frame text-parchment text-sm hover:bg-brass/15 transition"
              onClick={() => setScreen('menu')}
            >
              ← 返回主菜单
            </button>
          </div>
        </div>

        {msg && (
          <div className="mb-3 text-center text-sm border border-brass/40 rounded-lg px-3 py-2 text-gold">{msg}</div>
        )}
        {error && <div className="text-crimson text-center py-8">{error}</div>}

        {loading ? (
          <div className="text-center text-parchment/50 py-12">加载中…</div>
        ) : (
          <>
            {/* 已拥有特殊卡区 */}
            {token && (
              <div className="mb-8">
                <h2 className="font-display tracking-[0.2em] text-gold text-sm mb-3">已拥有特殊卡</h2>
                {selected && (
                  <div className="mb-3 flex items-center justify-center gap-3 text-sm border border-brass/50 rounded-lg px-3 py-2 bg-abyss">
                    <span className="text-gold">已选中「{selected.name}」（{selected.baseValue} 点）</span>
                    <span className="text-parchment/60">点击下方卡组中同点数的牌替换</span>
                    <button
                      onClick={() => setSelected(null)}
                      className="px-2 py-0.5 rounded gold-frame text-parchment text-xs hover:bg-brass/15 transition"
                    >
                      取消
                    </button>
                  </div>
                )}
                {ownedCards.length === 0 ? (
                  <div className="text-parchment/50 text-sm">
                    暂无已拥有的特殊卡，去「商城」购买后即可装备。
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 gap-2.5">
                    {ownedCards.map((c) => {
                      const r = RARITY[c.rarity];
                      const isIn = inDeck(c.cardId);
                      const isSelected = selected?.cardId === c.cardId;
                      return (
                        <div
                          key={c.cardId}
                          className={`card-face relative overflow-hidden rounded-lg p-2.5 gold-frame ring-1 flex flex-col items-center ${r?.ring ?? 'ring-amber-400/80'} ${isSelected ? 'ring-2 ring-brass bg-brass/10' : ''}`}
                        >
                          <img
                            src={CARD_ART[c.cardId] ?? '/cards/silver_moon.jpg'}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover"
                            draggable={false}
                          />
                          <div className="absolute inset-0 bg-abyss/40" />
                          <div className="relative z-10 w-full flex flex-col items-center">
                            <span className="font-display text-gold text-sm leading-tight text-center">「{c.name}」</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full border border-current mt-1 ${r?.text ?? ''}`}>
                              {r?.tag ?? ''}
                            </span>
                            <span className="text-[10px] text-parchment/50 mt-0.5">{c.baseValue} 点</span>
                            <button
                              onClick={() => setSelected(isIn ? null : isSelected ? null : c)}
                              disabled={isIn}
                              className={`mt-1.5 w-full py-1 rounded-md text-[11px] transition ${
                                isIn
                                  ? 'bg-felt text-parchment/40 cursor-not-allowed'
                                  : isSelected
                                    ? 'bg-brass text-abyss'
                                    : 'gold-frame text-gold hover:bg-brass/20'
                              }`}
                            >
                              {isIn ? '已在卡组' : isSelected ? '已选中' : '装备'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 卡组区 */}
            <h2 className="font-display tracking-[0.2em] text-gold text-sm mb-3">
              我的卡组（{deckCards.length}）
              {selected && <span className="ml-2 text-[11px] text-parchment/60">→ 高亮的是可替换目标</span>}
            </h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
              {deckCards.map((c) => {
                const r = c.rarity ? RARITY[c.rarity] : undefined;
                const t = canTarget(c);
                return (
                  <div
                    key={c.cardId}
                    onClick={() => t && equip(c)}
                    title={t ? `点击替换为「${selected!.name}」` : undefined}
                    className={`card-face relative overflow-hidden rounded-lg p-2.5 gold-frame ring-1 flex flex-col items-center transition ${
                      c.base ? 'ring-parchment/20' : `ring-1 ${r?.ring ?? 'ring-amber-400/80'}`
                    } ${t ? 'ring-2 ring-brass bg-brass/10 cursor-pointer hover:scale-105' : ''}`}
                  >
                    {(() => {
                      const art = c.base ? SUIT_ART[c.suit] : CARD_ART[c.cardId] ?? '/cards/silver_moon.jpg';
                      if (!art) return null;
                      return (
                        <>
                          <img
                            src={art}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover"
                            draggable={false}
                          />
                          <div className="absolute inset-0 bg-abyss/40" />
                        </>
                      );
                    })()}
                    <div className="relative z-10 w-full flex flex-col items-center">
                      {c.base ? (
                        <>
                          <span className="text-lg leading-none">{SUIT_ICON[c.suit] ?? ''}</span>
                          <span className="font-display text-gold text-lg mt-0.5">{c.rank}</span>
                          <span className="text-[10px] text-parchment/50">{c.value} 点</span>
                        </>
                      ) : (
                        <>
                          <span className="font-display text-gold text-sm leading-tight text-center">「{c.name}」</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full border border-current mt-1 ${r?.text ?? ''}`}>
                            {r?.tag ?? ''}
                          </span>
                          <span className="text-[10px] text-parchment/50 mt-0.5">{c.value} 点</span>
                        </>
                      )}
                      {t && <span className="mt-1 text-[10px] text-brass">可替换</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
