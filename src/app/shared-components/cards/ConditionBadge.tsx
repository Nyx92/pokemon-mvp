import { Box, Typography } from "@mui/material";

// ── Raw grade shorthands ──────────────────────────────────────────────────────
const RAW_MAP: Record<
  string,
  { label: string; border: string; bg: string; color: string }
> = {
  mint: { label: "M", border: "#2e7d32", bg: "#f1f8f1", color: "#2e7d32" },
  "near mint": {
    label: "NM",
    border: "#388e3c",
    bg: "#f1f8f1",
    color: "#388e3c",
  },
  "lightly played": {
    label: "LP",
    border: "#e65100",
    bg: "#fff8f1",
    color: "#e65100",
  },
  "moderately played": {
    label: "MP",
    border: "#bf360c",
    bg: "#fff3ee",
    color: "#bf360c",
  },
  "heavily played": {
    label: "HP",
    border: "#c62828",
    bg: "#fff0f0",
    color: "#c62828",
  },
  damaged: { label: "DMG", border: "#6a1fa0", bg: "#f8f0ff", color: "#6a1fa0" },
};

// ── Company accent colours ────────────────────────────────────────────────────
const COMPANY_STYLE: Record<
  string,
  { border: string; bg: string; color: string }
> = {
  PSA: { border: "#c8102e", bg: "#fff0f0", color: "#c8102e" },
  BGS: { border: "#1565c0", bg: "#f0f4ff", color: "#1565c0" },
  CGC: { border: "#4527a0", bg: "#f5f0ff", color: "#4527a0" },
  SGC: { border: "#00695c", bg: "#f0faf8", color: "#00695c" },
};

// ── Shared pill renderer ──────────────────────────────────────────────────────
function Badge({
  label,
  border,
  bg,
  color,
}: {
  label: string;
  border: string;
  bg: string;
  color: string;
}) {
  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        px: 1,
        py: 0.3,
        borderRadius: "6px",
        backgroundColor: bg,
        border: `1.5px solid ${border}`,
      }}
    >
      <Typography
        sx={{
          fontSize: "0.65rem",
          fontWeight: 800,
          color,
          letterSpacing: "0.5px",
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ConditionBadge({
  condition,
}: {
  condition?: string | null;
}) {
  if (!condition) return null;

  const normalized = condition.trim().toLowerCase();

  // Raw grade
  const raw = RAW_MAP[normalized];
  if (raw) {
    return (
      <Badge
        label={raw.label}
        border={raw.border}
        bg={raw.bg}
        color={raw.color}
      />
    );
  }

  // PSA X
  const psaMatch = condition.match(/^PSA\s+(\d+(?:\.\d+)?)$/i);
  if (psaMatch) {
    const s = COMPANY_STYLE.PSA;
    return <Badge label={`PSA ${psaMatch[1]}`} {...s} />;
  }

  // Beckett / BGS  e.g. "Beckett 9.5 Gem Mint"
  const beckettMatch = condition.match(/^Beckett\s+(\d+(?:\.\d+)?)/i);
  if (beckettMatch) {
    const s = COMPANY_STYLE.BGS;
    return <Badge label={`BGS ${beckettMatch[1]}`} {...s} />;
  }

  // CGC  e.g. "CGC 9.5 Gem Mint"
  const cgcMatch = condition.match(/^CGC\s+(\d+(?:\.\d+)?)/i);
  if (cgcMatch) {
    const s = COMPANY_STYLE.CGC;
    return <Badge label={`CGC ${cgcMatch[1]}`} {...s} />;
  }

  // SGC  e.g. "SGC 9.5 Gem Mint"
  const sgcMatch = condition.match(/^SGC\s+(\d+(?:\.\d+)?)/i);
  if (sgcMatch) {
    const s = COMPANY_STYLE.SGC;
    return <Badge label={`SGC ${sgcMatch[1]}`} {...s} />;
  }

  // Fallback
  return (
    <Typography variant="caption" sx={{ color: "text.secondary" }}>
      {condition}
    </Typography>
  );
}
