/**
 * 特殊卡效果引擎（策略模式）。
 *
 * 设计：
 *  - 纯函数式：`handleOnDraw` / `handleOnStand` / `handleOnCompare` / `resolveDecision`
 *    接收当前 GameState，返回新状态；需要玩家选择时设置 game.pending，等 `resolveChoice` 后继续。
 *  - 为联机服务器权威预留：所有逻辑在引擎内完成，客户端只提交动作指令与选择。
 */
import type {
  CardInstance,
  EffectType,
  GameAction,
  GameState,
  PendingDecision,
  PlayerState,
  SpecialCardDef,
} from '@moon21/shared';
import { SPECIAL_BY_ID } from './specialCards';

let uidCounter = 0;
function nextUid(): string {
  uidCounter += 1;
  return `sp${uidCounter}`;
}
let decisionCounter = 0;
function nextDecisionId(): string {
  decisionCounter += 1;
  return `d${decisionCounter}`;
}

function scoreOf(hand: CardInstance[]): number {
  return hand.reduce((s, c) => s + (c.pendingValue ? 0 : c.value), 0);
}
function playerOf(g: GameState, id: string): PlayerState {
  return g.players.find((p) => p.id === id)!;
}
/** 返回 pid 的「上一家」：沿座位逆时针（seat-1，循环）找到的第一个未淘汰玩家；无则 undefined。 */
function prevPlayer(g: GameState, pid: string): PlayerState | undefined {
  const me = playerOf(g, pid);
  const count = g.players.length;
  for (let step = 1; step <= count; step++) {
    const seat = (me.seat - step + count) % count;
    const p = g.players.find((x) => x.seat === seat);
    if (p && !g.eliminatedIds.includes(p.id)) return p;
  }
  return undefined;
}
function isRoyal(c: CardInstance): boolean {
  return c.defId === 'emperor' || c.defId === 'queen';
}

/** 构造特殊卡实例 */
export function makeSpecialCard(defId: string, faceDown: boolean): CardInstance {
  const def = SPECIAL_BY_ID.get(defId)!;
  return {
    uid: nextUid(),
    defId,
    name: def.name,
    suit: 'special',
    rank: 'Special',
    value: def.baseValue,
    faceDown,
    pendingValue: false,
    rarity: def.rarity,
    series: def.series,
    effectTrigger: def.effect.trigger,
    effectType: def.effect.type,
    description: def.description,
  };
}

/** 从牌堆顶抽一张（特殊效果重抽用）。皇家牌置待定点数。 */
function drawTopInto(g: GameState, pid: string): CardInstance | null {
  const src = g.playerDeck ? (g.playerDeck[pid] ?? []) : g.deck;
  if (src.length === 0) return null;
  const top = src[src.length - 1];
  if (g.playerDeck) {
    g.playerDeck = { ...g.playerDeck, [pid]: src.slice(0, -1) };
  } else {
    g.deck = g.deck.slice(0, -1);
  }
  top.faceDown = false;
  if (isRoyal(top)) {
    top.value = 0;
    top.pendingValue = true;
  }
  playerOf(g, pid).hand.push(top);
  return top;
}

/** 该玩家特殊卡是否被上一家的沉默压制 */
export function silencedByOpponent(g: GameState, pid: string): boolean {
  const opp = prevPlayer(g, pid);
  return !!opp && opp.hand.some((c) => SPECIAL_BY_ID.get(c.defId)?.effect.type === 'negate');
}

function mkPending(
  g: GameState,
  pid: string,
  cardUid: string,
  effectType: EffectType,
  kind: PendingDecision['kind'],
  title: string,
  description: string,
  options: PendingDecision['options'],
  range?: { min?: number; max?: number },
): HandlerResult {
  const pd: PendingDecision = {
    id: nextDecisionId(),
    playerId: pid,
    cardUid,
    effectType,
    kind,
    title,
    description,
    options,
    min: range?.min,
    max: range?.max,
  };
  return { g: { ...g, pending: pd }, pending: pd };
}

interface HandlerCtx {
  g: GameState;
  pid: string;
  card: CardInstance;
  def: SpecialCardDef;
  params: Record<string, unknown>;
}
interface HandlerResult {
  g: GameState;
  pending?: PendingDecision;
}

