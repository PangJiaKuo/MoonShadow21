import { useEffect, useRef, useState } from 'react';
import {
  onBgmChange,
  bgmState,
  toggleBgm,
  setBgmVolume,
  setBgmSource,
  resetBgmSource,
  getBgmElement,
} from '../audio/sound';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000/api';

interface Track {
  id: number;
  name: string;
  artist: string;
  sign: string;
}

/** 背景音乐控制面板：热门网络曲 / 搜索点播 / 播放暂停 / 音量 / 本地音乐 / 默认曲。 */
export function MusicControl() {
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [name, setName] = useState('月影背景乐（默认）');
  const [volume, setVolume] = useState(0.35);
  const [hot, setHot] = useState<Track[]>([]);
  const [search, setSearch] = useState<Track[]>([]);
  const [q, setQ] = useState('');
  const [mode, setMode] = useState<'hot' | 'search'>('hot');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [activeId, setActiveId] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const loadedHot = useRef(false);

  useEffect(() => {
    const sync = () => {
      const s = bgmState();
      setPlaying(s.playing);
      setName(s.name);
      setVolume(s.volume);
    };
    sync();
    return onBgmChange(sync);
  }, []);

  // 打开面板时自动加载热门榜单
  useEffect(() => {
    if (!open || loadedHot.current) return;
    loadedHot.current = true;
    setBusy(true);
    fetch(`${API_BASE}/music/hot`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('bad status'))))
      .then((list: Track[]) => setHot(Array.isArray(list) ? list : []))
      .catch(() => setErr('热门榜单加载失败，请确认后端已启动'))
      .finally(() => setBusy(false));
  }, [open]);

  const playTrack = (t: Track) => {
    setActiveId(t.id);
    setErr('');
    const el = getBgmElement();
    el?.removeEventListener('error', onPlayError);
    el?.addEventListener('error', onPlayError);
    setBgmSource(`${API_BASE}/music/play?id=${t.id}&sign=${encodeURIComponent(t.sign)}`, `${t.name} - ${t.artist}`);
  };

  const onPlayError = () => {
    setErr('该曲目暂不可试听（可能为 VIP 或已下架），已恢复默认曲');
    setActiveId(null);
    resetBgmSource();
  };

  const doSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const k = q.trim();
    if (!k) return;
    setBusy(true);
    setErr('');
    fetch(`${API_BASE}/music/search?q=${encodeURIComponent(k)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('bad status'))))
      .then((list: Track[]) => {
        setSearch(Array.isArray(list) ? list : []);
        setMode('search'); // 搜索后切换为只显示搜索结果
      })
      .catch(() => setErr('搜索失败，请稍后再试'))
      .finally(() => setBusy(false));
  };

  const renderList = (list: Track[], start: number) =>
    list.map((t, i) => (
      <button
        key={t.id}
        onClick={() => playTrack(t)}
        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition hover:bg-brass/15 ${
          activeId === t.id ? 'bg-brass/20 text-gold' : 'text-parchment/85'
        }`}
      >
        <span className="text-[10px] text-parchment/40 w-5 shrink-0 text-right">{start + i + 1}</span>
        <span className="flex-1 truncate text-xs">{t.name}</span>
        <span className="text-[10px] text-parchment/50 truncate max-w-[90px] shrink-0">{t.artist}</span>
        {activeId === t.id && <span className="text-gold text-xs shrink-0">♪</span>}
      </button>
    ));

  return (
    <div className="fixed bottom-3 right-3 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="card-face gold-frame rounded-xl px-4 py-3 bg-abyss/95 shadow-gold-lg w-80">
          <div className="flex items-center justify-between mb-2">
            <span className="font-display text-gold text-xs tracking-widest">背景音乐</span>
            <button
              onClick={() => {
                setActiveId(null);
                resetBgmSource();
              }}
              className="text-[10px] text-parchment/60 hover:text-gold transition"
            >
              默认曲
            </button>
          </div>
          <div className="text-[11px] text-parchment/70 truncate mb-2" title={name}>
            {name}
          </div>
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => toggleBgm()}
              className="px-3 py-1 rounded gold-frame text-gold text-xs hover:bg-brass/20 transition"
            >
              {playing ? '暂停' : '播放'}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(volume * 100)}
              onChange={(e) => setBgmVolume(Number(e.target.value) / 100)}
              className="flex-1 accent-brass"
            />
            <span className="text-[10px] text-parchment/60 w-8 text-right">{Math.round(volume * 100)}%</span>
          </div>

          {/* 热门 / 搜索 点播：两种模式互斥显示 */}
          <div className="max-h-56 overflow-y-auto mb-2 gold-frame rounded-lg bg-black/25 p-1 space-y-0.5">
            {busy && mode === 'search' ? (
              <div className="text-[11px] text-parchment/50 text-center py-4">搜索中…</div>
            ) : mode === 'search' ? (
              <>
                <div className="flex items-center justify-between px-2 pt-1 pb-0.5">
                  <span className="text-[10px] text-gold/60 tracking-widest">◆ 搜索结果（{search.length}）</span>
                  <button
                    onClick={() => setMode('hot')}
                    className="text-[10px] text-parchment/50 hover:text-gold transition"
                  >
                    ← 返回热门
                  </button>
                </div>
                {search.length > 0 ? (
                  renderList(search, 0)
                ) : (
                  <div className="text-[11px] text-parchment/50 text-center py-4">没有找到相关歌曲</div>
                )}
              </>
            ) : busy && hot.length === 0 ? (
              <div className="text-[11px] text-parchment/50 text-center py-4">加载中…</div>
            ) : (
              <>
                <div className="text-[10px] text-gold/60 tracking-widest px-2 pt-1 pb-0.5">◆ 热门榜</div>
                {hot.length > 0 ? renderList(hot, 0) : <div className="text-[11px] text-parchment/50 text-center py-4">暂无数据</div>}
              </>
            )}
          </div>

          <form onSubmit={doSearch} className="flex gap-1 mb-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索歌曲 / 歌手…"
              className="flex-1 bg-felt gold-frame rounded px-2 py-1 text-xs text-parchment focus:outline-none focus:ring-1 focus:ring-brass min-w-0"
            />
            <button
              type="submit"
              disabled={busy}
              className="px-3 py-1 rounded gold-frame text-gold text-xs hover:bg-brass/20 transition disabled:opacity-50"
            >
              搜索
            </button>
          </form>

          {err && <div className="text-[10px] text-red-300 mb-1">{err}</div>}

          <button
            onClick={() => {
              setActiveId(null);
              fileRef.current?.click();
            }}
            className="w-full py-1.5 rounded gold-frame text-gold text-xs hover:bg-brass/20 transition"
          >
            选择本地音乐
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setActiveId(null);
                setBgmSource(URL.createObjectURL(f), f.name);
              }
            }}
          />
          <div className="text-[9px] text-parchment/40 text-center mt-1.5">
            网络曲目来自 yinyueku.cn 公开接口（网易云音频直链），仅供个人试听
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-10 h-10 rounded-full card-face gold-frame flex items-center justify-center text-gold text-lg shadow-gold hover:bg-brass/20 transition"
        title="背景音乐设置"
      >
        ♪
      </button>
    </div>
  );
}
