"use client";

import React, { useRef, useEffect } from "react";
import { Box, Typography, Button } from "@mui/material";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function DuckReveal() {
  const containerRef = useRef<HTMLDivElement>(null);
  const duckLeftRef = useRef<HTMLDivElement>(null);
  const duckRightRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handleScroll = () => {
      if (
        !containerRef.current ||
        !duckLeftRef.current ||
        !duckRightRef.current ||
        !textRef.current
      )
        return;

      const rect = containerRef.current.getBoundingClientRect();
      const scrollable = containerRef.current.offsetHeight - window.innerHeight;
      // Begin splitting while section is still scrolling into view (before it sticks)
      const earlyStart = window.innerHeight * 0.85;
      const totalRange = scrollable + earlyStart;
      const scrolled = earlyStart - rect.top;
      const raw = Math.max(0, Math.min(1, scrolled / totalRange));
      const progress = Math.min(1, raw * 2.5);

      const maxOffset = 380;
      duckLeftRef.current.style.transform = `translate(calc(-100% - ${progress * maxOffset}px), -50%)`;
      duckRightRef.current.style.transform = `translate(${progress * maxOffset}px, -50%)`;

      const opacity = Math.min(1, progress / 0.4);
      const scale = 0.88 + opacity * 0.12;
      textRef.current.style.opacity = String(opacity);
      textRef.current.style.transform = `translate(-50%, -50%) scale(${scale})`;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <Box ref={containerRef} sx={{ height: "100vh", position: "relative" }}>
      <Box
        sx={{
          position: "sticky",
          top: 0,
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          bgcolor: "#f8f9fb",
        }}
      >
        {/* Revealed centre text */}
        <Box
          ref={textRef}
          style={{ opacity: 0, transform: "translate(-50%, -50%) scale(0.88)" }}
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            textAlign: "center",
            zIndex: 1,
            width: { xs: "min(680px, 90vw)", md: "680px" },
            pointerEvents: "none",
          }}
        >
          {/* Logo + brand name */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              mb: 2,
            }}
          >
            <Image
              src="/collateral/logo.png"
              alt="MXYYC logo"
              width={160}
              height={160}
              style={{ mixBlendMode: "multiply" }}
            />

            <Typography
              component="span"
              sx={{
                fontSize: { xs: "3.6rem", sm: "5rem" },
                fontWeight: 700,
                letterSpacing: "0.04em",
                color: "#1a1a2e",
                lineHeight: 1,
                fontFamily: "'Segoe UI', system-ui, sans-serif",
              }}
            >
              MXYYC
            </Typography>
          </Box>

          {/* Big heading */}
          <Typography
            sx={{
              fontSize: { xs: "1.4rem", sm: "1.75rem", md: "2rem" },
              fontWeight: 700,
              color: "#1a1a2e",
              mb: 1.5,
              lineHeight: 1.25,
              fontFamily: "'Segoe UI', system-ui, sans-serif",
            }}
          >
            Your Trusted Pokémon TCG Marketplace
          </Typography>

          <Typography
            sx={{
              fontSize: { xs: "0.9rem", sm: "1rem" },
              color: "#555",
              mb: 2,
              lineHeight: 1.6,
            }}
          >
            Offers are binding. Cards are authenticated. Trade with confidence.
          </Typography>

          <Button
            variant="contained"
            startIcon={<ShoppingCartIcon />}
            onClick={() => router.push("/marketplace")}
            sx={{
              bgcolor: "#5b7fe8",
              borderRadius: "10px",
              px: 4,
              py: 1.4,
              fontSize: "1rem",
              fontWeight: 600,
              textTransform: "none",
              pointerEvents: "auto",
              "&:hover": { bgcolor: "#4a6fd4" },
            }}
          >
            Go to Marketplace
          </Button>
        </Box>

        {/* Duck Left — right edge starts at centre */}
        <Box
          ref={duckLeftRef}
          style={{ transform: "translate(-100%, -50%)" }}
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            zIndex: 2,
            userSelect: "none",
            pointerEvents: "none",
            lineHeight: 0,
            width: "clamp(347px, 53vw, 827px)",
          }}
        >
          <Image
            src="/collateral/duck_left.png"
            alt="duck"
            width={827}
            height={827}
            style={{ width: "100%", height: "auto" }}
            priority
          />
        </Box>

        {/* Duck Right — left edge starts at centre */}
        <Box
          ref={duckRightRef}
          style={{ transform: "translate(0%, -50%)" }}
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            zIndex: 2,
            userSelect: "none",
            pointerEvents: "none",
            lineHeight: 0,
            width: "clamp(347px, 53vw, 827px)",
          }}
        >
          <Image
            src="/collateral/duck_right.png"
            alt="duck"
            width={827}
            height={827}
            style={{ width: "100%", height: "auto" }}
            priority
          />
        </Box>
      </Box>
    </Box>
  );
}
