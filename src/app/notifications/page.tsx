"use client";
/**
 * /notifications — in-app notification centre.
 *
 * Shows all notifications for the current user, newest first.
 * Unread notifications are visually distinguished with an amber left border.
 *
 * Actions:
 *   - Click a notification → marks it read
 *   - Dismiss button (×) → deletes the notification
 *   - "Mark all read" button → bulk-marks all unread as read
 *
 * After any read/dismiss action, useNotifications().refresh() is called so the
 * navbar bell badge updates immediately without waiting for the next SSE tick.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  CircularProgress,
  Divider,
  IconButton,
  Tooltip,
  Typography,
  Button,
} from "@mui/material";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import GavelIcon from "@mui/icons-material/Gavel";
import SellOutlinedIcon from "@mui/icons-material/SellOutlined";
import CloseIcon from "@mui/icons-material/Close";

import { useAuth } from "@/app/hooks/useAuth";
import { useNotifications } from "@/app/context/NotificationContext";
import AccountLayout from "@/app/shared-components/AccountLayout";
import ErrorState from "@/app/shared-components/ErrorState";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  offerId: string | null;
  cardId: string | null;
  orderId: string | null;
  read: boolean;
  createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60)   return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// Icon and colour for each notification type
function typeConfig(type: string): { Icon: React.ElementType; color: string } {
  switch (type) {
    case "offer_received": return { Icon: GavelIcon,              color: "#f59e0b" };
    case "offer_accepted": return { Icon: CheckCircleOutlineIcon, color: "#10b981" };
    case "offer_rejected": return { Icon: CancelOutlinedIcon,     color: "#ef4444" };
    case "card_sold":      return { Icon: SellOutlinedIcon,       color: "#6366f1" };
    default:               return { Icon: NotificationsNoneIcon,  color: "#6b7280" };
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const { isLoggedIn, status } = useAuth();
  const router = useRouter();
  const { refresh: refreshBadge } = useNotifications();

  // ── Auth guard ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (status !== "loading" && !isLoggedIn) router.replace("/auth/login");
  }, [status, isLoggedIn, router]);

  // ── State ────────────────────────────────────────────────────────────────────
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchNotifications = useCallback(() => {
    if (!isLoggedIn) return;
    setLoading(true);
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => {
        if (d.notifications) setNotifications(d.notifications);
        else setError(d.error ?? "Failed to load notifications.");
      })
      .catch(() => setError("Failed to load notifications."))
      .finally(() => setLoading(false));
  }, [isLoggedIn]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // ── Derived counts ───────────────────────────────────────────────────────────
  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  // ── Actions ──────────────────────────────────────────────────────────────────

  // Mark a single notification as read (optimistic update + server sync)
  const markRead = useCallback(
    async (id: string) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      await fetch(`/api/notifications/${id}`, { method: "PATCH" });
      refreshBadge();
    },
    [refreshBadge]
  );

  // Dismiss (delete) a notification
  const dismiss = useCallback(
    async (id: string) => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      await fetch(`/api/notifications/${id}`, { method: "DELETE" });
      refreshBadge();
    },
    [refreshBadge]
  );

  // Bulk mark all as read
  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await fetch("/api/notifications", { method: "PATCH" });
    refreshBadge();
  }, [refreshBadge]);

  // ── Loading / auth wait ──────────────────────────────────────────────────────
  if (status === "loading" || !isLoggedIn) {
    return (
      <AccountLayout>
        <Box sx={{ display: "flex", justifyContent: "center", py: 12 }}>
          <CircularProgress />
        </Box>
      </AccountLayout>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  // 1. Show full-page error state so the user has a clear recovery path.
  if (error) {
    return (
      <AccountLayout>
        <ErrorState
          variant="error"
          title="Couldn't load notifications"
          action={{ label: "Refresh page", onClick: () => window.location.reload() }}
        />
      </AccountLayout>
    );
  }

  return (
    <AccountLayout>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 2,
          mb: 3,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Typography
            sx={{ fontSize: { xs: 24, md: 28 }, fontWeight: 800, letterSpacing: "-0.5px" }}
          >
            Notifications
          </Typography>
          {unreadCount > 0 && (
            <Box
              sx={{
                px: 1.2,
                py: 0.2,
                borderRadius: 99,
                backgroundColor: "#f59e0b",
                color: "#fff",
                fontSize: 12,
                fontWeight: 700,
                lineHeight: 1.6,
              }}
            >
              {unreadCount}
            </Box>
          )}
        </Box>

        {unreadCount > 0 && (
          <Button
            variant="outlined"
            size="small"
            onClick={markAllRead}
            sx={{
              textTransform: "none",
              fontWeight: 600,
              fontSize: 13,
              borderRadius: 2,
              borderColor: "#c9cdd4",
              color: "#374151",
              "&:hover": { borderColor: "#9ca3af", backgroundColor: "#f9fafb" },
            }}
          >
            Mark all read
          </Button>
        )}
      </Box>

      {/* List */}
      <Box
        sx={{
          backgroundColor: "#fff",
          borderRadius: 2.5,
          border: "1px solid #c9cdd4",
          overflow: "hidden",
        }}
      >
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
            <CircularProgress />
          </Box>
        ) : notifications.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 10 }}>
            <NotificationsNoneIcon sx={{ fontSize: 40, color: "#d1d5db", mb: 1 }} />
            <Typography sx={{ color: "#9ca3af", fontSize: 15 }}>
              You&apos;re all caught up — no notifications yet.
            </Typography>
          </Box>
        ) : (
          notifications.map((n, i) => {
            const { Icon, color } = typeConfig(n.type);
            return (
              <Box key={n.id}>
                {i > 0 && <Divider sx={{ borderColor: "#f3f4f6" }} />}
                <Box
                  onClick={() => !n.read && markRead(n.id)}
                  sx={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 2,
                    px: 2.5,
                    py: 2,
                    cursor: n.read ? "default" : "pointer",
                    // Amber left border flags unread notifications
                    borderLeft: n.read ? "3px solid transparent" : "3px solid #f59e0b",
                    backgroundColor: n.read ? "transparent" : "rgba(245,158,11,0.04)",
                    transition: "background-color 0.15s",
                    "&:hover": {
                      backgroundColor: n.read
                        ? "rgba(0,0,0,0.02)"
                        : "rgba(245,158,11,0.08)",
                    },
                  }}
                >
                  {/* Type icon */}
                  <Box
                    sx={{
                      width: 38,
                      height: 38,
                      borderRadius: "50%",
                      backgroundColor: `${color}18`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      mt: 0.25,
                    }}
                  >
                    <Icon sx={{ fontSize: 18, color }} />
                  </Box>

                  {/* Content */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      sx={{
                        fontSize: 14,
                        fontWeight: n.read ? 500 : 700,
                        color: "#111827",
                        lineHeight: 1.4,
                      }}
                    >
                      {n.title}
                    </Typography>
                    <Typography
                      sx={{ fontSize: 13, color: "#6b7280", mt: 0.3, lineHeight: 1.5 }}
                    >
                      {n.body}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: "#9ca3af", mt: 0.5 }}>
                      {timeAgo(n.createdAt)}
                    </Typography>
                  </Box>

                  {/* Dismiss button */}
                  <Tooltip title="Dismiss">
                    <IconButton
                      size="small"
                      onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
                      sx={{ color: "#9ca3af", flexShrink: 0, "&:hover": { color: "#374151" } }}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            );
          })
        )}
      </Box>
    </AccountLayout>
  );
}
