/**
 * 阶段 4：认证 —— 注册（仅昵称+密码）、登录、token 会话。
 *
 *  - 密码使用 node:crypto scrypt 加盐哈希存储。
 *  - 登录成功后签发随机 token，内存 Map 保存（开发期，重启失效）。
 *  - 提供 Express 中间件从 Authorization: Bearer <token> 解析当前用户。
 */
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { Router, type Request, type Response, type NextFunction } from 'express';
import type { AuthResponse, LoginRequest, RegisterRequest, UserProfile } from '@moon21/shared';
import { createUser, ensureDeck, findUserByUsername } from './db';

/* ------------------------- 密码哈希（scrypt） ------------------------- */

function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, (err, key) => {
      if (err) return reject(err);
      resolve(`${salt}:${key.toString('hex')}`);
    });
  });
}

function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return Promise.resolve(false);
  return new Promise((resolve) => {
    scrypt(password, salt, 64, (err, key) => {
      if (err) return resolve(false);
      const a = Buffer.from(hash, 'hex');
      const b = key;
      resolve(a.length === b.length && timingSafeEqual(a, b));
    });
  });
}

/* ------------------------- token 会话 ------------------------- */

const sessions = new Map<string, string>(); // token -> userId

function issueToken(userId: string): string {
  const token = randomBytes(24).toString('hex');
  sessions.set(token, userId);
  return token;
}

export function getUserIdByToken(token: string | undefined): string | null {
  if (!token) return null;
  return sessions.get(token) ?? null;
}

export function logoutToken(token: string | undefined): void {
  if (token) sessions.delete(token);
}

/* ------------------------- 路由 ------------------------- */

export function createAuthRouter(): Router {
  const router = Router();

  router.post('/auth/register', async (req: Request, res: Response) => {
    const body = req.body as RegisterRequest;
    const username = (body.username ?? '').trim();
    const password = body.password ?? '';
    if (username.length < 2 || username.length > 20) {
      return res.status(400).json({ error: '昵称需为 2-20 个字符' });
    }
    if (password.length < 4 || password.length > 64) {
      return res.status(400).json({ error: '密码需为 4-64 个字符' });
    }
    const hash = await hashPassword(password);
    const user = createUser(username, hash);
    if (!user) return res.status(409).json({ error: '该昵称已被占用' });
    ensureDeck(user.id); // 注册即拥有默认 52 张花色牌卡组（特殊卡由商城购买）
    const payload: AuthResponse = { token: issueToken(user.id), user };
    return res.json(payload);
  });

  router.post('/auth/login', async (req: Request, res: Response) => {
    const body = req.body as LoginRequest;
    const username = (body.username ?? '').trim();
    const password = body.password ?? '';
    const found = findUserByUsername(username);
    if (!found || !(await verifyPassword(password, found.passwordHash))) {
      return res.status(401).json({ error: '昵称或密码错误' });
    }
    const payload: AuthResponse = { token: issueToken(found.id), user: found.profile };
    return res.json(payload);
  });

  router.get('/auth/me', authRequired, (req: Request, res: Response) => {
    const user = (req as { user?: UserProfile }).user!;
    return res.json(user);
  });

  router.post('/auth/logout', (req: Request, res: Response) => {
    const header = req.headers.authorization ?? '';
    logoutToken(header.replace(/^Bearer\s+/i, ''));
    return res.json({ ok: true });
  });

  return router;
}

/* ------------------------- 中间件 ------------------------- */

/** 认证中间件：解析 Authorization: Bearer <token>，挂载 req.user。 */
export function authRequired(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? '';
  const token = header.replace(/^Bearer\s+/i, '');
  const userId = getUserIdByToken(token);
  if (!userId) {
    res.status(401).json({ error: '未登录或登录已过期' });
    return;
  }
  // 延迟导入避免循环依赖
  import('./db').then(({ findUserById }) => {
    const user = findUserById(userId);
    if (!user) {
      res.status(401).json({ error: '用户不存在' });
      return;
    }
    (req as { user?: UserProfile }).user = user;
    next();
  }).catch(() => res.status(500).json({ error: '服务异常' }));
}
