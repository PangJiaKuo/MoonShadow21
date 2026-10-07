import { motion } from 'framer-motion';
import { useGameStore } from '../store/useGameStore';

export function Lobby() {
  const room = useGameStore((s) => s.roomState);
  const meId = useGameStore((s) => s.meId);
  const onlineError = useGameStore((s) => s.onlineError);
  const toggleReady = useGameStore((s) => s.toggleReady);
  const startOnline = useGameStore((s) => s.startOnline);
  const leaveOnline = useGameStore((s) => s.leaveOnline);

  if (!room) return <div className="min-h-screen flex items-center justify-center text-parchment/50">等待房间数据…</div>;

  const me = room.players.find((p) => p.id === meId);
  const isHost = me?.id === room.hostId;
  const allReady = room.players.length >= 2 && room.players.every((p) => p.ready);
  const canStart = isHost && allReady;

  return (
    <motion.div
      className="min-h-screen flex flex-col items-center justify-center gap-6 px-4"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="text-center">
        <h1 className="font-display text-4xl text-gold tracking-[0.3em]">月影二十一</h1>
        <p className="mt-1 text-parchment/50 tracking-widest text-sm">在线房间</p>
      </div>

      {/* 房间码 */}
      <div className="card-face gold-frame rounded-xl px-10 py-4 shadow-gold text-center">
        <div className="text-parchment/50 text-xs mb-1">房间码</div>
        <div className="font-display text-4xl text-gold tracking-[0.4em]">{room.roomCode}</div>
      </div>

      {/* 玩家列表 */}
      <div className="card-face gold-frame rounded-xl p-5 w-full max-w-sm shadow-gold">
        <div className="text-parchment/50 text-xs mb-3">
          {room.players.length} / {room.maxPlayers} 人
        </div>
        <div className="flex flex-col gap-2">
          {room.players.map((p) => (
            <div key={p.id} className="flex items-center justify-between gold-frame rounded-lg px-3 py-2 bg-black/20">
              <div className="flex items-center gap-2">
                <span className="font-display text-gold text-sm">{p.name}</span>
                <span className="text-parchment/40 text-xs">座位 {p.seat + 1}</span>
                {p.isHost && (
                  <span className="px-1.5 py-0.5 rounded border border-brass/50 text-brass text-[0.6rem]">房主</span>
                )}
                {!p.connected && (
                  <span className="px-1.5 py-0.5 rounded border border-crimson/50 text-crimson text-[0.6rem]">掉线</span>
                )}
              </div>
              <span
                className={`px-2 py-0.5 rounded-full border text-xs ${
                  p.ready ? 'border-brass text-brass' : 'border-parchment/30 text-parchment/40'
                }`}
              >
                {p.ready ? '已准备' : '未准备'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {onlineError && (
        <div className="text-crimson text-sm border border-crimson/40 rounded-lg px-3 py-1.5">{onlineError}</div>
      )}

      <div className="flex flex-col gap-3 w-full max-w-sm">
        <button
          onClick={toggleReady}
          className={`py-3 rounded-xl font-display tracking-widest gold-frame text-gold transition ${
            me?.ready ? 'bg-brass/20' : 'hover:bg-brass/20 active:scale-95'
          }`}
        >
          {me?.ready ? '取消准备' : '准备'}
        </button>
        <button
          onClick={startOnline}
          disabled={!canStart}
          className={`py-3 rounded-xl font-display tracking-widest text-gold transition ${
            canStart ? 'gold-frame hover:bg-brass/20 active:scale-95' : 'opacity-40 cursor-not-allowed'
          }`}
        >
          {isHost ? '开始对局' : '等待房主开始…'}
        </button>
        <button
          onClick={leaveOnline}
          className="py-2 rounded-xl border border-parchment/30 text-parchment/70 hover:text-crimson hover:border-crimson/50 transition text-sm"
        >
          离开房间
        </button>
      </div>
    </motion.div>
  );
}
