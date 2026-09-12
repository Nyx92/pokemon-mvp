"use client";
/**
 * EmptyState — the "nothing here yet" treatment shared by every account
 * page, the marketplace grid, and myCollection: an icon that springs in,
 * a title, an optional subtitle, and an optional call-to-action button.
 *
 * Previously each page hand-rolled its own version of this at a different
 * polish level (some animated with a CTA, some static text-only).
 */

import type { ReactElement } from "react";
import { Button, Typography } from "@mui/material";
import { motion } from "framer-motion";

export default function EmptyState({
  icon,
  title,
  subtitle,
  action,
  // "light" text for use over a dark/photographic background (e.g. marketplace).
  tone = "dark",
}: {
  // Pass a pre-sized icon, e.g. <SellIcon sx={{ fontSize: 40, color: "#d1d5db" }} />
  icon: ReactElement;
  title: string;
  subtitle?: string;
  action?: { label: string; onClick: () => void };
  tone?: "dark" | "light";
}) {
  const titleColor = tone === "light" ? "rgba(255,255,255,0.85)" : "#374151";
  const subtitleColor = tone === "light" ? "rgba(255,255,255,0.6)" : "text.secondary";
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      style={{ textAlign: "center", paddingTop: "48px", paddingBottom: "48px" }}
    >
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 14, delay: 0.1 }}
        style={{ display: "inline-block", marginBottom: 8 }}
      >
        {icon}
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.2 }}
      >
        <Typography sx={{ fontWeight: 700, fontSize: 17, color: titleColor, mb: 0.5 }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography sx={{ fontSize: 14, color: subtitleColor, mb: action ? 3 : 0 }}>
            {subtitle}
          </Typography>
        )}
        {action && (
          <Button
            variant="contained"
            onClick={action.onClick}
            sx={{ backgroundColor: "#111827", "&:hover": { backgroundColor: "#1f2937" } }}
          >
            {action.label}
          </Button>
        )}
      </motion.div>
    </motion.div>
  );
}