function adjustValue(ctx: HandlerCtx): HandlerResult {
  const { g, pid, card, params } = ctx;
  if (params.condition === 'allSun') {
    const others = playerOf(g, pid).hand.filter((c) => c.uid !== card.uid);
    const allSun = others.length > 0 && others.every((c) => c.suit === 'sun');
    if (!allSun) {
      card.value = 0;
      playerOf(g, pid).score = scoreOf(playerOf(g, pid).hand);
      g.log.push(`${playerOf(g, pid).name} 的 ${card.name} 不满足全太阳条件，点数无效`);
      return { g };
    }
    const values = (params.values as number[]) ?? [];
    const options = values.map((v) => ({ id: String(v), label: `${v} 点`, value: v }));
    options.push({ id: 'skip', label: '不使用效果（保持 0 点）', value: 0 });
    return mkPending(g, pid, card.uid, 'adjustValue', 'adjustValue', `设定 ${card.name} 点数`, '选择此牌的有效点数', options);
  }
  const min = params.min as number;
  const max = params.max as number;
  const options: PendingDecision['options'] = [];
  for (let v = min; v <= max; v++) options.push({ id: String(v), label: `${v} 点`, value: v });
  options.push({ id: 'skip', label: '不使用效果（保持 0 点）' });
  return mkPending(g, pid, card.uid, 'adjustValue', 'adjustValue', `设定 ${card.name} 点数`, '选择此牌的有效点数', options, { min, max });
}

function swapCard(ctx: HandlerCtx): HandlerResult {
  const { g, pid, card } = ctx;
  const me = playerOf(g, pid);
  const opponent = prevPlayer(g, pid);
  if (!opponent) return { g };
  const hidden = opponent.hand.filter((c) => c.faceDown);
  if (hidden.length === 0) {
    g.log.push(`${me.name} 的 ${card.name}：上一家无暗牌，效果无效`);
    return { g };
  }
  const options = hidden.map((c, i) => ({
    id: `h${i}`,
    label: `与上一家（${opponent.name}）第 ${i + 1} 张暗牌互换`,
    payload: { cardUid: c.uid, uid: c.uid },
  }));
  options.push({ id: 'skip', label: '不使用效果', payload: { cardUid: '', uid: '' } });
  return mkPending(g, pid, card.uid, 'swapCard', 'pickOption', `${card.name}：选择互换的暗牌`, `选择上一家 ${opponent.name} 的一张暗牌进行互换`, options);
}

function redraw(ctx: HandlerCtx): HandlerResult {
  const { g, pid, card } = ctx;
  const me = playerOf(g, pid);
  const discardable = me.hand.filter((c) => c.uid !== card.uid);
  if (discardable.length === 0) {
    g.log.push(`${me.name} 的 ${card.name}：没有可弃置的手牌，效果无效`);
    return { g };
  }
  const options = discardable.map((c) => ({
    id: `d${c.uid}`,
    label: `弃置 ${c.name}（${c.pendingValue ? '?' : c.value} 点）`,
    payload: { uid: c.uid },
  }));
  options.push({ id: 'skip', label: '不使用效果（不弃牌）', payload: { uid: '' } });
  return mkPending(g, pid, card.uid, 'redraw', 'pickOption', `${card.name}：选择弃置的牌`, '弃置一张手牌并重新抽一张', options);
}

function split(ctx: HandlerCtx): HandlerResult {
  const { g, pid, card } = ctx;
  const divisor = (ctx.params.divisor as number) ?? 2;
  const half = Math.floor(card.value / divisor);
  const options = [
    { id: 'yes', label: `拆分为两张 ${half} 点` },
    { id: 'no', label: '保留原牌' },
  ];
  return mkPending(g, pid, card.uid, 'split', 'pickOption', `${card.name}：是否拆分`, `拆分为两张点数减半（${half} 点）的牌`, options);
}

function discardRedraw(ctx: HandlerCtx): HandlerResult {
  const { g, pid, card } = ctx;
  const me = playerOf(g, pid);
  const discardable = me.hand.filter((c) => c.uid !== card.uid);
  const options: PendingDecision['options'] = [{ id: 'skip', label: '不发动（保持停牌）' }];
  for (const c of discardable) {
    options.push({
      id: `d${c.uid}`,
      label: `弃置 ${c.name}（${c.pendingValue ? '?' : c.value} 点）并重抽`,
      payload: { uid: c.uid },
    });
  }
  return mkPending(g, pid, card.uid, 'discardRedraw', 'pickOption', `${card.name}：是否回溯`, '停牌时可弃一张并重抽一张（仍停牌）', options);
}

