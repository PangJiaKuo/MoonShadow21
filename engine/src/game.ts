/**
 * 核心对局引擎（服务器权威逻辑，前端热座直接复用）。
 *
 * 设计原则：
 *  - 纯函数：apply(game, action) => 新 GameState，不可变更新，可重放、可测试。
 *  - 所有洗牌、发牌、抽牌、结算都在这里完成；客户端只发动作指令。
 *  - 皇帝/皇后（royal）抽到后点数待定，行动前必须 setValue(0-13)。
 *
 * 模式：
 *  - duel（2人）：经典对赌，每轮赢家 +1 分，轮流坐庄（先手轮换），可打多轮。
 *  - points（3-4人）：赢家 +1 分，先到 winPoints 获胜。
 *  - elimination（5-6人）：每轮淘汰爆牌者 + 点数最低者，直到剩 1 人获胜。
 */
import type {
  CardInstance,
  GameAction,
  GameConfig,
  GameState,
  PlayerState,
  PlayerTurnStage,
  PendingDecision,
  RoundResultReason,
} from '@moon21/shared';
import { buildDeckDefs, DECK_SIZE, rankValue } from './cards';
import { shuffle } from './deck';
import { SPECIAL_CARDS, SPECIAL_BY_ID } from './specialCards';
import {
  handleOnCompare,
  handleOnStand,
  makeSpecialCard,
  processUnresolvedDraw,
  resolveDecision,
} from './effects';

export interface EngineOptions {
  /** 可注入随机源（测试用） */
  rng?: () => number;
  /** 对局 id（默认随机生成） */
  id?: string;
}

let uidCounter = 0;
function nextUid(): string {
  uidCounter += 1;
  return `c${uidCounter}`;
}

export function defaultConfig(partial?: Partial<GameConfig>): GameConfig {
  return {
    playerCount: 2,
    targetScore: 21,
    winPoints: 3,
    mode: 'duel',
    enableRoyals: true,
    enableSpecialCards: true,
    ...partial,
  };
}

const DECK_DEFS = buildDeckDefs();

function makeCard(defId: string, value: number, faceDown: boolean, pendingValue: boolean): CardInstance {
  const def = DECK_DEFS.find((d) => d.id === defId)!;
  return {
    uid: nextUid(),
    defId: def.id,
    name: def.name,
    suit: def.suit,
    rank: def.rank,
    value,
    faceDown,
    pendingValue,
  };
}

function scoreOf(hand: CardInstance[]): number {
  return hand.reduce((sum, c) => sum + (c.pendingValue ? 0 : c.value), 0);
}

function hasPendingValue(player: PlayerState): boolean {
  return player.hand.some((c) => c.pendingValue);
}

