import { useEffect, useState } from 'react';
import type { ShopItem } from '@moon21/shared';
import { api } from '../net/api';
import { useAuthStore } from '../store/useAuthStore';
import { useGameStore } from '../store/useGameStore';
import { CARD_ART } from '../cardArt';

const RARITY: Record<string, { tag: string; text: string; ring: string }> = {
  common: { tag: '普通', text: 'text-parchment/70', ring: 'ring-parchment/40' },
  rare: { tag: '稀有', text: 'text-sky-300', ring: 'ring-sky-400/70' },
  epic: { tag: '史诗', text: 'text-purple-300', ring: 'ring-purple-400/70' },
  legendary: { tag: '传说', text: 'text-amber-300', ring: 'ring-amber-400/80' },
};

/** 阶段 4.5：商城 —— 用金币购买特殊卡，替换卡组中同点数普通卡。 */
export function ShopPage() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const hydrate = useAuthStore((s) => s.hydrate);
  const setScreen = useGameStore((s) => s.setScreen);
  const [items, setItems] = useState<ShopItem[]>([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(!!token);
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    if (!token) return;
    let alive = true;
    api
      .shop(token)
      .then((r) => alive && setItems(r.items))
      .catch((e) => alive && setError((e as Error).message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [token]);

  const buy = async (cardId: string) => {
    if (!token) return;
    setBusyId(cardId);
    setMsg('');
    try {
      const r = await api.buy(token, cardId);
      if (r.ok) {
        setItems((prev) => prev.map((i) => (i.cardId === cardId ? { ...i, owned: true } : i)));
        setMsg(`购买成功！已拥有该特殊卡，可到「卡组」页点击装备替换同点数牌。余额 ${r.coins} 金币`);
        hydrate(); // 刷新菜单金币
      } else {
        setMsg(r.error ?? '购买失败');
      }
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-display tracking-[0.25em] text-gold text-xl">商城</h1>
            {token && user && (
              <div className="text-[11px] text-parchment/50 mt-1">金币余额：{user.coins}</div>
            )}
          </div>
          <button
            className="px-4 py-1.5 rounded-lg gold-frame text-parchment text-sm hover:bg-brass/15 transition"
            onClick={() => setScreen('menu')}
          >
            ← 返回主菜单
          </button>
        </div>

        {!token ? (
          <div className="text-center text-parchment/60 py-16">
            请先登录（主菜单「登录 / 注册」）后再购买特殊卡
            <br />
            <button className="mt-4 px-4 py-2 gold-frame text-gold text-sm" onClick={() => setScreen('auth')}>
              去登录
            </button>
          </div>
        ) : error ? (
          <div className="text-crimson text-center py-8">{error}</div>
        ) : loading ? (
          <div className="text-center text-parchment/50 py-12">加载中…</div>
        ) : (
          <>
            {msg && (
              <div className="mb-4 text-center text-sm border border-brass/40 rounded-lg px-3 py-2 text-gold">{msg}</div>
            )}
            <p className="text-[11px] text-parchment/50 mb-4 text-center">
              购买后特殊卡进入你的卡组，替换一张「同点数」的普通卡。单价 <span className="text-gold">100 金币</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {items.map((c) => {
                const r = RARITY[c.rarity];
                return (
                  <div key={c.cardId} className={`card-face relative overflow-hidden rounded-xl p-4 gold-frame ring-1 ${r?.ring ?? 'ring-parchment/30'}`}>
                    {CARD_ART[c.cardId] && (
                      <>
                        <img src={CARD_ART[c.cardId]} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
                        <div className="absolute inset-0 bg-abyss/40" />
                      </>
                    )}
                    <div className="relative z-10">
                      <div className="flex items-start justify-between mb-1">
                        <div>
                          <span className="font-display text-gold text-base">「{c.name}」</span>
                          <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full border border-current ${r?.text ?? ''}`}>
                            {r?.tag ?? ''}
                          </span>
                        </div>
                        <span className="text-sm text-gold whitespace-nowrap">{c.price} 金币</span>
                      </div>
                      <div className="text-[10px] text-parchment/50 mb-1">
                        {c.series} · {c.value} 点
                      </div>
                      <div className="text-[12px] text-parchment/80 leading-snug min-h-[2.5rem]">{c.description ?? '—'}</div>
                      <button
                        onClick={() => buy(c.cardId)}
                        disabled={c.owned || busyId === c.cardId}
                        className={`mt-2 w-full py-2 rounded-lg text-sm font-display tracking-widest transition ${
                          c.owned ? 'bg-felt text-parchment/40 cursor-not-allowed' : 'gold-frame text-gold hover:bg-brass/20 active:scale-95'
                        }`}
                      >
                        {c.owned ? '已在卡组' : busyId === c.cardId ? '购买中…' : '购买并放入卡组'}
                      </button>
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
