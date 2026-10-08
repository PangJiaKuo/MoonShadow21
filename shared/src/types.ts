/**
 * @moon21/shared —— 前后端共享类型定义
 * 客户端渲染、服务器权威逻辑、数据库读写共同依赖这些类型，禁止在单侧私自改动。
 */

/** 花色：太阳 / 月亮 / 星辰 / 花朵 / 特殊（皇帝、皇后、特殊卡） */
export type Suit = 'sun' | 'moon' | 'star' | 'flower' | 'special';

/** 数字与常规人头牌 */
export type Rank =
  | 'A'
  | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10'
  | 'J' | 'Q' | 'K';

/** 皇帝 / 皇后（可当作 0-13 任意点数） */
export type RoyalRank = 'Emperor' | 'Queen';

/** 牌的种类：数字 / 人头 / 皇家牌 / 特殊卡 */
export type CardKind = 'number' | 'court' | 'royal' | 'special';

/** 稀有度 */
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

/** 特殊卡效果触发时机 */
export type EffectTrigger =
  | 'OnDraw' | 'OnReveal' | 'OnStand' | 'OnCompare' | 'OnRoundEnd' | 'Passive';

/** 效果类型（策略模式的 key） */
export type EffectType =
  | 'adjustValue'      // 调整点数（银月/蒸汽核心）
  | 'swapCard'         // 与对手换一张牌（替身）
  | 'redraw'           // 弃一张重抽（命运硬币）
  | 'negate'           // 使对手特殊卡无效（沉默）
  | 'split'            // 拆成两张减半（双生）
  | 'discardRedraw'    // 弃一张重抽并停牌（回溯）
  | 'doubleOrNothing'  // 加倍（赌徒）
  | 'forceRedraw'      // 强制对手重抽（守夜人）
  | 'fixedValue'      // 固定点数+限制（皇帝密令）
  | 'raise';          // 积分赛加注（停牌后可选）

/** 特殊卡定义（独立牌池，不洗入基础 54 张） */
export interface SpecialCardDef {
  id: string;
  name: string;
  series: string;
  rarity: Rarity;
  suit: 'special';
  baseValue: number;
  effect: {
    trigger: EffectTrigger;
    type: EffectType;
    params: Record<string, unknown>;
  };
  description: string;
}

/**
 * 牌定义（不可变模板，来自牌库）
 * 数字牌 A=1, 2-10 面值；J=11, Q=12, K=13。
 * 皇帝/皇后 baseValue = -1，表示抽到后需在 0-13 间选择有效点数。
 * 特殊卡带有 effect 字段。
 */
export interface CardDef {
  id: string;
  name: string;
  suit: Suit;
  rank: Rank | RoyalRank;
  kind: CardKind;
  baseValue: number;
  /** 特殊卡附加（可选） */
  series?: string;
  rarity?: Rarity;
  effect?: { trigger: EffectTrigger; type: EffectType; params: Record<string, unknown> };
  description?: string;
}

/** 对局中的牌实例 */
export interface CardInstance {
  /** 对局内唯一 id（同一张定义牌可多次入局） */
  uid: string;
  defId: string;
  name: string;
  suit: Suit;
  rank: string;
  /** 当前有效点数；皇帝/皇后由持有者选择后写入 */
  value: number;
  /** 是否暗牌（未翻开，仅本回合信息） */
  faceDown: boolean;
  /** 是否仍需要选择点数（皇帝/皇后/银月等未设定） */
  pendingValue: boolean;
  /** 特殊卡附加（可选） */
  rarity?: Rarity;
  series?: string;
  effectTrigger?: EffectTrigger;
  effectType?: EffectType;
  description?: string;
}

export type PlayerStatus = 'active' | 'stood' | 'busted';

/** 玩家回合内标记（特殊卡机制使用） */
export interface PlayerFlags {
  /** 待结算的 OnDraw 特殊卡 uid（轮到该玩家时逐个处理） */
  unresolvedDraw: string[];
  /** 本回合必须抽牌（皇帝密令 / 赌徒加倍后），不可停牌 */
  mustHit: boolean;
  /** 赌徒已声明加倍：下次抽牌后总点数 ×2 */
  doubled: boolean;
  /** 一次性特殊卡是否已使用（回溯 / 守夜人等） */
  used: Record<string, boolean>;
}

