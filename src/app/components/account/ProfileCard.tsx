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
} from "@mui/material";
import { Verified } from "@mui/icons-material";
import LogoutButton from "./LogoutButton";

interface ProfileCardProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export default function ProfileCard({ user }: ProfileCardProps) {
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
                src={user?.image ?? ""}
                alt={user?.name ?? ""}
                sx={{ width: 64, height: 64 }}
              />
            </Grid>
            <Grid size="grow">
              <Typography variant="h6">{user?.name ?? "User"}</Typography>
              <Typography variant="body2" color="text.secondary">
                {user?.email}
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
            <ListItem disablePadding>
              <ListItemButton>
                <ListItemText primary="Address" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton>
                <ListItemText primary="Payment" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton>
                <ListItemText primary="Currency" secondary="SGD" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton>
                <ListItemText primary="Email" secondary={user?.email} />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton>
                <ListItemText
                  primary="Phone Number"
                  secondary="Verified"
                  secondaryTypographyProps={{ color: "success.main" }}
                />
                <Verified fontSize="small" color="success" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton>
                <ListItemText primary="Notification Settings" />
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
