/**
 * 阶段 4：REST API 封装（认证 + 图鉴 + 收藏）。
 * 服务端地址：VITE_API_URL 或默认 http://localhost:4000。
 */
import type {
  AuthResponse,
  BuyResponse,
  CatalogResponse,
  CollectionResponse,
  DeckEquipRequest,
  DeckEquipResponse,
  DeckResponse,
  LoginRequest,
  RegisterRequest,
  ShopResponse,
  UserProfile,
} from '@moon21/shared';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000/api';

async function request<T>(
  path: string,
  opts: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `请求失败（${res.status}）`);
  return data;
}

export const api = {
  register: (body: RegisterRequest) => request<AuthResponse>('/auth/register', { method: 'POST', body }),
  login: (body: LoginRequest) => request<AuthResponse>('/auth/login', { method: 'POST', body }),
  me: (token: string) => request<UserProfile>('/auth/me', { token }),
  logout: (token: string) => request<{ ok: boolean }>('/auth/logout', { method: 'POST', token }),
  catalog: (token?: string | null) => request<CatalogResponse>('/cards', { token }),
  collection: (token: string) => request<CollectionResponse>('/collection', { token }),
  deck: (token: string) => request<DeckResponse>('/deck', { token }),
  shop: (token: string) => request<ShopResponse>('/shop', { token }),
  buy: (token: string, cardId: string) => request<BuyResponse>('/shop/buy', { method: 'POST', token, body: { cardId } }),
  equip: (token: string, body: DeckEquipRequest) => request<DeckEquipResponse>('/deck/equip', { method: 'POST', token, body }),
};
