"use client";

import { useState, useMemo } from "react";
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
import { getNames } from "country-list";
import { useAuth } from "@/app/hooks/useAuth";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";

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

export default function EditProfilePage() {
  const router = useRouter();
  const countryOptions = useMemo(() => getNames().sort(), []);
  const { user: displayUser, status, update } = useAuth();

  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });

  // ✅ Initialize form immediately (no post-hydration update)
  const [form, setForm] = useState(() => ({
    firstName: displayUser?.firstName || "",
    lastName: displayUser?.lastName || "",
    username: displayUser?.username || "",
    email: displayUser?.email || "",
    country: displayUser?.country || "Singapore",
    sex: displayUser?.sex || "",
    dob: displayUser?.dob ? toInputDate(displayUser.dob) : "",
    address: displayUser?.address || "",
  }));

  const handleChange = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const formattedDob = form.dob ? form.dob.split("T")[0] : null;

      const res = await fetch("/api/user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, dob: formattedDob }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Update failed");

      // ✅ Refresh session immediately so SSR + client see latest data
      await update();

      setSnackbar({
        open: true,
        message: "✅ Profile updated successfully!",
        severity: "success",
      });

      setTimeout(() => router.replace("/profile"), 1000);
    } catch (err) {
      console.error("❌ Update failed:", err);
      setSnackbar({
        open: true,
        message: "❌ Failed to update profile. Please try again.",
        severity: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  // loading
  if (status === "loading") {
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

  // Guard
  if (!displayUser) {
    return (
      <Box sx={{ py: 6 }}>
        <Typography textAlign="center" color="text.secondary">
          Please sign in to edit your profile.
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height: "75vh",
        maxWidth: 700,
        mx: "auto",
        mt: 5,
        px: 2,
        pb: 10,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Keep title fixed at the top */}
      <Typography
        variant="h5"
        sx={{
          fontWeight: "bold",
          textAlign: "left",
        }}
      >
        Edit Profile
      </Typography>

      {/* Wrap the form in a flex box that centers vertically */}
      <Box
        sx={{
          flexGrow: 1,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          pt: 7, // space between edit and form
        }}
      >
        <Box sx={{ width: "100%" }}>
          <Grid container spacing={4}>
            {[
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
                    "& .MuiInputBase-root:before": {
                      borderBottomColor: "#ccc",
                    },
                    "& .MuiInputBase-root:hover:not(.Mui-disabled):before": {
                      borderBottomColor: "#999",
                    },
                    "& .MuiInputBase-root:after": {
                      borderBottomColor: "black",
                    },
                  }}
                />
              </Grid>
            ))}

            {/* Country */}
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

            {/* Sex */}
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

            {/* DOB */}
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
            disabled={saving}
            sx={{
              mt: 5,
              backgroundColor: "black",
              color: "white",
              textTransform: "none",
              fontWeight: "bold",
              py: 1.4,
              "&:hover": { backgroundColor: "#333" },
              "&.Mui-disabled": { backgroundColor: "#111", opacity: 0.5 },
            }}
            onClick={handleSave}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </Box>
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={2500}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
