import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/useAuthStore';
import { useGameStore } from '../store/useGameStore';

/** 阶段 4：登录 / 注册页（当前仅昵称 + 密码）。 */
export function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const authError = useAuthStore((s) => s.authError);
  const setScreen = useGameStore((s) => s.setScreen);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    const ok = mode === 'login' ? await login(username, password) : await register(username, password);
    setBusy(false);
    if (ok) setScreen('menu');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        className="card-face gold-frame rounded-2xl w-full max-w-sm p-8 shadow-gold-lg"
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.25 }}
      >
        <div className="text-center mb-6">
          <div className="text-3xl mb-1">✦</div>
          <h1 className="font-display tracking-[0.3em] text-gold text-2xl">月影二十一</h1>
          <p className="text-parchment/50 text-xs mt-1">
            {mode === 'login' ? '登录以继续' : '注册新账号 · 初始发放全套特殊卡'}
          </p>
        </div>

        {/* 登录 / 注册切换 */}
        <div className="flex rounded-lg overflow-hidden border border-gold/40 mb-5">
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              className={`flex-1 py-2 text-sm tracking-widest transition-colors ${
                mode === m ? 'bg-brass/20 text-gold' : 'text-parchment/60 hover:text-parchment'
              }`}
              onClick={() => setMode(m)}
            >
              {m === 'login' ? '登 录' : '注 册'}
            </button>
          ))}
        </div>

        <label className="block mb-4">
          <span className="text-xs text-parchment/50 tracking-widest block mb-1">昵称</span>
          <input
            className="w-full gold-frame rounded-lg bg-black/30 px-3 py-2 outline-none focus:ring-1 focus:ring-gold/60"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="2-20 个字符"
            maxLength={20}
          />
        </label>

        <label className="block mb-5">
          <span className="text-xs text-parchment/50 tracking-widest block mb-1">密码</span>
          <input
            type="password"
            className="w-full gold-frame rounded-lg bg-black/30 px-3 py-2 outline-none focus:ring-1 focus:ring-gold/60"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="至少 4 位"
            maxLength={64}
          />
        </label>

        {authError ? (
          <div className="text-crimson text-sm mb-3 text-center">{authError}</div>
        ) : null}

        <button
          className="w-full py-2.5 rounded-lg gold-frame text-gold font-display tracking-widest hover:bg-brass/15 active:scale-[0.98] transition disabled:opacity-50"
          onClick={submit}
          disabled={busy || username.trim().length < 2 || password.length < 4}
        >
          {busy ? '处理中…' : mode === 'login' ? '登 录' : '注 册'}
        </button>

        <button
          className="w-full mt-3 py-2 rounded-lg text-parchment/60 hover:text-parchment text-sm transition"
          onClick={() => setScreen('menu')}
        >
          返回主菜单（游客）
        </button>
      </motion.div>
    </div>
  );
}
