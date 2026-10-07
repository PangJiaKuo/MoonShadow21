import { useEffect, useRef } from 'react';
import type { RoomState } from '@moon21/shared';
import { useGameStore } from './store/useGameStore';
import { useAuthStore } from './store/useAuthStore';
import { getSocket, loadRoom, net, clearRoom } from './net/socket';
import { Menu } from './components/Menu';
import { Lobby } from './components/Lobby';
import { Table } from './components/Table';
import { AuthPage } from './components/AuthPage';
import { CatalogPage } from './components/CatalogPage';
import { CollectionPage } from './components/CollectionPage';
import { DeckPage } from './components/DeckPage';
import { ShopPage } from './components/ShopPage';
import { isNative } from './isNative';

export default function App() {
  const screen = useGameStore((s) => s.screen);
  const rejoined = useRef(false);
  const authHydrated = useAuthStore((s) => s.hydrated);
  const hydrate = useAuthStore((s) => s.hydrate);

  // 恢复登录态：本地有 token 则拉取最新用户（金币）
  useEffect(() => {
    if (authHydrated) hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // 单机 APK（Capacitor 原生）环境：无后端，跳过联机 socket 初始化与断线重连
    if (isNative()) return;
    const s = getSocket();
    const onState = (room: RoomState) => {
      useGameStore.setState((st) => ({
        roomState: room,
        game: room.game,
        online: st.online || room.players.some((p) => p.id === st.meId),
        screen: room.status === 'playing' ? 'table' : 'lobby',
      }));
    };
    const onError = (error: string) => useGameStore.setState({ onlineError: error });
    // 断线重连：页面 reload 后自动恢复上次房间座位
    const doRejoin = () => {
      if (rejoined.current) return;
      const stored = loadRoom();
      if (!stored) return;
      rejoined.current = true;
      net.rejoin(
        { roomCode: stored.roomCode, playerId: stored.playerId, password: stored.password },
        (res) => {
          if (res.ok) {
            const seat = res.room.players.find((p) => p.id === res.meId)?.seat;
            useGameStore.setState({ online: true, meId: res.meId, myEngineId: `p${seat ?? 0}`, onlineError: null });
          } else {
            clearRoom();
          }
        },
      );
    };
    s.on('room:state', onState);
    s.on('room:error', onError);
    s.on('connect', doRejoin);
    if (s.connected) doRejoin();
    return () => {
      s.off('room:state', onState);
      s.off('room:error', onError);
      s.off('connect', doRejoin);
    };
  }, []);

  return (
    <div className="min-h-screen bg-abyss bg-radial-gold text-parchment">
      {screen === 'menu' ? <Menu /> : screen === 'lobby' ? <Lobby /> : screen === 'table' ? <Table /> : screen === 'auth' ? <AuthPage /> : screen === 'deck' ? <DeckPage /> : screen === 'shop' ? <ShopPage /> : screen === 'catalog' ? <CatalogPage /> : <CollectionPage />}
    </div>
  );
}
