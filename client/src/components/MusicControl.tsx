import { useEffect, useRef, useState } from 'react';
import { onBgmChange, bgmState, toggleBgm, setBgmVolume, setBgmSource, resetBgmSource } from '../audio/sound';

/** 背景音乐控制面板：播放/暂停、音量滑块、选择本地音乐、恢复默认曲。 */
export function MusicControl() {
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [name, setName] = useState('月影背景乐（默认）');
  const [volume, setVolume] = useState(0.35);
  const fileRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="fixed bottom-3 right-3 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="card-face gold-frame rounded-xl px-4 py-3 bg-abyss/95 shadow-gold-lg w-64">
          <div className="flex items-center justify-between mb-2">
            <span className="font-display text-gold text-xs tracking-widest">背景音乐</span>
            <button
              onClick={() => resetBgmSource()}
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
          <button
            onClick={() => fileRef.current?.click()}
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
              if (f) setBgmSource(URL.createObjectURL(f), f.name);
            }}
          />
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
