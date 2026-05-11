"use client";
/**
 * ProfileContent — the right-panel content for the /profile account settings page.
 *
 * Rendered by src/app/profile/page.tsx (server component that handles the
 * auth guard). This component reads the session via useAuth and renders
 * all user data in three sections:
 *
 *   1. Personal Information — all available profile fields + EDIT button
 *   2. Account Authorization — shows linked email/auth method
 *   3. Advanced — Delete Account (UI only; delete API not yet implemented)
 *
 * EDIT button → /profile/edit/general (existing edit page, untouched)
 */

import { useRouter } from "next/navigation";
import {
  Box, Typography, Button, Avatar, Divider, CircularProgress,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";

import { useAuth } from "@/app/hooks/useAuth";
import AccountLayout from "@/app/shared-components/AccountLayout";

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Returns "—" for null/undefined/empty values so the UI never shows blanks. */
const safe = (val?: string | null) => val || "—";

// ── Sub-components ────────────────────────────────────────────────────────────

/**
 * A single labelled field in the Personal Information grid.
 * Renders a small uppercase label + value below it, matching the
 * HeaderMeta style used in transaction cards but for light backgrounds.
 */
function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px", mb: 0.4 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 14, color: "#111827", wordBreak: "break-word" }}>
        {value}
      </Typography>
    </Box>
  );
}

/** Wrapper for each settings card section (white rounded card). */
function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Box sx={{ bgcolor: "#fff", borderRadius: 2.5, border: "1px solid #c9cdd4", mb: 3, overflow: "hidden" }}>
      {/* Section header row */}
      <Box sx={{ px: 3, py: 2, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #c9cdd4" }}>
        <Typography sx={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>{title}</Typography>
        {action}
      </Box>
      <Box sx={{ px: 3, py: 3 }}>
        {children}
      </Box>
    </Box>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProfileContent() {
  const { user, status } = useAuth();
  const router = useRouter();

  // Session loading — show spinner while next-auth hydrates on the client.
  // The server component already confirmed the user is authenticated, so this
  // state is very brief (one render cycle).
  if (status === "loading" || !user) {
    return (
      <AccountLayout>
        <Box sx={{ display: "flex", justifyContent: "center", py: 12 }}>
          <CircularProgress />
        </Box>
      </AccountLayout>
    );
  }

  return (
    <AccountLayout>
      <Typography sx={{ fontSize: { xs: 24, md: 28 }, fontWeight: 800, letterSpacing: "-0.5px", mb: 3 }}>
        Account Settings
      </Typography>

      {/* ── Personal Information ── */}
      <Section
        title="Personal Information"
        action={
          <Button
            size="small"
            variant="outlined"
            startIcon={<EditIcon sx={{ fontSize: 15 }} />}
            onClick={() => router.push("/profile/edit/general")}
            sx={{ textTransform: "none", fontWeight: 600, fontSize: 13, borderRadius: 1.5, borderColor: "#c9cdd4", color: "#374151", "&:hover": { borderColor: "#9ca3af", bgcolor: "#f9fafb" } }}
          >
            Edit
          </Button>
        }
      >
        {/* Avatar */}
        <Box sx={{ mb: 3 }}>
          <Avatar
            src={user.image ?? ""}
            alt={user.username ?? ""}
            sx={{ width: 60, height: 60, bgcolor: "#e5e7eb", color: "#6b7280", fontSize: 22 }}
          >
            {(user.username ?? user.email ?? "?")[0].toUpperCase()}
          </Avatar>
        </Box>

        {/* Fields grid — 3 columns on desktop, 1 on mobile */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr" },
            gap: 3,
          }}
        >
          <InfoField label="Username"     value={safe(user.username)} />
          <InfoField label="First Name"   value={safe(user.firstName)} />
          <InfoField label="Last Name"    value={safe(user.lastName)} />
          <InfoField label="Email"        value={safe(user.email)} />
          <InfoField label="Country"      value={safe(user.country)} />
          <InfoField label="Gender"       value={safe(user.sex)} />
          <InfoField label="Date of Birth" value={safe(user.dob)} />
          <InfoField label="Address"      value={safe(user.address)} />
          <InfoField
            label="Phone Number"
            value={
              user.phoneNumber
                ? `${user.phoneNumber}${user.verified ? " (Verified)" : " (Unverified)"}`
                : "—"
            }
          />
          <InfoField
            label="Email Verification"
            value={user.emailVerified ? "Verified" : "Not verified"}
          />
        </Box>
      </Section>

      {/* ── Account Authorization ── */}
      <Section title="Account Authorization">
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              bgcolor: "#f3f4f6",
              display: "grid",
              placeItems: "center",
              fontSize: 16,
              fontWeight: 700,
              color: "#6b7280",
              flexShrink: 0,
            }}
          >
            {(user.email ?? "?")[0].toUpperCase()}
          </Box>
          <Box>
            <Typography sx={{ fontSize: 14, color: "#111827" }}>{safe(user.email)}</Typography>
            {user.emailVerified && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.3 }}>
                <CheckCircleOutlineIcon sx={{ fontSize: 13, color: "#059669" }} />
                <Typography sx={{ fontSize: 12, color: "#059669" }}>Verified</Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Section>

      {/* ── Advanced ── */}
      <Box sx={{ bgcolor: "#fff", borderRadius: 2.5, border: "1px solid #c9cdd4", overflow: "hidden" }}>
        <Box sx={{ px: 3, py: 2, borderBottom: "1px solid #c9cdd4" }}>
          <Typography sx={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>Advanced</Typography>
        </Box>
        <Box sx={{ px: 3, py: 3, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
          <Box>
            <Typography sx={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>Delete Account</Typography>
            <Typography sx={{ fontSize: 13, color: "#9ca3af", mt: 0.5 }}>
              Permanently delete your account, history, and all associated data.
              This action cannot be undone.
            </Typography>
          </Box>
          {/* TODO: wire up a DELETE /api/user endpoint with confirmation dialog */}
          <Button
            variant="contained"
            disabled
            sx={{
              bgcolor: "#dc2626",
              "&:hover": { bgcolor: "#b91c1c" },
              "&.Mui-disabled": { bgcolor: "#fca5a5", color: "#fff" },
              textTransform: "none",
              fontWeight: 700,
              borderRadius: 1.5,
              flexShrink: 0,
            }}
          >
            Delete Account
          </Button>
        </Box>

        <Divider />

        <Box sx={{ px: 3, py: 2 }}>
          <Typography sx={{ fontSize: 12, color: "#9ca3af" }}>
            Account deletion is not yet available. Contact support if you need to remove your account.
          </Typography>
        </Box>
      </Box>
    </AccountLayout>
  );
}
