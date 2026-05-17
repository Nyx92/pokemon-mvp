"use client";

import React from "react";
import Link from "next/link";
import { Box, Button, Typography } from "@mui/material";
import CloudOffIcon from "@mui/icons-material/CloudOff";
import SearchOffIcon from "@mui/icons-material/SearchOff";

// ── Variant presets ────────────────────────────────────────────────────────────
// Each variant owns its icon, colours, and default copy. Callers can override
// title/subtitle when the context warrants a more specific message.

const VARIANTS = {
  error: {
    Icon:        CloudOffIcon,
    iconColor:   "#d97706",         // amber
    iconBg:      "#fef3c7",
    defaultTitle:    "Something went wrong",
    defaultSubtitle: "We couldn't load this page. Please try refreshing.",
  },
  not_found: {
    Icon:        SearchOffIcon,
    iconColor:   "#6b7280",         // neutral grey
    iconBg:      "#f3f4f6",
    defaultTitle:    "Not found",
    defaultSubtitle: "The page or item you're looking for doesn't exist.",
  },
} as const;

export type ErrorVariant = keyof typeof VARIANTS;

interface ErrorStateProps {
  variant: ErrorVariant;
  // Optional overrides — use when the default copy is too generic for the context.
  title?:    string;
  subtitle?: string;
  // Optional primary action button.
  action?: {
    label:    string;
    href?:    string;
    onClick?: () => void;
  };
}

// ── Component ─────────────────────────────────────────────────────────────────
// Renders a centred, icon-led error block. Used wherever a full page or section
// fails to load — card detail, auctions, etc.

export default function ErrorState({
  variant,
  title,
  subtitle,
  action,
}: ErrorStateProps) {
  const { Icon, iconColor, iconBg, defaultTitle, defaultSubtitle } =
    VARIANTS[variant];

  return (
    <Box
      sx={{
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "center",
        textAlign:      "center",
        px: 3,
        py: { xs: 10, md: 14 },
        maxWidth: 420,
        mx: "auto",
      }}
    >
      {/* Icon badge */}
      <Box
        sx={{
          width:           72,
          height:          72,
          borderRadius:    "50%",
          backgroundColor: iconBg,
          display:         "flex",
          alignItems:      "center",
          justifyContent:  "center",
          mb:              3,
        }}
      >
        <Icon sx={{ fontSize: 36, color: iconColor }} />
      </Box>

      {/* Heading */}
      <Typography
        sx={{
          fontSize:   { xs: 20, md: 22 },
          fontWeight: 700,
          color:      "#111",
          mb:         1,
          lineHeight: 1.25,
        }}
      >
        {title ?? defaultTitle}
      </Typography>

      {/* Subtext */}
      <Typography
        sx={{
          fontSize: 14,
          color:    "#6b7280",
          mb:       action ? 3.5 : 0,
          lineHeight: 1.6,
        }}
      >
        {subtitle ?? defaultSubtitle}
      </Typography>

      {/* Optional action */}
      {action && (
        action.href ? (
          <Button
            component={Link}
            href={action.href}
            variant="outlined"
            sx={{
              textTransform: "none",
              fontWeight:    600,
              borderColor:   "#d1d5db",
              color:         "#111",
              "&:hover":     { borderColor: "#9ca3af", backgroundColor: "#f9fafb" },
              borderRadius:  1.5,
              px:            3,
            }}
          >
            {action.label}
          </Button>
        ) : (
          <Button
            onClick={action.onClick}
            variant="outlined"
            sx={{
              textTransform: "none",
              fontWeight:    600,
              borderColor:   "#d1d5db",
              color:         "#111",
              "&:hover":     { borderColor: "#9ca3af", backgroundColor: "#f9fafb" },
              borderRadius:  1.5,
              px:            3,
            }}
          >
            {action.label}
          </Button>
        )
      )}
    </Box>
  );
}
