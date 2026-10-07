/**
 * 《月影二十一》服务端（阶段 3：在线房间与联机）。
 *
 * 服务器权威：
 *  - 所有洗牌、发牌、抽牌、结算都由服务端调用 engine 完成；
 *  - 客户端只提交动作指令（game:action），不产生任何游戏结果。
 *
 * 房间机制：
 *  - 创建房间生成 6 位房间码（可设密码）；
 *  - 加入 / 重连（60 秒座位保留）；
 *  - 等待中可准备 / 取消准备，房主开始。
 *
 * 断线重连：
 *  - 玩家断线后座位保留 60 秒（大厅等待状态超时即移除）；
 *  - 对局中掉线者标记断线、座位保留，可重连恢复手牌与状态。
 */
import http from 'node:http';
import express from 'express';
import { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  GameAction,
  GameMode,
  GameState,
  RoomCreateRequest,
  RoomJoinRequest,
  RoomPlayerInfo,
  RoomRejoinRequest,
  RoomState,
  ServerToClientEvents,
} from '@moon21/shared';
import { apply, buildBaseDeckDefs, createGame, nextRound } from '@moon21/engine';
import { dbStats, getDeckCards, initDb } from './db';
import { createAuthRouter, getUserIdByToken } from './auth';
import { createCollectionRouter } from './collection';
import { createShopRouter } from './shop';
import { WIN_COINS, rewardWinnersCore } from './reward';

const app = express();
// 阶段 4：REST CORS（前端跨域访问 /api）
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json());
const server = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: { origin: process.env.CLIENT_ORIGIN ?? '*' },
});

// 阶段 4：初始化 SQLite 并挂载用户/图鉴 API
initDb();
app.use('/api', createAuthRouter());
app.use('/api', createCollectionRouter());
app.use('/api', createShopRouter());

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'moon21-server', stage: 4, db: dbStats() });
});

/* ============================= 房间存储 ============================= */
interface RoomPlayer {
  id: string;
  name: string;
  seat: number;
  ready: boolean;
  socketId: string;
  connected: boolean;
  /** 登录账号 id（可选，游客无；对局胜利发放金币用） */
  userId?: string;
}

interface Room {
  roomCode: string;
  password?: string;
  hostId: string;
  maxPlayers: number;
  enableRoyals: boolean;
  enableSpecialCards: boolean;
  mode?: GameMode;
  status: 'waiting' | 'playing' | 'ended';
  players: Map<string, RoomPlayer>;
  game: GameState | null;
  log: string[];
  timers: Map<string, NodeJS.Timeout>;
}

const rooms = new Map<string, Room>();

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function genCode(): string {
  let code = '';
  do {
    code = '';
    for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  } while (rooms.has(code));
  return code;
}

function nextSeat(room: Room): number {
  const used = new Set([...room.players.values()].map((p) => p.seat));
  for (let s = 0; s < room.maxPlayers; s++) if (!used.has(s)) return s;
  return -1;
}

function toRoomState(room: Room): RoomState {
  return {
    roomCode: room.roomCode,
    hostId: room.hostId,
    status: room.status,
    maxPlayers: room.maxPlayers,
    enableRoyals: room.enableRoyals,
    enableSpecialCards: room.enableSpecialCards,
    players: [...room.players.values()]
      .sort((a, b) => a.seat - b.seat)
      .map<RoomPlayerInfo>((p) => ({
        id: p.id,
        name: p.name,
        seat: p.seat,
        ready: p.ready,
        isHost: p.id === room.hostId,
        connected: p.connected,
      })),
    game: room.game,
    log: room.log,
  };
}

function broadcast(room: Room): void {
  io.to(room.roomCode).emit('room:state', toRoomState(room));
}

/** 对局结束（gameOver）时，为绑定账号的胜者发放金币。 */
function rewardWinners(room: Room): void {
  const game = room.game;
  if (!game || game.phase !== 'gameOver' || game.winnerIds.length === 0) return;
  const winnerSeats = game.winnerIds
    .map((id) => Number(id.replace('p', '')))
    .filter((n) => !Number.isNaN(n));
  const players = [...room.players.values()].map((p) => ({ userId: p.userId, seat: p.seat }));
  const { count } = rewardWinnersCore(winnerSeats, players);
  if (count > 0) room.log.push(`对局胜利：+${WIN_COINS} 金币（${count} 名玩家）`);
}

