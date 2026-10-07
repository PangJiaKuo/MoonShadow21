import type { Suit } from '@moon21/shared';

export const SUIT_META: Record<Suit, { icon: string; label: string; color: string }> = {
  sun: { icon: '☀', label: '太阳', color: '#e8c876' },
  moon: { icon: '🌙', label: '月亮', color: '#c9b6ff' },
  star: { icon: '⭐', label: '星辰', color: '#ffe08a' },
  flower: { icon: '🌸', label: '花朵', color: '#f2b8d4' },
  special: { icon: '♛', label: '特殊', color: '#d9b36a' },
};

export function royalIcon(rank: string): string {
  return rank === 'Emperor' ? '♚' : '♛';
}