export interface PlayerState {
  id: string;
  name: string;
  seat: number;
  hand: CardInstance[];
  /** 当前手牌点数总和 */
  score: number;
  status: PlayerStatus;
  isTurn: boolean;
  isHost: boolean;
  flags: PlayerFlags;
  /** 积分赛持有币数（初始 10） */
  coins: number;
  /** 积分赛本轮投注（底注 + 加注） */
  bet: number;
}

export type GamePhase =
  | 'idle'
  | 'dealing'
  | 'playing'
  | 'reveal'
  | 'roundEnd'
  | 'gameOver';

export type GameMode = 'duel' | 'points' | 'elimination' | 'stake';

export interface GameConfig {
  /** 2-6 人 */
  playerCount: number;
  /** 目标点数，固定 21 */
  targetScore: number;
  /** 3-4 人积分制先到 X 分获胜 */
  winPoints: number;
  mode: GameMode;
  /** 是否启用皇帝/皇后（房主可禁用打纯基础局） */
  enableRoyals: boolean;
  /** 是否启用特殊卡系统（房主可禁用） */
  enableSpecialCards: boolean;
  /** 每玩家初始卡组（defId 列表，key=playerId，如 'p0'）。提供时抽牌从各自卡组且不重复。 */
  playerDecks?: Record<string, string[]>;
}

export type GameAction =
  /** 抽牌；chosenValue 仅当抽到皇帝/皇后且需即时选择点数时传 */
  | { type: 'hit'; playerId: string; chosenValue?: number }
  /** 为手牌中待定点数（皇帝/皇后）设定 0-13 的点数 */
  | { type: 'setValue'; playerId: string; uid: string; value: number }
  /** 停牌，锁定点数 */
  | { type: 'stand'; playerId: string }
  /** 结算一个待处理的特殊卡决策（玩家在弹窗中的选择） */
  | {
      type: 'resolveChoice';
      playerId: string;
      decisionId: string;
      optionId: string;
      value?: number;
    };

/** 决策选项（模态框中的可选项） */
export interface DecisionOption {
  id: string;
  label: string;
  /** 数值（adjustValue 用） */
  value?: number;
  /** 目标信息（选目标牌/玩家时用） */
  payload?: { cardUid?: string; playerId?: string; uid?: string };
}

/** 待玩家处理的特殊卡决策 */
export interface PendingDecision {
  id: string;
  playerId: string;
  cardUid: string;
  effectType: EffectType;
  kind: 'adjustValue' | 'pickOption' | 'raise';
  title: string;
  description: string;
  options: DecisionOption[];
  min?: number;
  max?: number;
}

/** 一轮结算的原因 */
export type RoundResultReason = 'blackjack' | 'closest' | 'tie' | 'allBust';

export interface RoundResult {
  /** 本轮胜者（平局可多个） */
  winnerIds: string[];
  /** 各玩家最终点数 */
  scores: Record<string, number>;
  reason: RoundResultReason;
}

export interface GameState {
  id: string;
  config: GameConfig;
  phase: GamePhase;
  /** 剩余牌堆（可观测） */
  deck: CardInstance[];
  /** 每玩家剩余卡组（per-player deck 模式）。抽过的牌从各自卡组移除，不重复。 */
  playerDeck?: Record<string, CardInstance[]>;
  players: PlayerState[];
  currentPlayerIndex: number;
  round: number;
  /** 各玩家累计积分（points 模式） */
  points: Record<string, number>;
  /** 积分赛滚存奖池（平局余数累积到下一轮） */
  pot: number;
  roundResult?: RoundResult;
  /** 全局胜者（points 达到 / elimination 淘汰完成） */
  winnerIds: string[];
  /** 淘汰制中已出局的玩家 */
  eliminatedIds: string[];
  /** 日志（供前端结算播报） */
  log: string[];
  /** 待处理的特殊卡决策（非空时只有该玩家可 resolve） */
  pending?: PendingDecision | null;
}

/* ===================== 联机（阶段 3）===================== */
export type RoomStatus = 'waiting' | 'playing' | 'ended';

/** 房间内一名玩家（大厅展示 / 断线重连） */
export interface RoomPlayerInfo {
  id: string;
  name: string;
  seat: number;
  ready: boolean;
  isHost: boolean;
  connected: boolean;
}

/** 房间全量状态（服务器权威，广播给房间内所有客户端） */
export interface RoomState {
  roomCode: string;
  hostId: string;
  status: RoomStatus;
  maxPlayers: number;
  enableRoyals: boolean;
  enableSpecialCards: boolean;
  players: RoomPlayerInfo[];
  /** 对局状态；playing 时非空 */
  game: GameState | null;
  log: string[];
}

