import { useState } from 'react';
import { motion } from 'framer-motion';
import type { GameMode } from '@moon21/shared';
import { useGameStore } from '../store/useGameStore';
import { useAuthStore } from '../store/useAuthStore';
import { isNative } from '../isNative';

export function Menu() {
  const startGame = useGameStore((s) => s.startGame);
  const createRoom = useGameStore((s) => s.createRoom);
  const joinRoom = useGameStore((s) => s.joinRoom);
  const onlineError = useGameStore((s) => s.onlineError);
  const setScreen = useGameStore((s) => s.setScreen);
  const authUser = useAuthStore((s) => s.user);
  const authToken = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);

  // 热座（2-8 人）
  const [hotseatCount, setHotseatCount] = useState(2);
  const [hotNames, setHotNames] = useState(['庄家', '对手', '玩家3', '玩家4', '玩家5', '玩家6', '玩家7', '玩家8']);
  const [royals, setRoyals] = useState(true);
  const [specials, setSpecials] = useState(true);
  const [hotseatStake, setHotseatStake] = useState(false);
  // 人机
  const [aiName, setAiName] = useState('玩家');
  const [aiStake, setAiStake] = useState(false);

  // 联机
  const [createName, setCreateName] = useState('玩家');
  const [createMode, setCreateMode] = useState('auto');
  const [createPwd, setCreatePwd] = useState('');
  const [playersCount, setPlayersCount] = useState(2);
  const [joinName, setJoinName] = useState('玩家');
  const [joinCode, setJoinCode] = useState('');
  const [joinPwd, setJoinPwd] = useState('');

  // 单机 APK（Capacitor 原生）环境：隐藏依赖后端的在线对战与账号入口
  const native = isNative();

  const toggle = 'w-11 h-6 rounded-full transition';
  const knob = 'block w-4 h-4 rounded-full bg-abyss transition-transform';
  const field =
    'bg-felt gold-frame rounded-lg px-3 py-2 w-44 text-center focus:outline-none focus:ring-1 focus:ring-brass';

  return (
    <motion.div
      className="min-h-screen flex flex-col items-center justify-center gap-8 px-4 py-8"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="text-center">
        <div className="text-5xl mb-3">✦</div>
        <h1 className="font-display text-5xl text-gold tracking-[0.3em]">月影二十一</h1>
        <p className="mt-2 text-parchment/60 tracking-widest">M O O N S H A D O W · 2 1</p>
      </div>

      {/* 用户栏（阶段 4）：原生 APK 环境隐藏（依赖后端账号） */}
      {!native && (
        <div className="flex items-center gap-2 max-w-md w-full flex-wrap justify-center">
          {authToken && authUser ? (
            <>
              <span className="gold-frame rounded-full px-3 py-1 text-sm text-gold tracking-widest">
                {authUser.username} · {authUser.coins} 金币
              </span>
              <button onClick={() => setScreen('deck')} className="px-3 py-1.5 rounded-lg gold-frame text-sm text-gold hover:bg-brass/15 transition">
                卡组
              </button>
              <button onClick={() => setScreen('collection')} className="px-3 py-1.5 rounded-lg gold-frame text-sm text-gold hover:bg-brass/15 transition">
                收藏
              </button>
              <button onClick={() => setScreen('shop')} className="px-3 py-1.5 rounded-lg gold-frame text-sm text-gold hover:bg-brass/15 transition">
                商城
              </button>
              <button onClick={logout} className="px-3 py-1.5 rounded-lg text-sm text-parchment/60 hover:text-parchment transition">
                退出
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setScreen('auth')} className="px-3 py-1.5 rounded-lg gold-frame text-sm text-gold hover:bg-brass/15 transition">
                登录 / 注册
              </button>
              <button onClick={() => setScreen('deck')} className="px-3 py-1.5 rounded-lg gold-frame text-sm text-gold hover:bg-brass/15 transition">
                卡组
              </button>
              <button onClick={() => setScreen('shop')} className="px-3 py-1.5 rounded-lg gold-frame text-sm text-gold hover:bg-brass/15 transition">
                商城
              </button>
            </>
          )}
        </div>
      )}

      {onlineError && (
        <div className="text-crimson text-sm border border-crimson/40 rounded-lg px-3 py-1.5 max-w-sm text-center">
          {onlineError}
        </div>
      )}

      {/* 本地热座 */}
      <div className="card-face gold-frame rounded-2xl p-6 w-full max-w-md shadow-gold flex flex-col gap-4">
        <div className="text-parchment/50 text-xs tracking-widest text-center">本地热座 · {hotseatCount} 人对战（同屏轮流操作）</div>
        <div className="flex flex-col gap-3">
          <label className="flex items-center justify-between">
            <span className="text-parchment/70 text-sm">人数</span>
            <select
              value={hotseatCount}
              onChange={(e) => setHotseatCount(Number(e.target.value))}
              className={`${field} bg-abyss`}
            >
              {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>
                  {n} 人
                </option>
              ))}
            </select>
          </label>
          {Array.from({ length: hotseatCount }, (_, i) => (
            <label key={i} className="flex items-center justify-between">
              <span className="text-parchment/70 text-sm">玩家 {i + 1}</span>
              <input
                value={hotNames[i]}
                onChange={(e) =>
                  setHotNames((prev) => {
                    const next = [...prev];
                    next[i] = e.target.value;
                    return next;
                  })
                }
                className={field}
                maxLength={8}
                placeholder={`玩家${i + 1}`}
              />
            </label>
          ))}
          <label className="flex items-center justify-between cursor-pointer select-none">
            <span className="text-parchment/70 text-sm">启用皇帝 / 皇后</span>
            <button type="button" onClick={() => setRoyals((v) => !v)} className={`${toggle} ${royals ? 'bg-brass' : 'bg-felt border border-brass/40'}`}>
              <span className={`${knob} ${royals ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </label>
          <label className="flex items-center justify-between cursor-pointer select-none">
            <span className="text-parchment/70 text-sm">启用特殊卡</span>
            <button type="button" onClick={() => setSpecials((v) => !v)} className={`${toggle} ${specials ? 'bg-brass' : 'bg-felt border border-brass/40'}`}>
              <span className={`${knob} ${specials ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </label>
          <label className="flex items-center justify-between cursor-pointer select-none">
            <span className="text-parchment/70 text-sm">积分赛（筹码押注）</span>
            <button type="button" onClick={() => setHotseatStake((v) => !v)} className={`${toggle} ${hotseatStake ? 'bg-brass' : 'bg-felt border border-brass/40'}`}>
              <span className={`${knob} ${hotseatStake ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </label>
        </div>
        <button
          onClick={() =>
            startGame(
              Array.from({ length: hotseatCount }, (_, i) => hotNames[i].trim() || `玩家${i + 1}`),
              royals,
              specials,
              false,
              hotseatStake ? 'stake' : 'duel',
            )
          }
          className="py-3 rounded-xl font-display tracking-widest text-lg gold-frame text-gold hover:bg-brass/20 active:scale-95 transition"
        >
          开始 {hotseatCount} 人热座对战
        </button>
      </div>

      {/* 人机对战 */}
      <div className="card-face gold-frame rounded-2xl p-6 w-full max-w-md shadow-gold flex flex-col gap-4">
        <div className="text-parchment/50 text-xs tracking-widest text-center">人机对战 · 单机挑战电脑</div>
        <label className="flex items-center justify-between">
          <span className="text-parchment/70 text-sm">你的昵称</span>
          <input value={aiName} onChange={(e) => setAiName(e.target.value)} className={field} maxLength={8} />
        </label>
        <label className="flex items-center justify-between cursor-pointer select-none">
          <span className="text-parchment/70 text-sm">启用特殊卡</span>
          <button type="button" onClick={() => setSpecials((v) => !v)} className={`${toggle} ${specials ? 'bg-brass' : 'bg-felt border border-brass/40'}`}>
            <span className={`${knob} ${specials ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </label>
        <label className="flex items-center justify-between cursor-pointer select-none">
          <span className="text-parchment/70 text-sm">积分赛（筹码押注）</span>
          <button type="button" onClick={() => setAiStake((v) => !v)} className={`${toggle} ${aiStake ? 'bg-brass' : 'bg-felt border border-brass/40'}`}>
            <span className={`${knob} ${aiStake ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </label>
        <button
          onClick={() => startGame([aiName.trim() || '玩家', '电脑'], royals, specials, true, aiStake ? 'stake' : 'duel')}
          className="py-3 rounded-xl font-display tracking-widest gold-frame text-gold hover:bg-brass/20 active:scale-95 transition"
        >
          开始人机对战
        </button>
        <p className="text-center text-parchment/40 text-xs leading-relaxed">
          你与电脑轮流行动 · 电脑自动抽牌 / 停牌 / 使用特殊卡
        </p>
      </div>

      {/* 在线对战：原生 APK 环境隐藏（单机版，联机待后端部署后接入） */}
      {!native && (
        <div className="card-face gold-frame rounded-2xl p-6 w-full max-w-md shadow-gold flex flex-col gap-4">
          <div className="text-parchment/50 text-xs tracking-widest text-center">在线对战 · 房间联机（2-8 人）</div>

          {/* 创建房间 */}
          <div className="flex flex-col gap-3">
            <label className="flex items-center justify-between">
              <span className="text-parchment/70 text-sm">昵称</span>
              <input value={createName} onChange={(e) => setCreateName(e.target.value)} className={field} maxLength={8} />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-parchment/70 text-sm">房间密码（可选）</span>
              <input value={createPwd} onChange={(e) => setCreatePwd(e.target.value)} className={field} maxLength={12} placeholder="留空无密码" />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-parchment/70 text-sm">房间人数</span>
              <select
                value={playersCount}
                onChange={(e) => setPlayersCount(Number(e.target.value))}
                className={`${field} bg-abyss`}
              >
                {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>
                    {n} 人
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center justify-between">
              <span className="text-parchment/70 text-sm">模式</span>
              <select value={createMode} onChange={(e) => setCreateMode(e.target.value)} className={`${field} bg-abyss`}>
                <option value="auto">自动（按人数）</option>
                <option value="duel">对赌</option>
                <option value="points">积分制</option>
                <option value="elimination">淘汰制</option>
                <option value="stake">积分赛（筹码）</option>
              </select>
            </label>
            <div className="flex gap-2">
              <label className="flex flex-1 items-center justify-between cursor-pointer select-none">
                <span className="text-parchment/70 text-sm">皇家</span>
                <button type="button" onClick={() => setRoyals((v) => !v)} className={`${toggle} ${royals ? 'bg-brass' : 'bg-felt border border-brass/40'}`}>
                  <span className={`${knob} ${royals ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </label>
              <label className="flex flex-1 items-center justify-between cursor-pointer select-none">
                <span className="text-parchment/70 text-sm">特殊卡</span>
                <button type="button" onClick={() => setSpecials((v) => !v)} className={`${toggle} ${specials ? 'bg-brass' : 'bg-felt border border-brass/40'}`}>
                  <span className={`${knob} ${specials ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </label>
            </div>
            <button
              onClick={() => createRoom({ name: createName.trim() || '玩家', password: createPwd || undefined, maxPlayers: playersCount, enableRoyals: royals, enableSpecialCards: specials, mode: createMode === 'auto' ? undefined : (createMode as GameMode) })}
              className="py-3 rounded-xl font-display tracking-widest gold-frame text-gold hover:bg-brass/20 active:scale-95 transition"
            >
              创建房间
            </button>
          </div>

          <div className="border-t border-brass/20 my-1" />

          {/* 加入房间 */}
          <div className="flex flex-col gap-3">
            <label className="flex items-center justify-between">
              <span className="text-parchment/70 text-sm">昵称</span>
              <input value={joinName} onChange={(e) => setJoinName(e.target.value)} className={field} maxLength={8} />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-parchment/70 text-sm">房间码</span>
              <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} className={field} maxLength={6} placeholder="6 位房间码" />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-parchment/70 text-sm">密码（可选）</span>
              <input value={joinPwd} onChange={(e) => setJoinPwd(e.target.value)} className={field} maxLength={12} placeholder="留空无密码" />
            </label>
            <button
              onClick={() => joinRoom(joinCode.trim(), joinName.trim() || '玩家', joinPwd || undefined)}
              className="py-3 rounded-xl font-display tracking-widest gold-frame text-gold hover:bg-brass/20 active:scale-95 transition"
            >
              加入房间
            </button>
          </div>

          <p className="text-center text-parchment/40 text-xs leading-relaxed">
            阶段 3 · 在线房间 · 服务器权威对局
            <br />
            用房间码邀请朋友加入 · 断线可重连恢复
          </p>
        </div>
      )}
    </motion.div>
  );
}
