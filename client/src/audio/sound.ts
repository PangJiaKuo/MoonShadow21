/** 游戏音频：背景音乐（长循环、可选本地音乐、可调音量）+ 停牌/爆牌自动停牌音效。 */

const VOLUME_KEY = 'moon21_bgm_volume';

let bgm: HTMLAudioElement | null = null;
let standSfx: HTMLAudioElement | null = null;
let started = false;
let currentBgmName = '月影背景乐（默认）';
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

/** 订阅背景音乐状态变化（播放/暂停/音量/曲目），返回取消订阅函数。 */
export function onBgmChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function bgmState() {
  initAudio();
  return {
    playing: started && !!bgm && !bgm.paused,
    name: currentBgmName,
    volume: bgm?.volume ?? 0.35,
  };
}

export function initAudio() {
  if (bgm) return;
  try {
    const saved = Number(localStorage.getItem(VOLUME_KEY) ?? '0.35');
    const vol = Number.isFinite(saved) ? Math.min(1, Math.max(0, saved)) : 0.35;
    bgm = new Audio('/audio/bgm.mp3');
    bgm.loop = true;
    bgm.volume = vol;
    standSfx = new Audio('/audio/stand.wav');
    standSfx.volume = 0.85;
  } catch {
    bgm = null;
    standSfx = null;
  }
}

/** 浏览器要求用户交互后才能出声：首次点击页面任意处时调用，启动背景音乐。 */
export function tryStartBgm() {
  initAudio();
  if (started || !bgm) return;
  started = true;
  bgm.play().catch(() => {});
  notify();
}

/** 切换背景音乐播放/暂停，返回是否正在播放。 */
export function toggleBgm(): boolean {
  initAudio();
  if (!bgm) return false;
  started = true;
  if (bgm.paused) {
    bgm.play().catch(() => {});
  } else {
    bgm.pause();
  }
  notify();
  return !bgm.paused;
}

/** 设置背景音乐音量（0-1），持久化到 localStorage。 */
export function setBgmVolume(v: number) {
  initAudio();
  const vol = Math.min(1, Math.max(0, v));
  if (bgm) bgm.volume = vol;
  try {
    localStorage.setItem(VOLUME_KEY, String(vol));
  } catch {
    // ignore
  }
  notify();
}

/** 读取当前音量（0-1）。 */
export function getBgmVolume(): number {
  initAudio();
  return bgm?.volume ?? 0.35;
}

/** 切换背景乐来源（本地文件/默认曲），播放中则立即切换并继续循环。 */
export function setBgmSource(url: string, name: string) {
  initAudio();
  if (!bgm) return;
  const wasPlaying = started && !bgm.paused;
  bgm.src = url;
  bgm.loop = true;
  currentBgmName = name;
  started = true;
  if (wasPlaying) bgm.play().catch(() => {});
  notify();
}

/** 恢复默认背景乐。 */
export function resetBgmSource() {
  setBgmSource('/audio/bgm.mp3', '月影背景乐（默认）');
}

/** 停牌 / 爆牌自动停牌音效（共用同一个音效）。 */
export function playStandSfx() {
  initAudio();
  if (!standSfx) return;
  try {
    standSfx.currentTime = 0;
    standSfx.play().catch(() => {});
  } catch {
    // ignore
  }
}
