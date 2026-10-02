import { Platform } from 'react-native';
import { parseWorkspace } from '../domain/workspace';
import type { WorkspaceRepository } from './repository';
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';
export type Account = { name?: string; id: string; email: string; role: 'user' | 'admin' };
export type Session = { token: string; user: Account };
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
export async function api<T>(path: string, token?: string, method = 'GET', body?: unknown): Promise<T> {
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${API_URL}${path}`, { method, signal: controller.signal, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    const result = await response.json();
    if (!response.ok) throw new ApiError(response.status, result.error ?? '操作失敗');
    return result;
  } catch (e) { if (e instanceof ApiError) throw e; throw new Error('無法連線到後端，請確認 API 已啟動後重試。'); }
  finally { clearTimeout(timeout); }
}
const sessionKey = 'qianmai.session.v1';
export function savedSession(): Session | null {
  try {
    const value = Platform.OS === 'web' ? JSON.parse(globalThis.sessionStorage.getItem(sessionKey) ?? 'null') : null;
    if (!value || typeof value.token !== 'string' || !/^[a-f0-9]{64}$/.test(value.token) || typeof value.user?.id !== 'string' || typeof value.user?.email !== 'string' || !['user', 'admin'].includes(value.user?.role)) return null;
    return value;
  } catch { return null; }
}
export function persistSession(session: Session | null) {
  if (Platform.OS === 'web') { try { if (session) globalThis.sessionStorage.setItem(sessionKey, JSON.stringify(session)); else globalThis.sessionStorage.removeItem(sessionKey); } catch { /* Memory-only session remains usable. */ } }
}
export function apiRepository(session: Session, expired: () => void): WorkspaceRepository {
  const request = async (method: string, data?: unknown) => {
    try { return parseWorkspace(await api(`/api/workspaces/${session.user.id}`, session.token, method, data)); }
    catch (e) { if (e instanceof ApiError && e.status === 401) expired(); throw e; }
  };
  return { load: () => request('GET'), save: data => request('PUT', data) };
}
