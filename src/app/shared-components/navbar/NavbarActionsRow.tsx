"use client";

import { Box, Button, Typography } from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import { MenuKey } from "./DropdownStoreData";

type Props = {
  isDesktopDropdownOpen: boolean;
  onNavigate: (page: MenuKey) => void;
  onMouseEnter: (page: MenuKey) => void;
  onMouseLeave: () => void;
  profileName: string;

  // auth
  isLoggedIn: boolean;
  onSignUp: () => void;
  onSignIn: () => void;
  onProfile: () => void;
};

export default function NavbarActionsRow({
  isDesktopDropdownOpen,
  onNavigate,
  onMouseEnter,
  onMouseLeave,
  isLoggedIn,
  onSignUp,
  onSignIn,
  onProfile,
  profileName,
}: Props) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", flex: 1 }}>
      {/* RIGHT: auth actions */}
      <Box
        sx={{
          display: { xs: "none", md: "flex" },
          alignItems: "center",
          gap: 2,
          ml: "auto",
        }}
      >
        {!isLoggedIn ? (
          <>
            <Button
              onClick={onSignUp}
              sx={{
                textTransform: "none",
                px: 3,
                py: 1.1,
                fontWeight: 600,
                color: "white",
                background: "linear-gradient(180deg, #1c1c2a 0%, #0b0b12 100%)",
                boxShadow: "0 6px 18px rgba(0,0,0,.35)",
                "&:hover": {
                  background:
                    "linear-gradient(180deg, #242436 0%, #0f0f18 100%)",
                  boxShadow: "0 8px 22px rgba(0,0,0,.45)",
                },
              }}
            >
              Sign up
            </Button>

            <Button
              onClick={onSignIn}
              sx={{
                textTransform: "none",
                color: "rgba(255,255,255,.75)",
                fontWeight: 500,
                "&:hover": { color: "white", backgroundColor: "transparent" },
              }}
            >
              Login
            </Button>
          </>
        ) : (
          <Button
            onClick={onProfile}
            sx={{
              textTransform: "none",
              borderRadius: "10px",
              px: 1.5,
              py: 0.75,
              color: "white",
              backgroundColor: "rgba(255,255,255,0.06)",
              "&:hover": { backgroundColor: "rgba(255,255,255,0.10)" },
              gap: 1,
            }}
          >
            <Box
              sx={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                backgroundColor: "rgba(255,255,255,0.12)",
                display: "grid",
                placeItems: "center",
              }}
            >
              <PersonIcon
                sx={{ fontSize: 16, color: "rgba(255,255,255,.9)" }}
              />
            </Box>

            <Typography sx={{ fontWeight: 600, fontSize: 14 }}>
              {profileName}
            </Typography>
          </Button>
        )}
      </Box>
    </Box>
  );
}
