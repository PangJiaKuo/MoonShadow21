/**
 * 阶段 4：卡牌图鉴与收藏 API。
 *  - GET /cards      牌库图鉴（公开，游客 count=0）
 *  - GET /collection 我的收藏（需登录，返回拥有的卡及张数）
 */
import { Router } from 'express';
import { authRequired, getUserIdByToken } from './auth';
import { getCatalog, getCollection } from './db';

interface AuthedRequest {
  user?: { id: string };
}

export function createCollectionRouter(): Router {
  const router = Router();

  // 图鉴公开可看；带 token 时显示当前玩家拥有数量
  router.get('/cards', (req, res) => {
    const header = req.headers.authorization ?? '';
    const token = header.replace(/^Bearer\s+/i, '');
    const userId = token ? getUserIdByToken(token) : null;
    res.json(getCatalog(userId));
  });

  router.get('/collection', authRequired, (req, res) => {
    const userId = (req as AuthedRequest).user!.id;
    res.json(getCollection(userId));
  });

  return router;
}