export type RoomCreateRequest = {
  name: string;
  password?: string;
  maxPlayers: number;
  enableRoyals: boolean;
  enableSpecialCards: boolean;
  /** 房主指定模式（stake 积分赛；不传则按人数自动选） */
  mode?: GameMode;
  /** 登录后携带的会话 token（对局胜利发金币用） */
  authToken?: string;
};
export type RoomJoinRequest = { roomCode: string; name: string; password?: string; authToken?: string };
export type RoomRejoinRequest = { roomCode: string; playerId: string; password?: string };

export type RoomAck =
  | { ok: true; room: RoomState; meId: string }
  | { ok: false; error: string };

/** client → server 事件 */
export interface ClientToServerEvents {
  'room:create': (req: RoomCreateRequest, ack: (res: RoomAck) => void) => void;
  'room:join': (req: RoomJoinRequest, ack: (res: RoomAck) => void) => void;
  'room:rejoin': (req: RoomRejoinRequest, ack: (res: RoomAck) => void) => void;
  'room:ready': (ready: boolean) => void;
  'room:start': () => void;
  'room:leave': () => void;
  'game:action': (action: GameAction) => void;
  'game:nextRound': () => void;
}

/** server → client 事件 */
export interface ServerToClientEvents {
  'room:state': (room: RoomState) => void;
  'room:error': (error: string) => void;
}

/* ===================== 用户系统（阶段 4）===================== */
export interface UserProfile {
  id: string;
  username: string;
  /** 金币余额 */
  coins: number;
  createdAt: string;
}

export interface RegisterRequest { username: string; password: string }
export interface LoginRequest { username: string; password: string }

export interface AuthResponse {
  token: string;
  user: UserProfile;
}

/** 图鉴中的一张卡（来源 cards 表，含玩家拥有数量） */
export interface CollectionCard {
  cardId: string;
  name: string;
  series: string;
  rarity: Rarity;
  suit: Suit;
  baseValue: number;
  effectTrigger?: EffectTrigger;
  effectType?: EffectType;
  description?: string;
  /** 当前玩家拥有张数（图鉴视角；游客为 0） */
  count: number;
}

/** 牌库图鉴响应 */
export type CatalogResponse = { cards: CollectionCard[] };

/** 收藏（我的卡牌）响应 */
export type CollectionResponse = { cards: CollectionCard[] };

/** 登录态 */
export interface AuthState {
  token: string;
  user: UserProfile;
}

/* ===================== 卡组与商城（阶段 4.5）===================== */
/** 卡组中的一张卡（基础花色牌或已放入的特殊卡） */
export interface DeckCard {
  cardId: string;
  name: string;
  suit: Suit;
  rank: string;
  /** 牌面点数（特殊卡为其替换点数） */
  value: number;
  rarity?: Rarity;
  series?: string;
  effectType?: EffectType;
  description?: string;
  /** true=基础花色牌；false=已放入的特殊卡 */
  base: boolean;
}

/** 玩家卡组响应 */
export interface DeckResponse {
  cards: DeckCard[];
  /** 卡组实际张数（52 - 替换数 + 已放入特殊卡） */
  size: number;
}

/** 商城中的一件商品 */
export interface ShopItem {
  cardId: string;
  name: string;
  series: string;
  rarity: Rarity;
  /** 替换点数（进卡组后替换同点数普通卡） */
  value: number;
  price: number;
  effectType?: EffectType;
  description?: string;
  /** 当前玩家是否已拥有（无论是否放入卡组） */
  owned: boolean;
}

export interface ShopResponse { items: ShopItem[] }

export interface BuyRequest { cardId: string }

export interface BuyResponse {
  ok: boolean;
  coins: number;
  item?: ShopItem;
  error?: string;
}

/** 装备特殊卡到卡组（替换一张同点数卡） */
export interface DeckEquipRequest {
  /** 已拥有的特殊卡 id */
  cardId: string;
  /** 卡组中要替换的目标卡 id（须同点数） */
  targetCardId: string;
}

/** 取消装备：把已放入卡组的特殊卡移除，并补回一张同点数普通卡 */
export interface DeckUnequipRequest {
  /** 卡组中要移除的特殊卡 id */
  cardId: string;
}

export interface DeckEquipResponse {
  ok: boolean;
  cards?: DeckCard[];
  size?: number;
  /** 被替换出卡组的卡 id（原基础牌或特殊卡） */
  replacedCardId?: string;
  error?: string;
}