export function createGame(names: string[], config?: Partial<GameConfig>, opts: EngineOptions = {}): GameState {
  const cfg = defaultConfig(config);
  const rng = opts.rng ?? Math.random;

  if (cfg.playerCount !== names.length) {
    throw new Error(`playerCount(${cfg.playerCount}) 与 names(${names.length}) 不一致`);
  }
  if (cfg.playerCount < 2 || cfg.playerCount > 8) {
    throw new Error('玩家数量需在 2-8 之间');
  }

  const game: GameState = {
    id: opts.id ?? `g${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
    config: cfg,
    phase: 'dealing',
    deck: [],
    players: names.map((name, i) => ({
      id: `p${i}`,
      name,
      seat: i,
      hand: [],
      score: 0,
      status: 'active',
      isTurn: i === 0,
      isHost: i === 0,
      turnStage: 'awaitingAction' as const,
      flags: { unresolvedDraw: [], mustHit: false, doubled: false, used: {} },
      coins: 10,
      bet: 0,
    })),
    currentPlayerIndex: 0,
    round: 1,
    points: Object.fromEntries(names.map((_, i) => [`p${i}`, 0])),
    pot: 0,
    winnerIds: [],
    eliminatedIds: [],
    log: [],
  };

  return dealNewRound(game, rng, /* rotate= */ false);
}

/** 发一轮新牌：开局每人 1 张暗牌 + 1 张特殊卡；此后摸牌均为明牌。 */
function dealNewRound(game: GameState, rng: () => number, rotate: boolean): GameState {
  // 优先使用个人卡组（per-player deck）：每玩家从自己的卡组抽牌且不重复
  const usePerDeck = !!game.config.playerDecks;
  let deck: CardInstance[] = [];
  let playerDeck: Record<string, CardInstance[]> = {};
  if (usePerDeck) {
    for (const p of game.players) {
      const ids = game.config.playerDecks![p.id] ?? [];
      const cards = ids.map((id) => {
        const base = DECK_DEFS.find((d) => d.id === id);
        if (base) return makeCard(base.id, base.kind === 'royal' ? 0 : base.baseValue, false, false);
        return makeSpecialCard(id, false);
      });
      playerDeck[p.id] = shuffle(cards, rng);
    }
  } else {
    const defs = buildDeckDefs().filter((d) => (game.config.enableRoyals ? true : d.kind !== 'royal'));
    // 特殊卡洗入牌堆，与普通牌一样可被抽到（不再开局每人发 1 张）
    const specialIds = game.config.enableSpecialCards ? SPECIAL_CARDS.map((s) => s.id) : [];
    const defDeck = shuffle([...defs.map((d) => d.id), ...specialIds], rng);
    deck = defDeck.map((id) => {
      const base = DECK_DEFS.find((d) => d.id === id);
      if (base) return makeCard(base.id, base.kind === 'royal' ? 0 : base.baseValue, false, false);
      return makeSpecialCard(id, false);
    });
  }
  const players = game.players.map((p) => ({
    ...p,
    hand: [] as CardInstance[],
    status: 'active' as const,
    score: 0,
    turnStage: 'awaitingAction' as const,
    flags: {
      unresolvedDraw: [] as string[],
      mustHit: false,
      doubled: false,
      used: {} as Record<string, boolean>,
    },
  }));

  const alive = players.filter((p) => !game.eliminatedIds.includes(p.id));
  // 开局仅发 1 张暗牌（后续摸牌全为明牌）；暗牌可能是特殊卡
  for (const p of alive) {
    const src = usePerDeck ? (playerDeck[p.id] ?? []) : deck;
    const top = src[src.length - 1];
    if (usePerDeck) playerDeck[p.id] = src.slice(0, -1);
    else deck = deck.slice(0, -1);
    top.faceDown = true;
    if (top.rarity) {
      // 特殊卡：OnDraw 效果待轮到行动时结算
      if (SPECIAL_BY_ID.get(top.defId)?.effect.trigger === 'OnDraw') p.flags.unresolvedDraw.push(top.uid);
    } else if (top.suit === 'special') {
      // 皇家牌：点数待定
      top.pendingValue = true;
      top.value = 0;
    }
    p.hand.push(top);
  }
  for (const p of players) p.score = scoreOf(p.hand);
  // 积分赛：开局每人自动投 1 币底注（不超过持有币数）
  if (game.config.mode === 'stake') {
    for (const p of alive) {
      const ante = Math.min(1, p.coins);
      p.coins -= ante;
      p.bet = ante;
    }
  } else {
    for (const p of alive) p.bet = 0;
  }

  const order = alive.map((p) => p.id);
  // 先手轮换：rotated 时把第一位挪到队尾
  if (rotate && order.length > 1) order.push(order.shift()!);
  const turnIndex = order.length > 0 ? players.findIndex((p) => p.id === order[0]) : 0;

  return {
    ...game,
    phase: 'playing',
    deck,
    playerDeck: usePerDeck ? playerDeck : undefined,
    players: players.map((p) => ({
      ...p,
      isTurn: p.id === order[0],
      turnStage: p.id === order[0] ? 'awaitingAction' : 'stood',
    })),
    currentPlayerIndex: turnIndex >= 0 ? turnIndex : 0,
    roundResult: undefined,
    log: [...game.log, `第 ${game.round} 轮发牌完毕，${order[0]} 先手`],
  };
}

function cloneGame(g: GameState): GameState {
  return {
    ...g,
    playerDeck: g.playerDeck
      ? Object.fromEntries(Object.entries(g.playerDeck).map(([k, v]) => [k, v.map((c) => ({ ...c }))]))
      : undefined,
    players: g.players.map((p) => ({
      ...p,
      hand: p.hand.map((c) => ({ ...c })),
      flags: {
        ...p.flags,
        unresolvedDraw: [...p.flags.unresolvedDraw],
        used: { ...p.flags.used },
      },
    })),
    points: { ...g.points },
  };
}

/** 找下一个可行动玩家；找不到则结算。返回新状态。 */
let raiseCounter = 0;
/** 积分赛：停牌后产出加注决策（可选不加注）。返回含 pending 的新状态。 */
function produceRaise(g: GameState, pid: string): GameState {
  if (g.config.mode !== 'stake') return g;
  const me = g.players.find((p) => p.id === pid);
  if (!me || me.coins <= 0) return g;
  raiseCounter += 1;
  const pd: PendingDecision = {
    id: `raise${raiseCounter}`,
    playerId: pid,
    cardUid: '',
    effectType: 'raise',
    kind: 'raise',
    title: '加注',
    description: `本轮已投 ${me.bet} 币，持有 ${me.coins} 币。加注数不超过持有币数。`,
    options: [{ id: 'none', label: '不加注' }],
    min: 0,
    max: me.coins,
  };
  return { ...g, pending: pd };
}

function advanceTurn(g: GameState): GameState {
  const n = g.players.length;
  for (let step = 1; step <= n; step++) {
    const idx = (g.currentPlayerIndex + step) % n;
    const p = g.players[idx];
    if (g.eliminatedIds.includes(p.id)) continue;
    if (p.status === 'active') {
      return {
        ...g,
        currentPlayerIndex: idx,
        players: g.players.map((pl) => ({
          ...pl,
          isTurn: pl.id === p.id,
          turnStage: pl.id === p.id ? 'awaitingAction' : 'stood',
        })),
      };
    }
  }
  // 无 active 玩家 -> 结算
  return settleRound(g);
}

/** 结算一轮并推进模式逻辑。 */
export function settleRound(input: GameState): GameState {
  const g = cloneGame(input);
  // 结算前触发 OnCompare（守夜人）：若存在可发动的守夜人，暂停结算等待玩家选择
  const cmp = handleOnCompare(g);
  if (cmp.pending) {
    return { ...cmp.g, phase: 'playing' };
  }
  // 翻开所有暗牌
  g.phase = 'reveal';
  for (const p of g.players) {
    for (const c of p.hand) c.faceDown = false;
    p.score = scoreOf(p.hand);
  }

  const alive = g.players.filter((p) => !g.eliminatedIds.includes(p.id));
  // 防御：点数超过目标即视为爆牌（正常流程抽爆会自动标记，这里兜底异常输入）
  for (const p of alive) {
    if (p.score > g.config.targetScore && p.status !== 'busted') p.status = 'busted';
  }
  const notBusted = alive.filter((p) => p.status !== 'busted');

  let winnerIds: string[] = [];
  let reason: RoundResultReason = 'closest';

  if (notBusted.length === 0) {
    reason = 'allBust';
  } else {
    const max = Math.max(...notBusted.map((p) => p.score));
    winnerIds = notBusted.filter((p) => p.score === max).map((p) => p.id);
    reason = max === g.config.targetScore ? 'blackjack' : winnerIds.length > 1 ? 'tie' : 'closest';
  }

  const scores: Record<string, number> = {};
  for (const p of g.players) scores[p.id] = p.score;

  g.roundResult = { winnerIds, scores, reason };

  if (g.config.mode === 'elimination') {
    // 淘汰：优先淘汰所有爆牌者；若本轮无人爆牌，则淘汰点数最低者
    const busted = alive.filter((p) => p.status === 'busted').map((p) => p.id);
    let out = busted;
    if (busted.length === 0) {
      const min = Math.min(...alive.map((p) => p.score));
      out = alive.filter((p) => p.score === min).map((p) => p.id);
    }
    const unique = [...new Set(out)];
    const newEliminated = [...g.eliminatedIds];
    for (const id of unique) if (!newEliminated.includes(id)) newEliminated.push(id);
    g.eliminatedIds = newEliminated;
    g.log.push(`淘汰：${unique.map((id) => g.players.find((p) => p.id === id)?.name).join('、')}`);
    const remaining = g.players.filter((p) => !newEliminated.includes(p.id));
    if (remaining.length <= 1) {
      g.phase = 'gameOver';
      g.winnerIds = remaining.map((p) => p.id);
    } else {
      g.phase = 'roundEnd';
    }
  } else if (g.config.mode === 'stake') {
    // 积分赛：奖池 = 滚存 + 本轮所有在局玩家投注
    const pot = g.pot + alive.reduce((s, p) => s + p.bet, 0);
    let newPot = pot;
    let stakeWinners: string[] = [];
    if (notBusted.length > 0) {
      const max = Math.max(...notBusted.map((p) => p.score));
      stakeWinners = notBusted.filter((p) => p.score === max).map((p) => p.id);
      if (stakeWinners.length === 1) {
        const w = g.players.find((p) => p.id === stakeWinners[0]);
        if (w) w.coins += pot;
        newPot = 0;
        g.log.push(`${w?.name ?? '胜者'} 赢得奖池 ${pot} 币`);
      } else {
        const share = Math.floor(pot / stakeWinners.length);
        for (const id of stakeWinners) {
          const w = g.players.find((p) => p.id === id);
          if (w) w.coins += share;
        }
        newPot = pot - share * stakeWinners.length;
        g.log.push(`最高分并列，${stakeWinners.map((id) => g.players.find((p) => p.id === id)?.name).join('、')} 各得 ${share} 币，余 ${newPot} 币留桌`);
      }
    } else {
      g.log.push(`本轮无人未爆牌，奖池 ${pot} 币滚存到下一轮`);
    }
    g.pot = newPot;
    // 币输光的玩家出局
    const newEliminated = [...g.eliminatedIds];
    for (const p of alive) {
      if (p.coins <= 0 && !newEliminated.includes(p.id)) {
        newEliminated.push(p.id);
        g.log.push(`${p.name} 币数用尽，出局`);
      }
    }
    g.eliminatedIds = newEliminated;
    const remaining = g.players.filter((p) => !newEliminated.includes(p.id));
    if (remaining.length <= 1) {
      g.phase = 'gameOver';
      g.winnerIds = remaining.map((p) => p.id);
    } else {
      g.phase = 'roundEnd';
    }
    winnerIds = stakeWinners;
  } else {
    // duel / points：赢家 +1
    for (const id of winnerIds) g.points[id] = (g.points[id] ?? 0) + 1;
    if (g.config.mode === 'points' && winnerIds.length === 1 && g.points[winnerIds[0]] >= g.config.winPoints) {
      g.phase = 'gameOver';
      g.winnerIds = winnerIds;
    } else {
      g.phase = 'roundEnd';
    }
  }

  const label = winnerIds.length ? winnerIds.map((id) => g.players.find((p) => p.id === id)?.name).join('、') : '无人';
  g.log.push(`第 ${g.round} 轮结束：${label} 获胜（${reason}）`);
  return g;
}

/** 进入下一轮（重新发牌，duel 轮换坐庄）。 */
export function nextRound(input: GameState): GameState {
  if (input.phase === 'gameOver') return input;
  const g: GameState = { ...input, round: input.round + 1, roundResult: undefined };
  return dealNewRound(g, Math.random, input.config.mode === 'duel');
}

/**
 * 玩家回合效果结算状态机：按阶段结算该玩家「当前可用」的特殊卡效果。
 * 任何抽牌 / 设点之后统一经过这里，保证 OnDraw 特殊卡即使会导致爆牌，
 * 也先弹出效果框（玩家可用效果调点数），杜绝效果被跳过/吃掉。
 */
function settlePlayerEffects(g: GameState, pid: string): GameState {
  let cur = g;
  const mark = (stage: PlayerTurnStage, base: GameState = cur) => ({
    ...base,
    players: base.players.map((p) => (p.id === pid ? { ...p, turnStage: stage } : p)),
  });
  let me = cur.players.find((p) => p.id === pid)!;
  // 阶段1：结算 OnDraw 特殊卡队列；需要玩家选择则卡在 awaitingChoice（效果框弹出）
  if (me.flags.unresolvedDraw.length > 0) {
    const out = processUnresolvedDraw(cur, pid);
    if (out.pending) return mark('awaitingChoice', out);
    cur = out;
    me = cur.players.find((p) => p.id === pid)!;
  }
  // 阶段2：待定皇家牌（皇帝/皇后）
  if (hasPendingValue(me)) return mark('awaitingValue');
  // 阶段3：效果已结算完毕，再判爆牌（先让玩家用效果调点数，不吞效果）
  if (me.score > cur.config.targetScore) {
    const stood = {
      ...cur,
      players: cur.players.map((p) => (p.id === pid ? { ...p, status: 'stood' as const, turnStage: 'stood' as const } : p)),
    };
    stood.log.push(`${me.name} 爆牌（${me.score}），自动停牌`);
    return advanceTurn(stood);
  }
  return mark('awaitingAction');
}

/** 应用一个玩家动作。非法动作返回原状态（或抛出，取决于 strict）。 */
export function apply(input: GameState, action: GameAction, strict = false): GameState {
  const g = cloneGame(input);

  // 1) 存在待处理的特殊卡决策：仅允许对应玩家 resolveChoice
  if (g.pending) {
    if (action.type !== 'resolveChoice' || action.playerId !== g.pending.playerId) {
      if (strict) throw new Error('存在待处理的特殊卡决策，请先完成选择');
      return input;
    }
    const wasCompare = g.pending.effectType === 'forceRedraw';
    const wasStand = g.pending.effectType === 'discardRedraw';
    const r = resolveDecision(g, action);
    // 守夜人改变局面后，继续走结算
    if (wasCompare && !r.pending && r.phase !== 'gameOver') {
      return settleRound(r);
    }
    // 回溯停牌后：积分赛先加注，再轮到下一玩家（或结算）
    if (wasStand) {
      const pr = produceRaise(r, action.playerId);
      if (pr.pending) return pr;
      return advanceTurn(r);
    }
    // 特殊卡结算导致该玩家爆牌自动停牌：必须推进回合，否则回合卡死
    const rp = r.players.find((p) => p.id === action.playerId);
    if (rp && rp.status === 'stood' && r.phase === 'playing' && !r.pending) {
      return advanceTurn(r);
    }
    return r;
  }

  if (g.phase !== 'playing') {
    if (strict) throw new Error(`当前阶段(${g.phase})不允许动作 ${action.type}`);
    return input;
  }

  const player = g.players.find((p) => p.id === action.playerId);
  if (!player) {
    if (strict) throw new Error('玩家不存在');
    return input;
  }
  if (!player.isTurn || player.status !== 'active' || g.eliminatedIds.includes(player.id)) {
    if (strict) throw new Error(`${player.name} 不在行动回合`);
    return input;
  }

  // 2) 轮到该玩家时，先结算未处理的 OnDraw 特殊卡（同步回合阶段标记）
  if (player.flags.unresolvedDraw.length > 0) {
    const out = processUnresolvedDraw(g, player.id);
    if (out.pending) {
      return {
        ...out,
        players: out.players.map((p) => (p.id === action.playerId ? { ...p, turnStage: 'awaitingChoice' as const } : p)),
      };
    }
  }

  // 3) 有待定点数牌（皇帝/皇后）时，只能 setValue
  if (hasPendingValue(player) && action.type !== 'setValue') {
    if (strict) throw new Error('请先为待定牌选择点数');
    return input;
  }

  // 4) mustHit：本回合不可停牌（皇帝密令 / 赌徒加倍）
  if (action.type === 'stand' && player.flags.mustHit) {
    if (strict) throw new Error('本回合必须抽牌（特殊卡限制）');
    return input;
  }

  switch (action.type) {
    case 'hit': {
      const src = g.playerDeck ? (g.playerDeck[player.id] ?? []) : g.deck;
      const top = src[src.length - 1];
      if (!top) {
        if (strict) throw new Error('牌堆已空');
        return input;
      }
      if (g.playerDeck) {
        g.playerDeck = { ...g.playerDeck, [player.id]: src.slice(0, -1) };
      } else {
        g.deck = g.deck.slice(0, -1);
      }
      // 复用牌堆中的牌实例：翻为明牌
      top.faceDown = false;
      if (top.rarity) {
        // 摸到特殊卡：OnDraw 效果待轮到行动时结算
        if (SPECIAL_BY_ID.get(top.defId)?.effect.trigger === 'OnDraw') player.flags.unresolvedDraw.push(top.uid);
      } else if (top.suit === 'special') {
        // 皇家牌：需选择点数
        if (action.chosenValue !== undefined) {
          top.value = action.chosenValue;
          top.pendingValue = false;
        } else {
          top.value = 0;
          top.pendingValue = true;
        }
      }
      player.hand.push(top);
      player.score = scoreOf(player.hand);
      g.log.push(`${player.name} 抽到 ${top.name}`);

      // 赌徒加倍：抽牌后应用总点数 ×2
      if (player.flags.doubled) {
        player.flags.doubled = false;
        player.flags.mustHit = false;
        if (player.score <= g.config.targetScore) {
          player.score = player.score * 2;
          g.log.push(`${player.name} 赌徒加倍：总点数 ×2 → ${player.score}`);
        }
      }
      // 皇帝密令等 mustHit：抽完本回合可正常停牌
      if (player.flags.mustHit) player.flags.mustHit = false;

      // 统一走玩家回合效果结算状态机：先结算 OnDraw 特殊卡（可用效果调点数），
      // 再处理待定皇家牌与爆牌 —— 杜绝「抽到特殊卡导致爆牌」被直接推进而吞掉效果
      return settlePlayerEffects(g, player.id);
    }
    case 'setValue': {
      const target = player.hand.find((c) => c.uid === action.uid);
      if (!target || !target.pendingValue) {
        if (strict) throw new Error('不存在可设点的牌');
        return input;
      }
      if (action.value < 0 || action.value > 13) {
        if (strict) throw new Error('点数需在 0-13 之间');
        return input;
      }
      target.pendingValue = false;
      target.value = action.value;
      player.score = scoreOf(player.hand);
      g.log.push(`${player.name} 将 ${target.name} 设为 ${action.value} 点`);
      // 统一走效果结算状态机：先结算未处理的 OnDraw 特殊卡，再判爆牌
      return settlePlayerEffects(g, player.id);
    }
    case 'stand': {
      player.status = 'stood';
      g.log.push(`${player.name} 停牌（${player.score}）`);
      // 触发 OnStand 特殊卡（回溯）
      const os = handleOnStand(g, player.id);
      if (os.pending) return os.g;
      // 积分赛：停牌后可加注（可选，不加则直接结算推进）
      const pr = produceRaise(g, player.id);
      if (pr.pending) return pr;
      return advanceTurn(g);
    }
    case 'resolveChoice':
      return resolveDecision(g, action);
    default:
      return input;
  }
}

/** 便捷：对局是否结束、最终获胜者名。 */
export function isGameOver(g: GameState): boolean {
  return g.phase === 'gameOver';
}

export { DECK_SIZE, rankValue };
