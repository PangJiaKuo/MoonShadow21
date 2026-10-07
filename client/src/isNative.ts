/**
 * 判断是否运行在 Capacitor 原生容器（Android APK）内。
 * Web/浏览器环境下返回 false，走完整在线功能。
 */
export function isNative(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !!cap?.isNativePlatform?.();
}
