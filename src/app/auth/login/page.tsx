"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Divider,
} from "@mui/material";

import DescriptionBar, {
  DescriptionLabel,
} from "../../shared-components/DescriptionBar";
import AutoFillAwareTextField from "../../shared-components/AutoFillAwareTextField";

const descriptionBarLabels: DescriptionLabel[] = [
  { title: "Pokemon ID", link: "/signUp" },
  { button: "Sign In", link: "/auth/signin" },
  { button: "Create Your Account", link: "/signUp" },
  { button: "FAQ", link: "/faq" },
];

export default function SignInPage() {
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
          Sign in for faster checkout.
        </Typography>

        {/* Centered Form Section */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
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
              <AutoFillAwareTextField
                fullWidth
                id="email"
                label="Email"
                variant="outlined"
                helperText={isFailedLogin ? "Invalid username or password" : ""}
                value={email}
                onChange={setEmail}
                sx={{
                  mb: 2,
                  input: { backgroundColor: "white" },
                }}
              />

              <AutoFillAwareTextField
                fullWidth
                id="password"
                label="Password"
                type={showPassword ? "text" : "password"}
                variant="outlined"
                value={password}
                onChange={setPassword}
                sx={{
                  mb: 2,
                  input: { backgroundColor: "white" },
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
                href="/signUp"
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
