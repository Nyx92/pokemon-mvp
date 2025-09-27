"use client";

import { signOut } from "next-auth/react";
import { Button, Box } from "@mui/material";

export default function LogoutButton() {
  return (
    <Box textAlign="center" mt={2}>
      <Button
        variant="outlined"
        onClick={() => signOut()}
        sx={{
          borderRadius: "9999px", // fully rounded pill
          borderColor: "grey.400",
          color: "grey.700",
          textTransform: "none", // keep text as "Logout", not uppercase
          px: 3, // horizontal padding
          "&:hover": {
            borderColor: "grey.600",
            backgroundColor: "grey.50",
          },
        }}
      >
        Logout
      </Button>
    </Box>
  );
}
