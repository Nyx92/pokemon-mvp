"use client";
/**
 * Navbar — fixed top navigation bar.
 *
 * When the user is logged in, clicking the profile button opens a dropdown menu
 * instead of navigating directly. The dropdown links to all account-section pages
 * (Profile, Watchlist, Purchases, Offers, Sold) and has a Log Out item at the bottom.
 *
 * The same nav items are mirrored in ProfileSidebar so both surfaces stay in sync.
 * If you add a new account page, update NAV_ITEMS in ProfileSidebar.tsx too.
 */

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  AppBar, Box, Button, Container, Divider, IconButton,
  ListItemIcon, Menu, MenuItem, Toolbar, Typography,
} from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import GavelIcon from "@mui/icons-material/Gavel";
import SellOutlinedIcon from "@mui/icons-material/SellOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import { useAuth } from "@/app/hooks/useAuth";

// ── Dropdown nav items ────────────────────────────────────────────────────────
// Mirrors the NAV_ITEMS list in ProfileSidebar.tsx — keep them in sync.
const ACCOUNT_ITEMS = [
  { label: "Profile",   href: "/profile",   Icon: PersonOutlineIcon },
  { label: "Watchlist", href: "/watchlist", Icon: BookmarkBorderIcon },
  { label: "Purchases", href: "/purchases", Icon: ShoppingBagOutlinedIcon },
  { label: "Offers",    href: "/offers",    Icon: GavelIcon },
  { label: "Sold",      href: "/sold",      Icon: SellOutlinedIcon },
] as const;

const DARK = "#ffffff";

export default function Navbar() {
  const { user, isLoggedIn } = useAuth();
  const router = useRouter();
  const displayUser = user?.username ?? "Profile";

  // ── Dropdown state ────────────────────────────────────────────────────────────
  // anchorEl is the DOM element the Menu positions itself against.
  // null = closed, HTMLElement = open.
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  const handleOpenMenu  = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
  const handleCloseMenu = () => setAnchorEl(null);

  const handleNavItem = (href: string) => {
    handleCloseMenu();
    router.push(href);
  };

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
            style={{ display: "flex", alignItems: "center", textDecoration: "none", flexShrink: 0 }}
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
              src="/collateral/logo.png"
              alt="A logo"
              width={56}
              height={56}
              style={{ objectFit: "contain", filter: "invert(1)", mixBlendMode: "screen" }}
            />
            <Typography sx={{ fontWeight: 700, fontSize: 18, color: "#ffffff", letterSpacing: "0.04em" }}>
              MXYYC
            </Typography>
          </Link>

          {/* ── Spacer ────────────────────────────────────────────────────── */}
          <Box sx={{ flex: 1 }} />

          {/* ── Icon buttons ──────────────────────────────────────────────── */}
          <IconButton aria-label="Cart" sx={{ color: "#ffffff", "&:hover": { backgroundColor: "rgba(255,255,255,0.10)" } }}>
            <ShoppingCartOutlinedIcon fontSize="small" />
          </IconButton>

          <IconButton aria-label="Notifications" sx={{ color: "#ffffff", mr: 0.5, "&:hover": { backgroundColor: "rgba(255,255,255,0.10)" } }}>
            <NotificationsNoneIcon fontSize="small" />
          </IconButton>

          {/* Thin divider */}
          <Box sx={{ width: "1px", height: 20, backgroundColor: "rgba(255,255,255,0.20)", mx: 1 }} />

          {/* ── Auth ──────────────────────────────────────────────────────── */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {!isLoggedIn ? (
              <>
                <Button
                  href="/auth/signup"
                  disableElevation
                  sx={{ textTransform: "none", fontWeight: 700, fontSize: 14, px: 2.5, py: 0.85, borderRadius: "10px", backgroundColor: "rgba(255,255,255,0.20)", color: "#ffffff", border: "1px solid rgba(255,255,255,0.50)", "&:hover": { backgroundColor: "rgba(255,255,255,0.30)" } }}
                >
                  Sign up
                </Button>
                <Button
                  href="/auth/login"
                  sx={{ textTransform: "none", fontWeight: 500, fontSize: 14, color: "rgba(255,255,255,0.70)", "&:hover": { color: "#ffffff", backgroundColor: "transparent" } }}
                >
                  Login
                </Button>
              </>
            ) : (
              <>
                {/* Profile button — opens the dropdown on click */}
                <Button
                  onClick={handleOpenMenu}
                  disableElevation
                  aria-controls={menuOpen ? "account-menu" : undefined}
                  aria-haspopup="true"
                  aria-expanded={menuOpen ? "true" : undefined}
                  sx={{
                    textTransform: "none",
                    borderRadius: "10px",
                    px: 1.5,
                    py: 0.75,
                    color: DARK,
                    backgroundColor: menuOpen ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.15)",
                    border: "1px solid rgba(255,255,255,0.30)",
                    "&:hover": { backgroundColor: "rgba(255,255,255,0.25)" },
                    gap: 1,
                  }}
                >
                  <Box sx={{ width: 26, height: 26, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.20)", display: "grid", placeItems: "center" }}>
                    <PersonIcon sx={{ fontSize: 16, color: DARK }} />
                  </Box>
                  <Typography sx={{ fontWeight: 600, fontSize: 14, color: DARK }}>
                    {displayUser}
                  </Typography>
                </Button>

                {/* ── Account dropdown menu ── */}
                <Menu
                  id="account-menu"
                  anchorEl={anchorEl}
                  open={menuOpen}
                  onClose={handleCloseMenu}
                  // Align the left edge of the menu to the left edge of the button
                  anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                  transformOrigin={{ vertical: "top",    horizontal: "right" }}
                  slotProps={{
                    paper: {
                      sx: {
                        bgcolor: "#111827",
                        color: "#fff",
                        borderRadius: 2,
                        minWidth: 200,
                        mt: 0.75,              // small gap between button and menu
                        boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
                        "& .MuiMenuItem-root": {
                          fontSize: 14,
                          fontWeight: 500,
                          py: 1.2,
                          px: 2,
                          color: "rgba(255,255,255,0.85)",
                          "&:hover": { bgcolor: "rgba(255,255,255,0.08)", color: "#fff" },
                        },
                      },
                    },
                  }}
                >
                  {/* Account nav items */}
                  {ACCOUNT_ITEMS.map(({ label, href, Icon }) => (
                    <MenuItem key={href} onClick={() => handleNavItem(href)}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <Icon sx={{ fontSize: 18, color: "rgba(255,255,255,0.6)" }} />
                      </ListItemIcon>
                      {label}
                    </MenuItem>
                  ))}

                  <Divider sx={{ borderColor: "rgba(255,255,255,0.12)", my: 0.5 }} />

                  {/* Log Out — red tint to signal a destructive action */}
                  <MenuItem
                    onClick={() => { handleCloseMenu(); signOut({ callbackUrl: "/" }); }}
                    sx={{ color: "#f87171 !important", "&:hover": { bgcolor: "rgba(248,113,113,0.08) !important" } }}
                  >
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <LogoutIcon sx={{ fontSize: 18, color: "#f87171" }} />
                    </ListItemIcon>
                    Log Out
                  </MenuItem>
                </Menu>
              </>
            )}
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
