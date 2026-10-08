/**
 * 回归测试：特殊卡效果不应被"爆牌自动停牌"吞掉。
 *
 * 修复点：hit / setValue 之后统一走 settlePlayerEffects 效果结算状态机，
 * 先结算 OnDraw 特殊卡（玩家可用效果调点数），再判爆牌。
 * 过去：抽到特殊卡导致总点数 > 21 时，会先自动停牌并推进回合，效果框不弹。
 */
import { describe, expect, it } from 'vitest';
import type { CardInstance, GameState } from '@moon21/shared';
import { buildDeckDefs } from '../src/cards';
import { apply } from '../src/game';
import { makeSpecialCard } from '../src/effects';

const DEFS = buildDeckDefs();
let uid = 0;
function card(defId: string, value: number): CardInstance {
  const d = DEFS.find((x) => x.id === defId)!;
  uid += 1;
  return {
    uid: `t${uid}`,
    defId,
    name: d.name,
    suit: d.suit,
    rank: d.rank,
    value,
    faceDown: true,
    pendingValue: false,
  };
}

function makeGame(handA: CardInstance[], deck: CardInstance[]): GameState {
  return {
    id: 'test',
    config: {
      playerCount: 2,
      targetScore: 21,
      winPoints: 3,
      mode: 'duel',
      enableRoyals: false,
      enableSpecialCards: true,
    },
    phase: 'playing',
    deck,
    players: [
      {
        id: 'p0',
        name: 'A',
        seat: 0,
        hand: handA,
        score: 0,
        status: 'active',
        isTurn: true,
        isHost: true,
        turnStage: 'awaitingAction',
        flags: { unresolvedDraw: [], mustHit: false, doubled: false, used: {} },
        coins: 10,
        bet: 0,
      },
      {
        id: 'p1',
        name: 'B',
        seat: 1,
        hand: [],
        score: 0,
        status: 'active',
        isTurn: false,
        isHost: false,
        turnStage: 'stood',
        flags: { unresolvedDraw: [], mustHit: false, doubled: false, used: {} },
        coins: 10,
        bet: 0,
      },
    ],
    currentPlayerIndex: 0,
    round: 1,
    points: { p0: 0, p1: 0 },
    pot: 0,
    winnerIds: [],
    eliminatedIds: [],
    log: [],
  };
}

describe('修复：抽到特殊卡导致爆牌时先弹效果框（不被吞）', () => {
  it('手牌 20 摸到银月(2点 OnDraw)，本会爆牌但应先弹效果框 pending', () => {
    // 手牌 10 + 10 = 20，牌堆顶是银月（OnDraw / adjustValue）
    const g = makeGame([card('sun_10', 10), card('moon_10', 10)], [makeSpecialCard('silver_moon', true)]);
    const out = apply(g, { type: 'hit', playerId: 'p0' });
    // 修复后：先结算 OnDraw 特殊卡 → 产生效果框 pending，而不是直接爆牌推进
    expect(out.pending).toBeTruthy();
    const p0 = out.players.find((p) => p.id === 'p0')!;
    expect(p0.status).toBe('active'); // 未直接爆牌自动停牌
    expect(p0.turnStage).toBe('awaitingChoice'); // 已进入效果结算状态机
  });

  it('不使用效果时，该特殊卡按 0 点结算', () => {
    const g = makeGame([card('sun_10', 10), card('moon_10', 10)], [makeSpecialCard('silver_moon', true)]);
    const hit = apply(g, { type: 'hit', playerId: 'p0' });
    const pd = hit.pending!;
    expect(pd.effectType).toBe('adjustValue');
    const out = apply(hit, { type: 'resolveChoice', playerId: 'p0', decisionId: pd.id, optionId: 'skip' });
    expect(out.pending).toBeFalsy();
    const p0 = out.players.find((p) => p.id === 'p0')!;
    // 不使用效果：特殊卡按 0 点，总分回到 20（不爆）
    expect(p0.score).toBe(20);
  });
});
