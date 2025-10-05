"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Divider,
  TextField,
} from "@mui/material";

import DescriptionBar, {
  DescriptionLabel,
} from "../../../app/shared-components/DescriptionBar";

const descriptionBarLabels: DescriptionLabel[] = [
  { title: "", link: "" },
  { button: "Create Your Account", link: "/auth/signup" },
];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isFailedLogin, setIsFailedLogin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: "/",
    });
    setLoading(false);

    if (res?.error) {
      setIsFailedLogin(true);
    } else {
      window.location.href = "/";
    }
  };

  return (
    <Box
      sx={{
        backgroundColor: "#f5f5f7",
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
      }}
    >
      <DescriptionBar labels={descriptionBarLabels} />

      {/* Main section */}
      <Box
        sx={{
          flexGrow: 1,
          width: "100%",
          maxWidth: "1200px",
          mx: "auto",
          py: 6,
        }}
      >
        {/* Top Heading */}
        <Typography
          variant="h3"
          sx={{
            color: "black",
            fontWeight: "bold",
            fontSize: { xs: "22px", md: "32px", lg: "40px" },
            mb: 6,
            textAlign: "left",
          }}
        >
          Sign in to view your profile
        </Typography>

        {/* Centered Form Section */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            minHeight: "50vh",
            alignItems: "center", // ✅ horizontal center
          }}
        >
          <Box
            sx={{
              width: { xs: "90%", sm: "70%", md: "50%" }, // ✅ smaller width like Apple
              maxWidth: "500px",
              textAlign: "left",
            }}
          >
            <Typography
              variant="h5"
              sx={{
                color: "#494949",
                mb: 3,
                textAlign: "center",
              }}
            >
              Sign in to Pokémon Store
            </Typography>

            <form onSubmit={handleSubmit}>
              <TextField
                fullWidth
                id="email"
                label="Email"
                variant="outlined"
                helperText={isFailedLogin ? "Invalid username or password" : ""}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                slotProps={{
                  inputLabel: {
                    shrink: true,
                  },
                }}
                sx={{
                  margin: "10px 0",
                  input: { backgroundColor: "white" },
                  "& .MuiOutlinedInput-root": {
                    "& fieldset": {
                      borderColor: isFailedLogin ? "red" : "grey.300",
                    },
                  },
                  "&.Mui-focused fieldset": {
                    borderColor: "primary.main",
                    borderWidth: "2px",
                  },
                  "& .MuiFormHelperText-root": {
                    color: "red !important",
                  },
                }}
              />

              <TextField
                fullWidth
                id="password"
                label="Password"
                type={showPassword ? "text" : "password"}
                variant="outlined"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                slotProps={{
                  inputLabel: {
                    shrink: true,
                  },
                }}
                sx={{
                  input: { backgroundColor: "white" },
                  "& .MuiOutlinedInput-root": {
                    "& fieldset": {
                      borderColor: isFailedLogin ? "red" : "grey.300",
                    },
                    "&.Mui-focused fieldset": {
                      borderColor: "primary.main",
                      borderWidth: "2px",
                    },
                  },
                }}
              />

              {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  sx={{
                    mt: 2,
                    color: "white",
                    borderRadius: "5px",
                    textTransform: "none",
                  }}
                >
                  Log in
                </Button>
              )}
            </form>

            {/* Forgot + Create side by side */}
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                mt: 2,
              }}
            >
              <Button
                variant="text"
                color="primary"
                sx={{
                  textTransform: "none",
                  "&:hover": { textDecoration: "underline" },
                }}
              >
                Forgotten password?
              </Button>
              <Button
                variant="text"
                color="primary"
                href="/auth/signup"
                sx={{
                  textTransform: "none",
                  "&:hover": { textDecoration: "underline" },
                }}
              >
                Create yours now.
              </Button>
            </Box>

            <Divider sx={{ width: "100%", mt: 3 }} />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
