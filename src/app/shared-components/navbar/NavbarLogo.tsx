"use client";

import { Box, IconButton, Link, Typography } from "@mui/material";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";

type Props = {
  selectedDropdownSection: unknown;
  onBack: () => void;
};

export default function NavbarLogo({ selectedDropdownSection, onBack }: Props) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", flexGrow: 1 }}>
      {selectedDropdownSection ? (
        <IconButton
          onClick={onBack}
          aria-label="Back"
          sx={{
            padding: 0,
            color: "var(--r-globalnav-color-secondary)",
            "&:hover": { color: "var(--r-globalnav-color-hover)" },
          }}
        >
          <ArrowBackIosNewIcon />
        </IconButton>
      ) : (
        <Link href="/" underline="none">
          <Typography
            variant="h6"
            sx={{ fontWeight: "bold", color: "white", cursor: "pointer" }}
          >
            Logo here
          </Typography>
        </Link>
      )}
    </Box>
  );
}
