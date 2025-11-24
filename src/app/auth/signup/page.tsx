"use client";
import { useState, useMemo } from "react";
import {
  Box,
  Typography,
  Button,
  TextField,
  FormControl,
  Select,
  InputLabel,
  CircularProgress,
  MenuItem,
  FormHelperText,
} from "@mui/material";
import DescriptionBar, {
  DescriptionLabel,
} from "../../shared-components/DescriptionBar";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import { getNames } from "country-list";
import { useRouter } from "next/navigation";

const descriptionBarLabels: DescriptionLabel[] = [
  { title: "User Profile", link: "" },
  { button: "Login", link: "/auth/login" },
  { button: "FAQ", link: "" },
];

export default function UserProfileForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
    country: "Singapore",
    sex: "",
    dob: "",
    address: "",
    phoneNumber: "",
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({
    passwordMismatch: false,
    phoneInvalid: false,
  });

  const countryOptions = useMemo(() => getNames().sort(), []);

  const handleChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setErrors({
      passwordMismatch: false,
      phoneInvalid: false,
    });

    // ✅ Validation
    if (formData.password !== formData.confirmPassword) {
      setErrors((prev) => ({ ...prev, passwordMismatch: true }));
      setLoading(false);
      return;
    }
    if (formData.phoneNumber && !/^\d+$/.test(formData.phoneNumber)) {
      setErrors((prev) => ({ ...prev, phoneInvalid: true }));
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Something went wrong");
      }

      alert("✅ Account created successfully!");
      console.log(result.user);

      // ✅ Redirect after success
      router.push("/auth/login");
    } catch (err) {
      console.error("❌ Registration failed:", err);
      alert("Failed to create account. Check console for details.");
    }

    setLoading(false);
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

      <Box
        sx={{
          backgroundColor: "#f5f5f7",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          minHeight: "60vh",
        }}
      >
        <Typography
          variant="h2"
          sx={{
            fontWeight: "bold",
            fontSize: { xs: "24px", lg: "32px" },
            mt: 8,
            mb: 6,
          }}
        >
          Create Your Profile
        </Typography>

        {loading ? (
          <Box sx={{ display: "flex", flexDirection: "column", py: 6 }}>
            <CircularProgress />
            <Typography sx={{ mt: 2 }}>Please wait...</Typography>
          </Box>
        ) : (
          <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{
              width: { xs: "90%", sm: "80%", md: "60%", lg: "40%" },
              backgroundColor: "white",
              p: 3,
              borderRadius: 2,
              boxShadow: 1,
            }}
          >
            {/* Name Fields */}
            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField
                required
                fullWidth
                label="First Name"
                value={formData.firstName}
                onChange={(e) => handleChange("firstName", e.target.value)}
                slotProps={{
                  inputLabel: {
                    shrink: true,
                  },
                }}
              />
              <TextField
                required
                fullWidth
                label="Last Name"
                value={formData.lastName}
                onChange={(e) => handleChange("lastName", e.target.value)}
                slotProps={{
                  inputLabel: {
                    shrink: true,
                  },
                }}
              />
            </Box>

            {/* Email */}
            <TextField
              required
              fullWidth
              margin="normal"
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange("email", e.target.value)}
              slotProps={{
                inputLabel: {
                  shrink: true,
                },
              }}
            />

            {/* Username */}
            <TextField
              required
              fullWidth
              margin="normal"
              label="Username"
              type="username"
              value={formData.username}
              onChange={(e) => handleChange("username", e.target.value)}
              slotProps={{
                inputLabel: {
                  shrink: true,
                },
              }}
            />

            {/* Passwords */}
            <TextField
              required
              fullWidth
              margin="normal"
              label="Password"
              type="password"
              value={formData.password}
              onChange={(e) => handleChange("password", e.target.value)}
              slotProps={{
                inputLabel: {
                  shrink: true,
                },
              }}
            />
            <TextField
              required
              fullWidth
              margin="normal"
              label="Confirm Password"
              type="password"
              value={formData.confirmPassword}
              error={errors.passwordMismatch}
              helperText={
                errors.passwordMismatch ? "Passwords do not match" : ""
              }
              onChange={(e) => handleChange("confirmPassword", e.target.value)}
              slotProps={{
                inputLabel: {
                  shrink: true,
                },
              }}
            />

            {/* Country */}
            <FormControl fullWidth margin="normal">
              <InputLabel>Country / Region</InputLabel>
              <Select
                value={formData.country}
                label="Country / Region"
                onChange={(e) => handleChange("country", e.target.value)}
              >
                {countryOptions.map((country) => (
                  <MenuItem key={country} value={country}>
                    {country}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Sex Dropdown */}
            <FormControl fullWidth margin="normal" required>
              <InputLabel>Sex</InputLabel>
              <Select
                value={formData.sex}
                label="Sex"
                onChange={(e) => handleChange("sex", e.target.value)}
              >
                <MenuItem value="Male">Male</MenuItem>
                <MenuItem value="Female">Female</MenuItem>
                <MenuItem value="Other">Other</MenuItem>
              </Select>
            </FormControl>

            {/* Date of Birth */}
            <TextField
              required
              fullWidth
              margin="normal"
              label="Date of Birth"
              type="date"
              value={formData.dob}
              onChange={(e) => handleChange("dob", e.target.value)}
              slotProps={{
                inputLabel: {
                  shrink: true,
                },
              }}
            />

            {/* Address */}
            <TextField
              fullWidth
              margin="normal"
              label="Address"
              value={formData.address}
              onChange={(e) => handleChange("address", e.target.value)}
              slotProps={{
                inputLabel: {
                  shrink: true,
                },
              }}
            />

            {/* Phone */}
            <Box sx={{ mt: 2 }}>
              <PhoneInput
                country={"sg"}
                value={formData.phoneNumber}
                onChange={(value) => handleChange("phoneNumber", value)}
                inputStyle={{
                  width: "100%",
                  height: "56px",
                  borderRadius: "4px",
                  border: "1px solid rgba(0, 0, 0, 0.23)",
                }}
              />
              {errors.phoneInvalid && (
                <FormHelperText error>
                  Please enter a valid phone number
                </FormHelperText>
              )}
            </Box>

            {/* Submit */}
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, textTransform: "none" }}
            >
              Create Account
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  );
}
