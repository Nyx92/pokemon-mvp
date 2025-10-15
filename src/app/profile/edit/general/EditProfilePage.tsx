"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Box,
  Button,
  Grid,
  TextField,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/app/store/userStore";
import { getNames } from "country-list";
import type { Session } from "next-auth";

// ✅ Utility: convert ISO → YYYY-MM-DD
const toInputDate = (isoDate: string) => {
  if (!isoDate) return "";
  const parts = isoDate.split("/");
  if (parts.length === 3 && parts[2].length === 4) {
    const [d, m, y] = parts;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const d = new Date(isoDate);
  return isNaN(d.getTime()) ? "" : d.toISOString().split("T")[0];
};

// ✅ Utility: convert YYYY-MM-DD → dd/mm/yyyy
const toDisplayDate = (val: string) => {
  if (!val) return "";
  const [y, m, d] = val.split("-");
  return `${d}/${m}/${y}`;
};

interface EditProfilePageProps {
  initialUser?: Partial<Session["user"]> | null;
}

export default function EditProfilePage({ initialUser }: EditProfilePageProps) {
  const router = useRouter();
  const { user, setUser } = useUserStore();
  const countryOptions = useMemo(() => getNames().sort(), []);

  // ✅ Combine server user and client user safely (no flicker)
  const displayUser = user ?? initialUser ?? null;

  // ✅ Immediately prevent empty render until we know user exists
  const isReady = !!displayUser?.username;

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    country: "Singapore",
    sex: "",
    dob: "",
    address: "",
  });

  // ✅ Sync only once when data is available
  useEffect(() => {
    if (isReady && displayUser) {
      setForm({
        firstName: displayUser.firstName || "",
        lastName: displayUser.lastName || "",
        username: displayUser.username || "",
        email: displayUser.email || "",
        country: displayUser.country || "Singapore",
        sex: displayUser.sex || "",
        dob: displayUser.dob ? toInputDate(displayUser.dob) : "",
        address: displayUser.address || "",
      });
    }
  }, [isReady, displayUser]);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    const formattedDob = toDisplayDate(form.dob);
    const updated = {
      ...displayUser,
      ...form,
      dob: formattedDob,
    };
    setUser(updated);
    router.replace("/profile");
  };

  // ✅ Simple guard — ensures no flicker, shows loader only once
  if (!isReady) {
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

  return (
    <Box
      sx={{
        maxWidth: 700,
        mx: "auto",
        mt: 5,
        px: 2,
        pb: 10,
      }}
    >
      <Typography
        variant="h5"
        sx={{ mb: 4, fontWeight: "bold", textAlign: "left" }}
      >
        Edit Profile
      </Typography>

      <Grid container spacing={4}>
        {[
          // Generic fields
          { label: "First Name", field: "firstName" },
          { label: "Last Name", field: "lastName" },
          { label: "Username", field: "username" },
          { label: "Email", field: "email" },
        ].map(({ label, field }) => (
          <Grid size={{ xs: 12 }} key={field}>
            <TextField
              fullWidth
              label={label}
              variant="standard"
              value={form[field as keyof typeof form]}
              onChange={(e) => handleChange(field, e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{
                "& .MuiInputBase-root:before": { borderBottomColor: "#ccc" },
                "& .MuiInputBase-root:hover:not(.Mui-disabled):before": {
                  borderBottomColor: "#999",
                },
                "& .MuiInputBase-root:after": { borderBottomColor: "black" },
              }}
            />
          </Grid>
        ))}

        {/* Country Dropdown */}
        <Grid size={{ xs: 12 }}>
          <FormControl fullWidth variant="standard">
            <InputLabel shrink>Country</InputLabel>
            <Select
              value={form.country}
              onChange={(e) => handleChange("country", e.target.value)}
              sx={{
                "&::before": { borderBottomColor: "#ccc" },
                "&:hover:not(.Mui-disabled, .Mui-error):before": {
                  borderBottomColor: "#999",
                },
                "&::after": { borderBottomColor: "black" },
              }}
            >
              {countryOptions.map((country) => (
                <MenuItem key={country} value={country}>
                  {country}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Sex Dropdown */}
        <Grid size={{ xs: 12 }}>
          <FormControl fullWidth variant="standard">
            <InputLabel shrink>Sex</InputLabel>
            <Select
              value={form.sex}
              onChange={(e) => handleChange("sex", e.target.value)}
              sx={{
                "&::before": { borderBottomColor: "#ccc" },
                "&:hover:not(.Mui-disabled, .Mui-error):before": {
                  borderBottomColor: "#999",
                },
                "&::after": { borderBottomColor: "black" },
              }}
            >
              <MenuItem value="Male">Male</MenuItem>
              <MenuItem value="Female">Female</MenuItem>
              <MenuItem value="Other">Other</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        {/* Date of Birth */}
        <Grid size={{ xs: 12 }}>
          <TextField
            fullWidth
            variant="standard"
            label="Date of Birth"
            type="date"
            value={form.dob}
            onChange={(e) => handleChange("dob", e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{
              "& .MuiInputBase-root:before": { borderBottomColor: "#ccc" },
              "& .MuiInputBase-root:hover:not(.Mui-disabled):before": {
                borderBottomColor: "#999",
              },
              "& .MuiInputBase-root:after": { borderBottomColor: "black" },
            }}
          />
        </Grid>

        {/* Address */}
        <Grid size={{ xs: 12 }}>
          <TextField
            fullWidth
            label="Address"
            variant="standard"
            value={form.address}
            onChange={(e) => handleChange("address", e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{
              "& .MuiInputBase-root:before": { borderBottomColor: "#ccc" },
              "& .MuiInputBase-root:hover:not(.Mui-disabled):before": {
                borderBottomColor: "#999",
              },
              "& .MuiInputBase-root:after": { borderBottomColor: "black" },
            }}
          />
        </Grid>
      </Grid>

      <Button
        variant="contained"
        fullWidth
        sx={{
          mt: 5,
          backgroundColor: "black",
          color: "white",
          textTransform: "none",
          fontWeight: "bold",
          py: 1.4,
          "&:hover": { backgroundColor: "#333" },
        }}
        onClick={handleSave}
      >
        Save
      </Button>
    </Box>
  );
}