function doubleOrNothing(ctx: HandlerCtx): HandlerResult {
  const { g, pid, card } = ctx;
  const options = [
    { id: 'yes', label: '声明加倍（风险：爆牌出局）' },
    { id: 'no', label: '放弃加倍' },
  ];
  return mkPending(g, pid, card.uid, 'doubleOrNothing', 'pickOption', `${card.name}：是否加倍`, '加倍后必须再抽一张；未爆则总点数×2，爆则自动停牌', options);
}

function forceRedraw(ctx: HandlerCtx): HandlerResult {
  const { g, pid, card } = ctx;
  const opp = prevPlayer(g, pid);
  if (!opp || opp.score !== 21 || opp.status === 'busted') return { g };
  const options: PendingDecision['options'] = [
    { id: 'skip', label: '不发动' },
    { id: `t${opp.id}`, label: `强制 ${opp.name} 弃一张重抽`, payload: { playerId: opp.id } },
  ];
  return mkPending(g, pid, card.uid, 'forceRedraw', 'pickOption', `${card.name}：强制上一家重抽`, `上一家 ${opp.name} 达到 21 点，可弃此牌强制其重抽`, options);
}

function fixedValue(ctx: HandlerCtx): HandlerResult {
  const { g, pid, card } = ctx;
  const value = ctx.params.value as number;
  const options: PendingDecision['options'] = [
    { id: 'use', label: `使用：固定 ${value} 点（本回合必须抽牌）` },
    { id: 'skip', label: '不使用效果' },
  ];
  return mkPending(g, pid, card.uid, 'fixedValue', 'pickOption', `${card.name}：是否使用`, `使用后固定 ${value} 点，本回合不可停牌`, options);
}

const HANDLERS: Record<EffectType, (ctx: HandlerCtx) => HandlerResult> = {
  adjustValue,
  swapCard,
  redraw,
  negate: (ctx) => {
    const { g, pid, card } = ctx;
    g.log.push(`${playerOf(g, pid).name} 持有 ${card.name}（被动：压制上一家特殊卡）`);
    return { g };
  },
  split,
  discardRedraw,
  doubleOrNothing,
  forceRedraw,
  fixedValue,
  // 积分赛加注由游戏机制触发（不通过特殊卡 HANDLERS），仅满足 Record<EffectType> 类型完整性
  raise: (ctx) => ({ g: ctx.g }),
};

/** 处理一张 OnDraw 特殊卡。返回 pending 或立即结算。 */
export function handleOnDraw(g: GameState, pid: string, cardUid: string): HandlerResult {
  const me = playerOf(g, pid);
  const card = me.hand.find((c) => c.uid === cardUid);
  if (!card) return { g };
  const def = SPECIAL_BY_ID.get(card.defId);
  if (!def || def.effect.trigger !== 'OnDraw') return { g };

  if (silencedByOpponent(g, pid)) {
    card.value = 0;
    me.score = scoreOf(me.hand);
    g.log.push(`${me.name} 的特殊卡 ${card.name} 被上一家沉默压制`);
    return { g };
  }
  return HANDLERS[def.effect.type]({ g, pid, card, def, params: def.effect.params });
}

/** 依次处理某玩家未结算的 OnDraw 特殊卡；有需要选择时生成 pending。 */
export function processUnresolvedDraw(g: GameState, pid: string): GameState {
  const me = playerOf(g, pid);
  while (me.flags.unresolvedDraw.length > 0) {
    const uid = me.flags.unresolvedDraw[0];
    const r = handleOnDraw(g, pid, uid);
    if (r.pending) return r.g;
    me.flags.unresolvedDraw = me.flags.unresolvedDraw.filter((u) => u !== uid);
  }
  return g;
}

/** 停牌触发 OnStand 效果（回溯）。 */
export function handleOnStand(g: GameState, pid: string): HandlerResult {
  const me = playerOf(g, pid);
  const rewind = me.hand.find((c) => SPECIAL_BY_ID.get(c.defId)?.effect.type === 'discardRedraw');
  if (!rewind) return { g };
  if (me.flags.used[rewind.defId]) return { g };
  if (silencedByOpponent(g, pid)) return { g };
  return HANDLERS.discardRedraw({ g, pid, card: rewind, def: SPECIAL_BY_ID.get(rewind.defId)!, params: SPECIAL_BY_ID.get(rewind.defId)!.effect.params });
}

