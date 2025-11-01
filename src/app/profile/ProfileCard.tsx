"use client";

import {
  Avatar,
  Box,
  Card,
  CardContent,
  Divider,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Grid,
  CircularProgress,
} from "@mui/material";
import { Verified, ErrorOutline } from "@mui/icons-material";
import LogoutButton from "@/app/utils/account/LogoutButton";
import { useUserStore } from "@/app/store/userStore";
import type { Session } from "next-auth";
import { useRouter } from "next/navigation";

interface ProfileCardProps {
  initialUser?: Partial<Session["user"]> | null;
}

export default function ProfileCard({ initialUser }: ProfileCardProps) {
  const { user } = useUserStore();
  const router = useRouter();
  // ✅ Merge SSR + client user safely
  const displayUser = user ?? initialUser ?? null;

  const handleEditClick = () => {
    router.push("/profile/edit/general");
  };

  // ✅ If no user yet (first paint), show loader instead of placeholders
  if (!displayUser) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "60vh",
        }}
      >
        <CircularProgress size={40} />
      </Box>
    );
  }

  // ✅ Helper for nullish values (used only after data ready)
  const safe = (val?: string | null) => val || "—";

  return (
    <main>
      <Card
        sx={{
          maxWidth: 800,
          margin: "2rem auto",
          borderRadius: 3,
          boxShadow: 3,
        }}
      >
        <CardContent>
          {/* Header */}
          <Grid container alignItems="center" spacing={2}>
            <Grid>
              <Avatar
                src={displayUser.image ?? ""}
                alt={displayUser.username ?? ""}
                sx={{ width: 64, height: 64 }}
              />
            </Grid>
            <Grid size="grow">
              <Typography variant="h6">
                {safe(displayUser.firstName)} {safe(displayUser.lastName)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {safe(displayUser.email)}
              </Typography>
            </Grid>
          </Grid>

          {/* Stats */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-around",
              mt: 3,
              mb: 2,
              textAlign: "center",
            }}
          >
            <Box>
              <Typography variant="h6">0</Typography>
              <Typography variant="body2" color="text.secondary">
                Buying
              </Typography>
            </Box>
            <Divider orientation="vertical" flexItem />
            <Box>
              <Typography variant="h6">4</Typography>
              <Typography variant="body2" color="text.secondary">
                Completed
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Coupon Section */}
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Coupon
          </Typography>
          <List>
            <ListItem disablePadding>
              <ListItemButton>
                <ListItemText primary="Invitation Code. GET coupons 🎁" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton>
                <ListItemText primary="Coupons list / Enter the code" />
              </ListItemButton>
            </ListItem>
          </List>

          <Divider sx={{ my: 2 }} />

          {/* General Section */}
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            General
          </Typography>
          <List>
            {[
              ["First Name", displayUser.firstName],
              ["Last Name", displayUser.lastName],
              ["Username", displayUser.username],
              ["Email", displayUser.email],
              ["Country", displayUser.country],
              ["Sex", displayUser.sex],
              ["Date of Birth", displayUser.dob],
              ["Address", displayUser.address],
            ].map(([label, value]) => (
              <ListItem key={label} disablePadding>
                <ListItemButton onClick={handleEditClick}>
                  {" "}
                  {/* 👈 add this */}
                  <ListItemText primary={label} secondary={safe(value)} />
                </ListItemButton>
              </ListItem>
            ))}

            {/* Phone */}
            <ListItem disablePadding>
              <ListItemButton>
                <ListItemText
                  primary="Phone Number"
                  secondary={safe(displayUser.phoneNumber)}
                />
                {displayUser.verified ? (
                  <Verified fontSize="small" color="success" />
                ) : (
                  <ErrorOutline fontSize="small" color="disabled" />
                )}
              </ListItemButton>
            </ListItem>

            {/* Email verified */}
            <ListItem disablePadding>
              <ListItemButton>
                <ListItemText
                  primary="Email Verified"
                  secondary={displayUser.emailVerified ? "Yes" : "No"}
                  secondaryTypographyProps={{
                    color: displayUser.emailVerified
                      ? "success.main"
                      : "text.secondary",
                  }}
                />
              </ListItemButton>
            </ListItem>
          </List>

          <Divider sx={{ my: 2 }} />

          {/* Check Section */}
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Check
          </Typography>
          <List>
            <ListItem disablePadding>
              <ListItemButton>
                <ListItemText primary="Notifications" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton>
                <ListItemText primary="Favorites" />
              </ListItemButton>
            </ListItem>
          </List>

          {/* Logout Button */}
          <LogoutButton />
        </CardContent>
      </Card>
    </main>
  );
}
