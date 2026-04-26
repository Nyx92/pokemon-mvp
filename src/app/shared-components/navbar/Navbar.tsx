"use client";

import Image from "next/image";
import Link from "next/link";
import {
  AppBar,
  Box,
  Button,
  Container,
  IconButton,
  Toolbar,
  Typography,
} from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import { useAuth } from "@/app/hooks/useAuth";

const DARK = "#ffffff";

export default function Navbar() {
  const { user, isLoggedIn } = useAuth();
  const displayUser = user?.username ?? "Profile";

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        height: 64,
        backgroundColor: "#000000",
        boxShadow: "0 2px 20px rgba(0, 0, 0, 0.40)",
        zIndex: 1300,
        overflow: "visible",
      }}
    >
      <Container maxWidth="xl" sx={{ height: "100%" }}>
        <Toolbar disableGutters sx={{ height: "100%" }}>
          {/* ── Logo ──────────────────────────────────────────────────────── */}
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              textDecoration: "none",
              flexShrink: 0,
            }}
          >
            {/*
              The logo is a JPEG (black line-art psyduck on a white background).
              Two CSS tricks remove the white background on a black navbar:

              1. filter: invert(1)
                 Flips every colour: black lines → white, white background → black.

              2. mix-blend-mode: screen
                 Screen blends the image with whatever is behind it.
                 On a black navbar, black pixels (0) screen black (0) = 0 → invisible.
                 White pixels (255) screen black (0) = 255 → stay white.
                 Result: black JPEG background disappears, white psyduck lines remain.

              If you ever switch to a light/white navbar, swap both tricks back to
              mix-blend-mode: multiply (and remove the invert filter) — multiply
              makes white pixels transparent on light backgrounds instead.
            */}
            <Image
              src="/collateral/Logo.jpeg"
              alt="PsyDex"
              width={56}
              height={56}
              style={{
                objectFit: "contain",
                filter: "invert(1)",
                mixBlendMode: "screen",
              }}
            />
            {/* Site name — inherits Inter from the root layout font */}
            <Typography
              sx={{
                fontWeight: 700,
                fontSize: 18,
                color: "#ffffff",
                letterSpacing: "0.04em",
              }}
            >
              MXYYC
            </Typography>
          </Link>

          {/* ── Ducks decoration ──────────────────────────────────────────── */}
          {/* <Box
            sx={{
              width: { xs: "70px", sm: "90px", md: "110px" },
              flexShrink: 0,
              alignSelf: "flex-end",
              transform: "translateY(33%)",
              pointerEvents: "none",
            }}
          >
            <Image
              src="/collateral/ducks_1.jpeg"
              alt="Ducks hanging on navbar"
              width={110}
              height={54}
              style={{ width: "100%", height: "auto", display: "block" }}
              priority
            />
          </Box> */}

          {/* ── Spacer ────────────────────────────────────────────────────── */}
          <Box sx={{ flex: 1 }} />

          {/* ── Icons (kept as direct Toolbar siblings so they don't affect  ── */}
          {/* ── the auth Box layout below)                                   ── */}
          <IconButton
            aria-label="Cart"
            sx={{
              color: "#ffffff",
              "&:hover": { backgroundColor: "rgba(255,255,255,0.10)" },
            }}
          >
            <ShoppingCartOutlinedIcon fontSize="small" />
          </IconButton>

          <IconButton
            aria-label="Notifications"
            sx={{
              color: "#ffffff",
              mr: 0.5,
              "&:hover": { backgroundColor: "rgba(255,255,255,0.10)" },
            }}
          >
            <NotificationsNoneIcon fontSize="small" />
          </IconButton>

          {/* Thin divider */}
          <Box
            sx={{
              width: "1px",
              height: 20,
              backgroundColor: "rgba(255,255,255,0.20)",
              mx: 1,
            }}
          />

          {/* ── Auth ──────────────────────────────────────────────────────── */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {!isLoggedIn ? (
              <>
                <Button
                  href="/auth/signup"
                  disableElevation
                  sx={{
                    textTransform: "none",
                    fontWeight: 700,
                    fontSize: 14,
                    px: 2.5,
                    py: 0.85,
                    borderRadius: "10px",
                    backgroundColor: "rgba(255,255,255,0.20)",
                    color: "#ffffff",
                    border: "1px solid rgba(255,255,255,0.50)",
                    "&:hover": { backgroundColor: "rgba(255,255,255,0.30)" },
                  }}
                >
                  Sign up
                </Button>

                <Button
                  href="/auth/login"
                  sx={{
                    textTransform: "none",
                    fontWeight: 500,
                    fontSize: 14,
                    color: "rgba(255,255,255,0.70)",
                    "&:hover": {
                      color: "#ffffff",
                      backgroundColor: "transparent",
                    },
                  }}
                >
                  Login
                </Button>
              </>
            ) : (
              <Button
                href="/profile"
                disableElevation
                sx={{
                  textTransform: "none",
                  borderRadius: "10px",
                  px: 1.5,
                  py: 0.75,
                  color: DARK,
                  backgroundColor: "rgba(255,255,255,0.15)",
                  border: "1px solid rgba(255,255,255,0.30)",
                  "&:hover": { backgroundColor: "rgba(255,255,255,0.25)" },
                  gap: 1,
                }}
              >
                <Box
                  sx={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    backgroundColor: "rgba(255,255,255,0.20)",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <PersonIcon sx={{ fontSize: 16, color: DARK }} />
                </Box>

                <Typography sx={{ fontWeight: 600, fontSize: 14, color: DARK }}>
                  {displayUser}
                </Typography>
              </Button>
            )}
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
