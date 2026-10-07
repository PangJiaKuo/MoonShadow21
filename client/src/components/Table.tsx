import { useEffect, useState } from 'react';
import type { CardInstance } from '@moon21/shared';
import { chooseAction } from '@moon21/engine';
import { useGameStore } from '../store/useGameStore';
import { PlayerArea } from './PlayerArea';
import { ActionBar } from './ActionBar';
import { ResultOverlay } from './ResultOverlay';
import { PendingModal } from './PendingModal';
import { CardDetailModal } from './CardDetailModal';

export function Table() {
  const game = useGameStore((s) => s.game)!;
  const online = useGameStore((s) => s.online);
  const aiPlayerId = useGameStore((s) => s.aiPlayerId);
  const myEngineId = useGameStore((s) => s.myEngineId);
  const dispatch = useGameStore((s) => s.dispatch);
  const inReveal = game.phase !== 'playing';
  const [inspected, setInspected] = useState<{ card: CardInstance; owner: string } | null>(null);

  // 人机对战：轮到 AI 时自动派发决策
  useEffect(() => {
    if (!aiPlayerId || online) return;
    const ai = game.players.find((p) => p.id === aiPlayerId);
    const aiTurn = ai?.isTurn && game.phase === 'playing' && ai?.status === 'active';
    const aiPending = game.pending?.playerId === aiPlayerId;
    if (!aiTurn && !aiPending) return;
    const action = chooseAction(game, aiPlayerId);
    if (!action) return;
    const t = setTimeout(() => dispatch(action), 650);
    return () => clearTimeout(t);
  }, [game, aiPlayerId, online, dispatch]);

  // 自己放在底部，其余玩家放顶部（联机/人机按我的座位定位；热座 p0 为底部）
  let bottom: typeof game.players[number];
  let others: typeof game.players[number][];
  if (myEngineId) {
    bottom = game.players.find((p) => p.id === myEngineId) ?? game.players[0];
    others = game.players.filter((p) => p.id !== bottom.id);
  } else {
    bottom = game.players[0];
    others = game.players.slice(1);
  }
  // 联机/人机时自己看自己全部牌、对手暗牌保密；热座同屏按当前行动者翻开
  const solo = myEngineId !== null;
  const isStake = game.config.mode === 'stake';
  // 每个人只能看到自己这一方的总点数；对手总点数隐藏（明牌牌面仍可见，结算揭晓）
  const canSeeScore = (p: (typeof game.players)[number]) =>
    solo ? p.id === bottom.id || inReveal : p.isTurn || inReveal;

  return (
    <div className="relative flex flex-col h-screen p-3 gap-2 max-w-5xl mx-auto">
      {/* 顶栏 */}
      <header className="flex items-center justify-between gold-frame rounded-lg px-4 py-2 bg-felt/60">
        <h1 className="font-display text-gold tracking-[0.25em]">月影二十一</h1>
        <div className="text-sm text-parchment/80">
          第 <span className="text-gold">{game.round}</span> 轮
        </div>
        <div className="flex items-center gap-2">
          <span className="w-6 h-9 card-back rounded gold-frame flex items-center justify-center text-brass text-[10px]">✦</span>
          <span className="text-xs text-parchment/60">剩 {game.deck.length} 张</span>
        </div>
      </header>

      {/* 对手区 */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 items-start justify-center">
        {others.map((p) => (
          <PlayerArea
            key={p.id}
            player={p}
            faceUp={solo ? inReveal : p.isTurn || inReveal}
            align="top"
            showScore={canSeeScore(p)}
            showCoins={isStake}
            onInspect={(c) => setInspected({ card: c, owner: p.name })}
          />
        ))}
      </div>

      {/* 中央牌堆区 */}
      <div className="flex-1 flex items-center justify-center">
        <div className="w-24 h-36 card-back rounded-xl gold-frame flex flex-col items-center justify-center gap-1 shadow-gold">
          <span className="text-gold text-3xl">✦</span>
          <span className="text-xs text-parchment/60">{game.deck.length} 张</span>
        </div>
      </div>

      {/* 本家区 */}
      <PlayerArea
        player={bottom}
        faceUp={solo ? true : bottom.isTurn || inReveal}
        align="bottom"
        showScore={canSeeScore(bottom)}
        showCoins={isStake}
        onInspect={(c) => setInspected({ card: c, owner: bottom.name })}
      />

      {/* 操作栏 */}
      <div className="h-16 flex items-center justify-center">
        <ActionBar game={game} />
      </div>

      {/* 结算浮层 */}
      <ResultOverlay game={game} />

      {/* 特殊卡效果决策模态框 */}
      <PendingModal game={game} />

      {/* 点击特殊卡查看技能详情 */}
      {inspected && (
        <CardDetailModal card={inspected.card} ownerName={inspected.owner} onClose={() => setInspected(null)} />
      )}
    </div>
  );
}