/** 结算前触发 OnCompare 效果（守夜人）。 */
export function handleOnCompare(g: GameState): HandlerResult {
  for (const p of g.players) {
    if (g.eliminatedIds.includes(p.id)) continue;
    if (p.score !== 21 || p.status === 'busted') continue;
    const watcher = g.players.find(
      (w) =>
        w.id !== p.id &&
        !g.eliminatedIds.includes(w.id) &&
        w.status !== 'busted' &&
        prevPlayer(g, w.id)?.id === p.id &&
        w.hand.some((c) => SPECIAL_BY_ID.get(c.defId)?.effect.type === 'forceRedraw') &&
        !w.flags.used[SPECIAL_BY_ID.get(w.hand.find((c) => SPECIAL_BY_ID.get(c.defId)?.effect.type === 'forceRedraw')!.defId)!.id],
    );
    if (watcher) {
      const card = watcher.hand.find((c) => SPECIAL_BY_ID.get(c.defId)?.effect.type === 'forceRedraw')!;
      return HANDLERS.forceRedraw({ g, pid: watcher.id, card, def: SPECIAL_BY_ID.get(card.defId)!, params: SPECIAL_BY_ID.get(card.defId)!.effect.params });
    }
  }
  return { g };
}

/** 结算玩家提交的决策。返回新状态（可能继续结算守夜人等）。 */
export function resolveDecision(g: GameState, action: Extract<GameAction, { type: 'resolveChoice' }>): GameState {
  const pd = g.pending;
  if (!pd || pd.id !== action.decisionId || pd.playerId !== action.playerId) return g;
  const me = playerOf(g, pd.playerId);
  const card = me.hand.find((c) => c.uid === pd.cardUid);
  const opt = pd.options.find((o) => o.id === action.optionId);
  // 积分赛加注决策（无关联卡牌，不受 option 匹配限制）
  if (pd.effectType === 'raise') {
    const amt = action.optionId === 'none' ? 0 : Math.floor(action.value ?? 0);
    const capped = Math.max(0, Math.min(amt, me.coins));
    me.coins -= capped;
    me.bet += capped;
    g.log.push(amt > 0 ? `${me.name} 加注 ${capped} 币（本轮投注 ${me.bet} 币）` : `${me.name} 不加注（本轮投注 ${me.bet} 币）`);
    return { ...g, pending: null };
  }
  if (!opt && pd.kind !== 'adjustValue') return g;
  if (!card) return g;

  const target = g.config.targetScore;

  // 玩家选择“不使用效果”：跳过 OnDraw 特殊卡（银月/蒸汽核心/替身/命运硬币/皇帝密令）
  if (
    action.optionId === 'skip' &&
    (pd.effectType === 'adjustValue' || pd.effectType === 'swapCard' || pd.effectType === 'redraw' || pd.effectType === 'fixedValue')
  ) {
    card.value = 0;
    card.pendingValue = false;
    me.flags.unresolvedDraw = me.flags.unresolvedDraw.filter((u) => u !== card.uid);
    if (pd.effectType === 'fixedValue') me.flags.mustHit = false;
    g.log.push(`${me.name} 不使用 ${card.name} 的效果`);
    const next = { ...g, pending: null };
    const c = handleOnCompare(next);
    if (c.pending) return c.g;
    return next;
  }

  const removeUnresolved = () => {
    me.flags.unresolvedDraw = me.flags.unresolvedDraw.filter((u) => u !== card.uid);
  };
  const checkBust = (): boolean => {
    me.score = scoreOf(me.hand);
    if (me.score > target && me.status !== 'busted') {
      // 新规则：爆牌不立即判负，自动停牌，等结算统一揭晓
      me.status = 'stood';
      g.log.push(`${me.name} 爆牌（${me.score}），自动停牌`);
      return true;
    }
    return false;
  };

  switch (pd.effectType) {
    case 'adjustValue': {
      const value = action.value ?? opt?.value;
      if (value === undefined) return g;
      card.value = value;
      card.pendingValue = false;
      removeUnresolved();
      g.log.push(`${me.name} 将 ${card.name} 设为 ${value} 点`);
      checkBust();
      break;
    }
    case 'swapCard': {
      const targetUid = opt?.payload?.uid;
      const opp = prevPlayer(g, pd.playerId);
      if (!targetUid || !opp) return g;
      const theirCard = opp.hand.find((c) => c.uid === targetUid);
      if (!theirCard) return g;
      // 互换：替身入上一家，上一家暗牌入我方（明牌给自己）
      me.hand = me.hand.filter((c) => c.uid !== card.uid);
      opp.hand = opp.hand.filter((c) => c.uid !== theirCard.uid);
      card.faceDown = false;
      theirCard.faceDown = false;
      opp.hand.push(card);
      me.hand.push(theirCard);
      me.score = scoreOf(me.hand);
      opp.score = scoreOf(opp.hand);
      removeUnresolved();
      g.log.push(`${me.name} 用 ${card.name} 与上一家 ${opp.name} 的一张暗牌互换`);
      checkBust();
      break;
    }
    case 'redraw': {
      const uid = opt?.payload?.uid;
      if (!uid) return g;
      me.hand = me.hand.filter((c) => c.uid !== uid);
      const drawn = drawTopInto(g, pd.playerId);
      removeUnresolved();
      g.log.push(`${me.name} 弃置一张并重抽${drawn ? `：${drawn.name}` : '（牌堆已空）'}`);
      checkBust();
      break;
    }
    case 'split': {
      if (action.optionId === 'yes') {
        const half = Math.floor(card.value / 2);
        me.hand = me.hand.filter((c) => c.uid !== card.uid);
        for (let i = 0; i < 2; i++) {
          me.hand.push({
            uid: nextUid(),
            defId: `${card.defId}_half`,
            name: `${card.name}·半`,
            suit: 'special',
            rank: 'Special',
            value: half,
            faceDown: false,
            pendingValue: false,
            rarity: card.rarity,
            effectType: 'split',
          });
        }
        g.log.push(`${me.name} 将 ${card.name} 拆分为两张 ${half} 点`);
      } else {
        g.log.push(`${me.name} 保留 ${card.name}（${card.value} 点）`);
      }
      removeUnresolved();
      checkBust();
      break;
    }
    case 'doubleOrNothing': {
      if (action.optionId === 'yes') {
        me.flags.doubled = true;
        me.flags.mustHit = true;
        g.log.push(`${me.name} 声明加倍，必须再抽一张`);
      } else {
        card.value = 0;
        g.log.push(`${me.name} 放弃加倍`);
      }
      removeUnresolved();
      break;
    }
    case 'fixedValue': {
      if (action.optionId === 'use') {
        card.value = (SPECIAL_BY_ID.get(card.defId)!.effect.params.value as number) ?? 13;
        me.flags.mustHit = true;
        g.log.push(`${me.name} 使用 ${card.name}：固定 ${card.value} 点，本回合必须抽牌`);
      }
      me.score = scoreOf(me.hand);
      removeUnresolved();
      break;
    }
    case 'discardRedraw': {
      if (action.optionId !== 'skip') {
        const uid = opt?.payload?.uid;
        if (uid) {
          me.hand = me.hand.filter((c) => c.uid !== uid);
          const drawn = drawTopInto(g, pd.playerId);
          g.log.push(`${me.name} 回溯：弃一张并重抽${drawn ? `：${drawn.name}` : ''}`);
        }
      }
      me.flags.used[card.defId] = true;
      checkBust();
      break;
    }
    case 'forceRedraw': {
      if (action.optionId !== 'skip') {
        const tpid = opt?.payload?.playerId;
        const t = tpid ? g.players.find((p) => p.id === tpid) : undefined;
        if (t) {
          // 弃守夜人，目标弃一张（暗牌优先）并重抽
          me.hand = me.hand.filter((c) => c.uid !== card.uid);
          const targetCard = t.hand.find((c) => c.faceDown) ?? t.hand[0];
          if (targetCard) {
            t.hand = t.hand.filter((c) => c.uid !== targetCard.uid);
            const drawn = drawTopInto(g, t.id);
            t.score = scoreOf(t.hand);
            g.log.push(`${me.name} 发动守夜人：强制 ${t.name} 重抽${drawn ? `：${drawn.name}` : ''}`);
            if (t.score > target) {
              // 新规则：爆牌自动停牌
              t.status = 'stood';
              g.log.push(`${t.name} 爆牌（${t.score}），自动停牌`);
            }
          }
        }
      }
      me.flags.used[card.defId] = true;
      break;
    }
    default:
      removeUnresolved();
  }

  // 清空决策
  const next = { ...g, pending: null };
  // 若守夜人改变了局面，重新走结算前检查
  const c = handleOnCompare(next);
  if (c.pending) return c.g;
  return next;
}
