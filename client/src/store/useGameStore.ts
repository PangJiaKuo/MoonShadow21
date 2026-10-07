import { create } from 'zustand';
import type { GameAction, GameMode, GameState, RoomCreateRequest, RoomState } from '@moon21/shared';
import { apply, buildBaseDeckDefs, createGame, nextRound as engineNextRound, SPECIAL_CARDS } from '@moon21/engine';
import { net, clearRoom, saveRoom } from '../net/socket';
import { useAuthStore } from './useAuthStore';

export type Screen = 'menu' | 'lobby' | 'table' | 'auth' | 'catalog' | 'collection' | 'deck' | 'shop';

interface GameStore {
  screen: Screen;
  game: GameState | null;
  names: string[];
  enableRoyals: boolean;
  enableSpecialCards: boolean;
  /** 人机对战：AI 玩家的 engine 座位 id（p1 等），本地非联机模式使用 */
  aiPlayerId: string | null;
  /** 本客户端人类控制的 engine 座位 id；本地热座（双方同机操作）为 null */
  myEngineId: string | null;

  // 联机
  online: boolean;
  roomState: RoomState | null;
  meId: string | null;
  onlineError: string | null;

  startGame: (
    names: string[],
    enableRoyals: boolean,
    enableSpecialCards: boolean,
    aiP1?: boolean,
    mode?: GameMode,
  ) => void;
  dispatch: (action: GameAction) => void;
  nextRound: () => void;
  backToMenu: () => void;
  setScreen: (s: Screen) => void;

  // 联机动作
  createRoom: (req: RoomCreateRequest, cb?: (ok: boolean) => void) => void;
  joinRoom: (roomCode: string, name: string, password?: string, cb?: (ok: boolean) => void) => void;
  toggleReady: () => void;
  startOnline: () => void;
  leaveOnline: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  screen: 'menu',
  game: null,
  names: ['庄家', '对手'],
  enableRoyals: true,
  enableSpecialCards: true,

  online: false,
  roomState: null,
  meId: null,
  onlineError: null,
  aiPlayerId: null,
  myEngineId: null,

  startGame: (names, enableRoyals, enableSpecialCards, aiP1 = false, mode: GameMode = 'duel') => {
    const playerCount = names.length;
    // 本地热座 / 人机：每人从自己卡组抽牌且不重复；开启特殊卡时把全部特殊卡一并加入个人卡组
    const baseDeck = buildBaseDeckDefs().map((d) => d.id);
    const spIds = enableSpecialCards ? SPECIAL_CARDS.map((s) => s.id) : [];
    const deck = [...baseDeck, ...spIds];
    const playerDecks: Record<string, string[]> = {};
    for (let i = 0; i < playerCount; i++) playerDecks[`p${i}`] = deck;
    const game = createGame(names, {
      playerCount,
      mode,
      enableRoyals,
      enableSpecialCards,
      playerDecks,
    });
    set({
      screen: 'table',
      game,
      names,
      enableRoyals,
      enableSpecialCards,
      online: false,
      aiPlayerId: aiP1 ? 'p1' : null,
      myEngineId: aiP1 ? 'p0' : null,
    });
  },

  dispatch: (action) => {
    if (get().online) {
      net.action(action);
      return;
    }
    const { game } = get();
    if (!game) return;
    set({ game: apply(game, action, true) });
  },

  nextRound: () => {
    if (get().online) {
      net.nextRound();
      return;
    }
    const { game } = get();
    if (!game) return;
    set({ game: engineNextRound(game) });
  },

  backToMenu: () => {
    if (get().online) net.leave();
    clearRoom();
    set({ screen: 'menu', game: null, roomState: null, online: false, meId: null, myEngineId: null, aiPlayerId: null, onlineError: null });
  },

  setScreen: (s) => set({ screen: s }),

  createRoom: (req, cb) => {
    net.createRoom({ ...req, authToken: useAuthStore.getState().token ?? undefined }, (res) => {
      if (res.ok) {
        const seat = res.room.players.find((p) => p.id === res.meId)?.seat;
        saveRoom({ roomCode: res.room.roomCode, playerId: res.meId, password: req.password });
        set({ online: true, meId: res.meId, myEngineId: `p${seat ?? 0}`, onlineError: null });
      } else {
        set({ onlineError: res.error });
      }
      cb?.(res.ok);
    });
  },

  joinRoom: (roomCode, name, password, cb) => {
    net.joinRoom({ roomCode, name, password, authToken: useAuthStore.getState().token ?? undefined }, (res) => {
      if (res.ok) {
        const seat = res.room.players.find((p) => p.id === res.meId)?.seat;
        saveRoom({ roomCode, playerId: res.meId, password });
        set({ online: true, meId: res.meId, myEngineId: `p${seat ?? 0}`, onlineError: null });
      } else {
        set({ onlineError: res.error });
      }
      cb?.(res.ok);
    });
  },

  toggleReady: () => {
    const me = get().meId;
    const room = get().roomState;
    const mine = room?.players.find((p) => p.id === me);
    if (!mine) return;
    net.ready(!mine.ready);
  },

  startOnline: () => net.start(),

  leaveOnline: () => {
    net.leave();
    clearRoom();
    set({ screen: 'menu', game: null, roomState: null, online: false, meId: null, myEngineId: null, onlineError: null });
  },
}));
