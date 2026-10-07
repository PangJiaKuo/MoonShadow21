/**
 * Socket.IO 联机层（阶段 3）。
 * 只负责连接与发指令，不持有游戏状态；房间/对局状态由组件监听后写入 store。
 */
import { io, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  GameAction,
  RoomAck,
  RoomCreateRequest,
  RoomJoinRequest,
  RoomRejoinRequest,
  ServerToClientEvents,
} from '@moon21/shared';

export const SERVER_URL =
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_SERVER_URL ?? 'http://localhost:4000';

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export function getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
  if (!socket) {
    socket = io(SERVER_URL, { transports: ['websocket'] });
  }
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

export const net = {
  createRoom: (req: RoomCreateRequest, ack: (r: RoomAck) => void) =>
    getSocket().emit('room:create', req, ack),
  joinRoom: (req: RoomJoinRequest, ack: (r: RoomAck) => void) =>
    getSocket().emit('room:join', req, ack),
  rejoin: (req: RoomRejoinRequest, ack: (r: RoomAck) => void) =>
    getSocket().emit('room:rejoin', req, ack),
  ready: (r: boolean) => getSocket().emit('room:ready', r),
  start: () => getSocket().emit('room:start'),
  leave: () => getSocket().emit('room:leave'),
  action: (a: GameAction) => getSocket().emit('game:action', a),
  nextRound: () => getSocket().emit('game:nextRound'),
};

/* ---- 断线重连：把座位信息存到本地，reload 后自动 rejoin ---- */
export interface StoredRoom {
  roomCode: string;
  playerId: string;
  password?: string;
}
const STORE_KEY = 'moon21.room.v1';

export function saveRoom(r: StoredRoom): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(r));
  } catch {
    /* ignore */
  }
}
export function loadRoom(): StoredRoom | null {
  try {
    const v = localStorage.getItem(STORE_KEY);
    return v ? (JSON.parse(v) as StoredRoom) : null;
  } catch {
    return null;
  }
}
export function clearRoom(): void {
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {
    /* ignore */
  }
}
