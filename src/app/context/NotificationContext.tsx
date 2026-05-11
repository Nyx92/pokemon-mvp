"use client";
/**
 * NotificationContext — provides the unread notification count to the whole app.
 *
 * Connects to GET /api/notifications/stream (SSE) once the user is logged in.
 * The stream pushes { unreadCount } every 5 seconds so the navbar bell badge
 * updates in near-real-time without the client making repeated requests.
 *
 * EventSource auto-reconnects on connection drop (e.g. Vercel timeout), so
 * the badge always reflects the latest count shortly after reconnect.
 *
 * refresh() forces an immediate reconnect — call it after marking notifications
 * as read so the badge clears without waiting for the next 5-second tick.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/app/hooks/useAuth";

interface NotificationContextValue {
  unreadCount: number;
  refresh: () => void;
}

const NotificationContext = createContext<NotificationContextValue>({
  unreadCount: 0,
  refresh: () => {},
});

export function useNotifications(): NotificationContextValue {
  return useContext(NotificationContext);
}

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoggedIn } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  // Incrementing this key tears down and recreates the EventSource,
  // which triggers an immediate fresh count from the server.
  const [streamKey, setStreamKey] = useState(0);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Close any existing connection first (covers login/logout transitions)
    esRef.current?.close();

    if (!isLoggedIn) {
      setUnreadCount(0);
      return;
    }

    const es = new EventSource("/api/notifications/stream");
    esRef.current = es;

    es.onmessage = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as { unreadCount: number };
        setUnreadCount(data.unreadCount);
      } catch {
        // Malformed message — ignore.
      }
    };

    // onerror fires on connection drop. EventSource retries automatically;
    // we don't need to handle reconnection manually.
    es.onerror = () => {
      console.warn("[notifications] SSE connection error — will auto-reconnect.");
    };

    return () => {
      es.close();
    };
  // streamKey is intentionally included so refresh() restarts the connection.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, streamKey]);

  // Tears down and recreates the SSE connection so the server sends a fresh
  // count immediately rather than waiting for the next 5-second tick.
  const refresh = useCallback(() => setStreamKey((k) => k + 1), []);

  return (
    <NotificationContext.Provider value={{ unreadCount, refresh }}>
      {children}
    </NotificationContext.Provider>
  );
}
