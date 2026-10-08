/**
 * 阶段 4.5：商城 API。
 *  - GET  /shop      商城商品（10 张特殊卡，单价 100，显示是否已在卡组）
 *  - POST /shop/buy  购买特殊卡（扣金币，替换卡组中一张同点数普通卡）
 */
import { Router } from 'express';
import { authRequired } from './auth';
import { buySpecialCard, equipSpecialCard, getDeckCards, getShop, unequipSpecialCard } from './db';

export function createShopRouter(): Router {
  const router = Router();

  router.get('/deck', authRequired, (req, res) => {
    const userId = (req as { user?: { id: string } }).user!.id;
    res.json(getDeckCards(userId));
  });

  router.get('/shop', authRequired, (req, res) => {
    const userId = (req as { user?: { id: string } }).user!.id;
    res.json(getShop(userId));
  });

  router.post('/shop/buy', authRequired, (req, res) => {
    const userId = (req as { user?: { id: string } }).user!.id;
    const cardId = (req.body ?? {}).cardId;
    if (!cardId || typeof cardId !== 'string') {
      return res.status(400).json({ ok: false, coins: 0, error: '缺少 cardId' });
    }
    const r = buySpecialCard(userId, cardId);
    if (!r.ok) return res.status(400).json(r);
    return res.json(r);
  });

  // 装备已拥有的特殊卡到卡组：替换一张同点数卡
  router.post('/deck/equip', authRequired, (req, res) => {
    const userId = (req as { user?: { id: string } }).user!.id;
    const { cardId, targetCardId } = (req.body ?? {}) as { cardId?: string; targetCardId?: string };
    if (!cardId || !targetCardId) {
      return res.status(400).json({ ok: false, error: '缺少 cardId / targetCardId' });
    }
    const r = equipSpecialCard(userId, cardId, targetCardId);
    if (!r.ok) return res.status(400).json(r);
    return res.json(r);
  });

  // 取消装备：把特殊卡移出卡组
  router.post('/deck/unequip', authRequired, (req, res) => {
    const userId = (req as { user?: { id: string } }).user!.id;
    const { cardId } = (req.body ?? {}) as { cardId?: string };
    if (!cardId || typeof cardId !== 'string') {
      return res.status(400).json({ ok: false, error: '缺少 cardId' });
    }
    const r = unequipSpecialCard(userId, cardId);
    if (!r.ok) return res.status(400).json(r);
    return res.json(r);
  });

  return router;
}
