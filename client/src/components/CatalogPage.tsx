import { useEffect, useState } from 'react';
import type { CollectionCard } from '@moon21/shared';
import { api } from '../net/api';
import { useAuthStore } from '../store/useAuthStore';
import { useGameStore } from '../store/useGameStore';

const RARITY: Record<string, { tag: string; text: string; ring: string }> = {
  common: { tag: '普通', text: 'text-parchment/70', ring: 'ring-parchment/40' },
  rare: { tag: '稀有', text: 'text-sky-300', ring: 'ring-sky-400/70' },
  epic: { tag: '史诗', text: 'text-purple-300', ring: 'ring-purple-400/70' },
  legendary: { tag: '传说', text: 'text-amber-300', ring: 'ring-amber-400/80' },
};

/** 阶段 4：卡牌图鉴（登录后显示拥有数量）。 */
export function CatalogPage() {
  const token = useAuthStore((s) => s.token);
  const setScreen = useGameStore((s) => s.setScreen);
  const [cards, setCards] = useState<CollectionCard[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api
      .catalog(token)
      .then((r) => alive && setCards(r.cards))
      .catch((e) => alive && setError((e as Error).message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [token]);

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display tracking-[0.25em] text-gold text-xl">卡牌图鉴</h1>
          <button
            className="px-4 py-1.5 rounded-lg gold-frame text-parchment text-sm hover:bg-brass/15 transition"
            onClick={() => setScreen('menu')}
          >
            ← 返回主菜单
          </button>
        </div>

        {error ? (
          <div className="text-crimson text-center py-8">{error}</div>
        ) : loading ? (
          <div className="text-center text-parchment/50 py-12">加载中…</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {cards.map((c) => {
              const r = RARITY[c.rarity];
              return (
                <div
                  key={c.cardId}
                  className={`card-face rounded-xl p-3 gold-frame ring-1 ${r?.ring ?? 'ring-parchment/30'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-display text-gold text-sm">「{c.name}」</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border border-current ${r?.text ?? ''}`}>
                      {r?.tag ?? ''}
                    </span>
                  </div>
                  <div className="text-[10px] text-parchment/50 mb-1">{c.series}</div>
                  <div className="text-[11px] text-parchment/80 leading-snug line-clamp-3 min-h-[2.5rem]">
                    {c.description ?? '—'}
                  </div>
                  <div className="mt-1.5 text-[11px] text-brass">
                    {token ? `拥有 ×${c.count}` : '登录查看拥有数量'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