/** 断线处理：标记断线并保留座位 60 秒。 */
function onPlayerDisconnect(socketId: string): void {
  console.log(`[moon21] client disconnected: ${socketId}`);
  for (const room of rooms.values()) {
    const me = [...room.players.values()].find((p) => p.socketId === socketId);
    if (!me) continue;
    me.connected = false;
    room.log.push(`${me.name} 掉线（等待重连 60 秒）`);
    broadcast(room);

    // 60 秒未重连：大厅等待状态移除座位；对局中保留座位（可重连恢复）
    const timer = setTimeout(() => {
      const still = room.players.get(me.id);
      if (!still || still.connected) return;
      if (room.status === 'waiting') {
        room.players.delete(me.id);
        room.log.push(`${me.name} 因长时间掉线离开房间`);
        broadcast(room);
        if (room.players.size === 0) rooms.delete(room.roomCode);
      }
    }, 60_000);
    room.timers.set(me.id, timer);
    return;
  }
}

io.on('connection', (socket) => {
  console.log(`[moon21] client connected: ${socket.id}`);
  const self = socket as unknown as {
    data: { roomCode?: string; playerId?: string };
  };
  self.data = {};

  const meInRoom = () => {
    const code = self.data.roomCode;
    const pid = self.data.playerId;
    if (!code || !pid) return undefined;
    const room = rooms.get(code);
    return room?.players.get(pid);
  };

  /* ---------- 创建房间 ---------- */
  socket.on('room:create', (req: RoomCreateRequest, ack) => {
    if (req.maxPlayers < 2 || req.maxPlayers > 8) {
      return ack({ ok: false, error: '人数需在 2-8 之间' });
    }
    const code = genCode();
    const playerId = `r${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
    const room: Room = {
      roomCode: code,
      password: req.password || undefined,
      hostId: playerId,
      maxPlayers: req.maxPlayers,
      enableRoyals: req.enableRoyals,
      enableSpecialCards: req.enableSpecialCards,
      mode: req.mode,
      status: 'waiting',
      players: new Map(),
      game: null,
      log: [`房间 ${code} 已创建，${req.name} 加入（房主）`],
      timers: new Map(),
    };
    room.players.set(playerId, {
      id: playerId,
      name: req.name || '玩家1',
      seat: 0,
      ready: false,
      socketId: socket.id,
      connected: true,
      userId: getUserIdByToken(req.authToken) ?? undefined,
    });
    rooms.set(code, room);
    console.log(`[moon21] 房间 ${code} 创建，房主 ${req.name || '玩家1'}`);
    self.data = { roomCode: code, playerId };
    socket.join(code);
    ack({ ok: true, room: toRoomState(room), meId: playerId });
    broadcast(room);
  });

  /* ---------- 加入房间 ---------- */
  socket.on('room:join', (req: RoomJoinRequest, ack) => {
    const room = rooms.get(req.roomCode.toUpperCase());
    if (!room) return ack({ ok: false, error: '房间不存在' });
    if (room.password && room.password !== req.password) return ack({ ok: false, error: '房间密码错误' });
    if (room.status === 'playing') return ack({ ok: false, error: '对局进行中，无法加入' });
    if (room.players.size >= room.maxPlayers) return ack({ ok: false, error: '房间已满' });
    const seat = nextSeat(room);
    const playerId = `r${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
    room.players.set(playerId, {
      id: playerId,
      name: req.name || `玩家${seat + 1}`,
      seat,
      ready: false,
      socketId: socket.id,
      connected: true,
      userId: getUserIdByToken(req.authToken) ?? undefined,
    });
    room.log.push(`${req.name || `玩家${seat + 1}`} 加入房间`);
    self.data = { roomCode: room.roomCode, playerId };
    socket.join(room.roomCode);
    ack({ ok: true, room: toRoomState(room), meId: playerId });
    broadcast(room);
  });

  /* ---------- 断线重连 ---------- */
  socket.on('room:rejoin', (req: RoomRejoinRequest, ack) => {
    const room = rooms.get(req.roomCode.toUpperCase());
    if (!room) return ack({ ok: false, error: '房间不存在' });
    if (room.password && room.password !== req.password) return ack({ ok: false, error: '房间密码错误' });
    const me = room.players.get(req.playerId);
    if (!me) return ack({ ok: false, error: '座位已失效，请重新加入' });
    me.socketId = socket.id;
    me.connected = true;
    console.log(`[moon21] ${me.name} 重连成功 → ${room.roomCode}`);
    const timer = room.timers.get(me.id);
    if (timer) clearTimeout(timer);
    room.timers.delete(me.id);
    room.log.push(`${me.name} 重连成功`);
    self.data = { roomCode: room.roomCode, playerId: me.id };
    socket.join(room.roomCode);
    ack({ ok: true, room: toRoomState(room), meId: me.id });
    broadcast(room);
  });

  /* ---------- 准备 / 取消准备 ---------- */
  socket.on('room:ready', (ready: boolean) => {
    const me = meInRoom();
    if (!me) return;
    const room = rooms.get(self.data.roomCode!);
    if (!room || room.status !== 'waiting') return;
    me.ready = ready;
    room.log.push(`${me.name} ${ready ? '已准备' : '取消准备'}`);
    broadcast(room);
  });

  /* ---------- 房主开始对局 ---------- */
  socket.on('room:start', () => {
    const me = meInRoom();
    if (!me) return;
    const room = rooms.get(self.data.roomCode!);
    if (!room || room.status !== 'waiting') return;
    if (me.id !== room.hostId) return;
    const seated = [...room.players.values()].sort((a, b) => a.seat - b.seat);
    if (seated.length < 2) return;
    if (seated.some((p) => !p.ready)) return;
    const names = seated.map((p) => p.name);
    // 房主指定模式优先；未指定则按人数自动选：2人对赌 / 3-4积分制 / 5-8淘汰制
    const mode = room.mode ?? (seated.length === 2 ? 'duel' : seated.length <= 4 ? 'points' : 'elimination');
    // 每玩家个人卡组（绑定账号用其卡组，游客用默认 52 张花色牌）
    const baseDeckIds = buildBaseDeckDefs().map((d) => d.id);
    const playerDecks: Record<string, string[]> = {};
    for (const p of seated) {
      const ids = p.userId ? getDeckCards(p.userId).cards.map((c) => c.cardId) : baseDeckIds;
      playerDecks[`p${p.seat}`] = room.enableSpecialCards ? ids : ids.filter((id) => baseDeckIds.includes(id));
    }
    room.game = createGame(names, {
      playerCount: seated.length,
      mode,
      winPoints: 3,
      enableRoyals: room.enableRoyals,
      enableSpecialCards: room.enableSpecialCards,
      playerDecks,
    });
    room.status = 'playing';
    room.log.push(`对局开始（${seated.length} 人 · ${mode}）`);
    for (const p of seated) p.ready = false;
    broadcast(room);
  });

  /* ---------- 服务器权威动作 ---------- */
  socket.on('game:action', (action: GameAction) => {
    const me = meInRoom();
    if (!me) return;
    const room = rooms.get(self.data.roomCode!);
    if (!room || room.status !== 'playing' || !room.game) return;
    if (action.playerId !== `p${me.seat}`) return; // 只能操作自己的座位
    try {
      room.game = apply(room.game, action, true);
      rewardWinners(room);
      broadcast(room);
    } catch (err) {
      console.warn('[moon21] 非法动作被忽略:', (err as Error).message);
    }
  });

  /* ---------- 进入下一轮 ---------- */
  socket.on('game:nextRound', () => {
    const me = meInRoom();
    if (!me) return;
    const room = rooms.get(self.data.roomCode!);
    if (!room || room.status !== 'playing' || !room.game) return;
    if (room.game.phase === 'gameOver') return;
    room.game = nextRound(room.game);
    broadcast(room);
  });

  /* ---------- 离开房间 ---------- */
  socket.on('room:leave', () => {
    const me = meInRoom();
    if (!me) return;
    const room = rooms.get(self.data.roomCode!);
    if (!room) return;
    room.players.delete(me.id);
    const timer = room.timers.get(me.id);
    if (timer) clearTimeout(timer);
    room.log.push(`${me.name} 离开房间`);
    // 房主离开则转移给剩余第一个玩家；房间空则销毁
    if (me.id === room.hostId) {
      const first = [...room.players.values()].sort((a, b) => a.seat - b.seat)[0];
      if (first) room.hostId = first.id;
    }
    socket.leave(room.roomCode);
    self.data = {};
    if (room.players.size === 0) rooms.delete(room.roomCode);
    else broadcast(room);
  });

  socket.on('disconnect', () => {
    onPlayerDisconnect(socket.id);
  });
});

const PORT = Number(process.env.PORT) || 4000;
server.listen(PORT, () => {
  console.log(`[moon21] server listening on http://localhost:${PORT}`);
});
