"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import {
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
  Divider,
} from "@mui/material";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await signIn("credentials", {
      email,
      password,
      callbackUrl: "/", // redirect after login
    });
  };

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        bgcolor: "grey.100",
      }}
    >
      <Card
        sx={{
          width: "100%",
          maxWidth: 400,
          borderRadius: 3,
          boxShadow: 4,
        }}
      >
        <CardContent sx={{ p: 4 }}>
          {/* Title */}
          <Typography
            variant="h5"
            textAlign="center"
            fontWeight="bold"
            gutterBottom
          >
            Log in to Pokemon MVP
          </Typography>
          <Typography
            variant="body2"
            textAlign="center"
            color="text.secondary"
            mb={3}
          >
            Sign in with your email and password
          </Typography>

          <Divider sx={{ mb: 3 }} />

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              required
              margin="normal"
              autoComplete="off"
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              required
              margin="normal"
              autoComplete="new-password"
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              sx={{
                mt: 3,
                borderRadius: "9999px", // pill button
                py: 1.2,
                textTransform: "none",
                fontWeight: "bold",
              }}
            >
              Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}
