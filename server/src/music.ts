/**
 * 网络音乐代理（从 yinyueku.cn 爬取，MKOnlinePlayer / 网易云聚合）。
 *
 * - GET /api/music/hot          —— 热门榜单（网易云飙升榜歌单前 30，10 分钟缓存）
 * - GET /api/music/search?q=xx  —— 关键词搜索（最多 20 条）
 * - GET /api/music/play?id=&sign= —— 经 yinyueku 换取真实播放地址后代理音频流
 *
 * 说明：榜单 / 搜索 / 播放地址均来自 yinyueku.cn 公开接口（api.php），
 * 音频直链为网易云 CDN 带时效签名的地址，本站仅做学习用途转发，不下载不转存。
 * 站点证书校验异常，请求时使用 rejectUnauthorized:false。
 */

import { Router } from 'express';
import https from 'node:https';

const router = Router();

const YK = 'https://yinyueku.cn/api.php';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const HOT_PLAYLIST_ID = '19723756'; // 网易云飙升榜

const cache = new Map<string, { time: number; data: unknown }>();
const TTL = 10 * 60 * 1000;

function cacheGet(key: string): unknown | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.time > TTL) {
    cache.delete(key);
    return undefined;
  }
  return hit.data;
}

function cacheSet(key: string, data: unknown) {
  cache.set(key, { time: Date.now(), data });
}

/** 请求 yinyueku（忽略证书校验），返回解析后的 JSON。 */
function getJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': UA }, rejectUnauthorized: false }, (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => (data += chunk.toString('utf8')));
        res.on('end', () => {
          try {
            resolve(data ? JSON.parse(data) : {});
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

interface Track {
  id: number;
  name: string;
  artist: string;
  sign: string;
}

function mapTrack(song: any): Track {
  const artists = Array.isArray(song.artist) ? song.artist.join(' / ') : String(song.artist ?? '');
  return {
    id: Number(song.id ?? song.url_id ?? 0),
    name: String(song.name ?? '未知曲目'),
    artist: artists || '未知歌手',
    sign: String(song.sign ?? ''),
  };
}

router.get('/music/hot', async (_req, res) => {
  try {
    const cached = cacheGet('hot');
    if (cached) return res.json(cached);
    const json = await getJson(`${YK}?types=playlist&id=${HOT_PLAYLIST_ID}&source=netease`);
    const tracks: Track[] = (Array.isArray(json) ? json : []).slice(0, 30).map(mapTrack);
    if (tracks.length === 0) throw new Error('empty hot list');
    cacheSet('hot', tracks);
    res.json(tracks);
  } catch {
    res.status(502).json({ error: '热门音乐榜单获取失败，请稍后再试' });
  }
});

router.get('/music/search', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (!q) return res.status(400).json({ error: '缺少搜索词' });
  try {
    const url = `${YK}?types=search&count=20&pages=1&name=${encodeURIComponent(q)}`;
    const json = await getJson(url);
    const tracks: Track[] = (Array.isArray(json) ? json : []).map(mapTrack);
    res.json(tracks);
  } catch {
    res.status(502).json({ error: '音乐搜索失败，请稍后再试' });
  }
});

router.get('/music/play', async (req, res) => {
  const id = String(req.query.id ?? '');
  const sign = String(req.query.sign ?? '');
  if (!/^\d+$/.test(id) || !sign) return res.status(400).json({ error: '参数错误' });
  try {
    // 1) 向 yinyueku 换取真实播放地址（带时效签名）
    const json = await getJson(`${YK}?types=url&id=${id}&source=netease&sign=${encodeURIComponent(sign)}`);
    const mp3 = json?.url;
    if (!mp3 || typeof mp3 !== 'string') return res.status(404).json({ error: '该曲目暂不可试听' });
    // 2) 代理网易云 CDN 音频流（带 Referer 防防盗链）
    https
      .get(mp3, { headers: { 'User-Agent': UA, Referer: 'https://yinyueku.cn/' }, rejectUnauthorized: false }, (up) => {
        if (!up.statusCode || up.statusCode >= 400) {
          res.status(502).json({ error: '获取播放流失败' });
          return;
        }
        res.setHeader('Content-Type', up.headers['content-type'] ?? 'audio/mpeg');
        res.setHeader('Cache-Control', 'no-store');
        up.pipe(res);
      })
      .on('error', () => {
        if (!res.headersSent) res.status(502).json({ error: '获取播放流失败' });
        else res.end();
      });
  } catch {
    if (!res.headersSent) res.status(502).json({ error: '获取播放流失败' });
  }
});

export function createMusicRouter(): Router {
  return router;
}
