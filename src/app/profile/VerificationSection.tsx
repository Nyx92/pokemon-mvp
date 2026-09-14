"use client";
/**
 * VerificationSection — email + phone OTP verification widget for the
 * /profile page. Both must be completed before the account can make any
 * purchase (buy now, cart checkout, offers, auction bids) — enforced
 * server-side by src/lib/purchaseVerification.ts; this UI is how a user
 * satisfies that gate.
 *
 * Neither channel takes free-text input here — a user verifies the email
 * and phone number already on their account, not an arbitrary one. Editing
 * either value happens on /profile/edit/general, which resets that
 * channel's verified status.
 */

import { useState } from "react";
import { Box, Typography, Button, TextField, Alert } from "@mui/material";
import { useRouter } from "next/navigation";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { useAuth } from "@/app/hooks/useAuth";

type ChannelState = "idle" | "codeSent";

async function postJson(url: string, body?: object) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(result.error || "Request failed");
  return result;
}

/** One row: current status + the send-code / enter-code flow for one channel. */
function VerificationRow({
  label,
  verified,
  onSendCode,
  onConfirmCode,
  /** Set when there's nothing to verify yet (e.g. no phone number on file). */
  blockedMessage,
}: {
  label: string;
  verified: boolean;
  onSendCode: () => Promise<void>;
  onConfirmCode: (code: string) => Promise<void>;
  blockedMessage?: string | null;
}) {
  const router = useRouter();
  const [state, setState] = useState<ChannelState>("idle");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSendCode();
      setState("codeSent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send code");
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirmCode(code);
      // Parent re-renders with verified=true once the session refreshes.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incorrect code");
    } finally {
      setBusy(false);
    }
  };

  if (verified) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        <Typography sx={{ fontSize: 14, color: "#111827", fontWeight: 600 }}>{label}</Typography>
        <CheckCircleOutlineIcon sx={{ fontSize: 15, color: "#059669" }} />
        <Typography sx={{ fontSize: 12, color: "#059669" }}>Verified</Typography>
      </Box>
    );
  }

  if (blockedMessage) {
    return (
      <Box>
        <Typography sx={{ fontSize: 14, color: "#111827", fontWeight: 600, mb: 0.5 }}>{label}</Typography>
        <Typography sx={{ fontSize: 13, color: "#6b7280" }}>
          {blockedMessage}{" "}
          <Typography
            component="span"
            onClick={() => router.push("/profile/edit/general")}
            sx={{ fontSize: 13, color: "#0053ff", fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}
          >
            Edit Profile
          </Typography>
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography sx={{ fontSize: 14, color: "#111827", fontWeight: 600, mb: 1 }}>{label}</Typography>

      {state === "idle" && (
        <Button
          size="small"
          variant="outlined"
          disabled={busy}
          onClick={handleSend}
          sx={{ textTransform: "none", fontWeight: 600, fontSize: 13, borderRadius: 1.5, borderColor: "#c9cdd4", color: "#374151", "&:hover": { borderColor: "#6b7280", bgcolor: "#f9fafb" } }}
        >
          {busy ? "Sending…" : "Send verification code"}
        </Button>
      )}

      {state === "codeSent" && (
        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
          <TextField
            size="small"
            variant="standard"
            placeholder="6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            sx={{ width: 140 }}
          />
          <Button
            size="small"
            variant="contained"
            disabled={busy || code.length !== 6}
            onClick={handleConfirm}
            sx={{ textTransform: "none", fontWeight: 700, borderRadius: 1.5, bgcolor: "#111827", "&:hover": { bgcolor: "#1f2937" } }}
          >
            {busy ? "Verifying…" : "Verify"}
          </Button>
          <Button
            size="small"
            disabled={busy}
            onClick={handleSend}
            sx={{ textTransform: "none", fontWeight: 600, fontSize: 12.5, color: "#6b7280" }}
          >
            Resend code
          </Button>
        </Box>
      )}

      {error && <Alert severity="error" sx={{ mt: 1, py: 0, fontSize: 12.5 }}>{error}</Alert>}
    </Box>
  );
}

export default function VerificationSection() {
  const { user, update } = useAuth();

  if (!user) return null;

  const emailVerified = !!user.emailVerified;
  const phoneVerified = !!user.phoneVerified;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <VerificationRow
        label={`Email — ${user.email}`}
        verified={emailVerified}
        onSendCode={() => postJson("/api/user/verify/email/request")}
        onConfirmCode={async (code) => {
          await postJson("/api/user/verify/email/confirm", { code });
          await update();
        }}
      />

      <VerificationRow
        label={user.phoneNumber ? `Phone — ${user.phoneNumber}` : "Phone Number"}
        verified={phoneVerified}
        blockedMessage={user.phoneNumber ? null : "No phone number on file."}
        onSendCode={() => postJson("/api/user/verify/phone/request")}
        onConfirmCode={async (code) => {
          await postJson("/api/user/verify/phone/confirm", { code });
          await update();
        }}
      />
    </Box>
  );
}
