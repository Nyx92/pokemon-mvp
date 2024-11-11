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
} from "@mui/material";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import { getNames } from "country-list";
import SignUpFail from "./modals/ContactSubmitFail";
import AutoFillAwareTextField from "./AutoFillAwareTextField";

// Define an interface for props if you expect to receive any props
interface SegmentOneProps {
  // add if required
}

interface FormData {
  firstName: string;
  lastName: string;
  country: string;
  dateOfBirth: string;
  email: string;
  countryCode: string;
  phoneNumber: string;
}

const SegmentOne: React.FC<SegmentOneProps> = (props) => {
  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    lastName: "",
    // set default as Singapore
    country: "Singapore",
    dateOfBirth: "",
    email: "",
    countryCode: "65",
    phoneNumber: "",
  });
  const [loading, setLoading] = useState(false);
  const [isFailedSubmit, setIsFailedSubmit] = useState(false);
  const [phoneNotInteger, setPhoneNotInteger] = useState(false);
  const [isSubmitFailModalOpen, setIsSubmitFailModalOpen] = useState(false);

  // Get country options
  // The useMemo hook memoizes the sorted country list, meaning the list is only sorted once and reused unless the dependencies change. without this each time a state changes, the list needs to be rendered again.
  const countryOptions = useMemo(() => getNames().sort(), []);

  const handleFormSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true); // Start loading

    // simple form validation
    if (!Number.isInteger(Number(formData.phoneNumber))) {
      setPhoneNotInteger(true);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/submitForm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        console.log("Form submitted successfully");
        localStorage.setItem("isAccountCreated", "true");
      } else {
        throw new Error("Form submission failed");
      }
    } catch (error) {
      console.error(error);
      setIsFailedSubmit(true);
      setIsSubmitFailModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  // Updated handleChange to work with AutoFillAwareTextField
  const handleChange = (name: keyof FormData, value: string | number) => {
    setFormData((prevState) => ({ ...prevState, [name]: value.toString() })); // Convert `number` to `string` if necessary
  };

  // this is necessary as PhoneInput component from react-phone-input-2 does not use the standard event object, instead it uses value
  const handlePhoneCodeChange = (value: string) => {
    setFormData((prevState) => ({ ...prevState, countryCode: value }));
  };
  return (
    <>
      <Box
        sx={{
          paddingTop: { xs: "30%", sm: "25%", md: "20%", lg: "12%", xl: "8%" },
          backgroundColor: "#f5f5f7",
          display: "flex",
          flexDirection: "column",
          minHeight: { xs: "680px", sm: "750px" },
          width: "100%",
        }}
      >
        <Box
          sx={{
            backgroundColor: "#f5f5f7",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            minHeight: "50vh",
          }}
        >
          <Typography
            variant="h2"
            sx={{
              color: "Black",
              fontWeight: "bold",
              fontSize: { xs: "30px", xl: "40px" },
              letterSpacing: "-0.02em",
              paddingTop: 2,
              mb: 1,
            }}
          >
            We'd Love to Hear From You
          </Typography>
          <Typography
            variant="h4"
            sx={{
              color: "Black",
              fontSize: { xs: "20px", lg: "20px" },
              letterSpacing: "-0.02em",
              mb: 4,
            }}
          >
            Submit your details, and we'll reach out to you!
          </Typography>
          {/* if loading is true, show loading screen, otherwise show form */}
          {loading ? (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "60vh",
              }}
            >
              <CircularProgress />
              <Typography
                variant="h6"
                sx={{
                  color: "Black",
                  fontSize: { xs: "10px", lg: "15px", xl: "20px" },
                  letterSpacing: "-0.02em",
                  mt: 2,
                }}
              >
                Please wait while we submit your details...
              </Typography>
            </Box>
          ) : (
            <Box
              component="form"
              onSubmit={handleFormSubmit}
              sx={{
                mt: 1,
                width: {
                  xs: "90%",
                  sm: "80%",
                  md: "70%",
                  lg: "50%",
                  xl: "30%",
                },
              }}
            >
              {/* Form Fields */}
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <AutoFillAwareTextField
                  required
                  fullWidth
                  id="firstname"
                  // label on textfield
                  label="First Name"
                  name="firstName"
                  value={formData.firstName}
                  // The onChange event handler in React automatically receives an event object as its first argument when an event occurs.
                  // It is equivalent to onChange={(event) => handleChange(event)}
                  onChange={(value) => handleChange("firstName", value)}
                  margin="normal"
                  sx={{ mt: 1, width: "48%", backgroundColor: "white" }}
                />
                <AutoFillAwareTextField
                  required
                  fullWidth
                  id="lastname"
                  label="Last Name"
                  name="lastName"
                  value={formData.lastName}
                  onChange={(value) => handleChange("lastName", value)}
                  margin="normal"
                  sx={{ mt: 1, width: "48%", backgroundColor: "white" }}
                />
              </Box>
              <FormControl fullWidth margin="normal" required>
                <InputLabel>Country / Region</InputLabel>
                <Select
                  value={formData.country}
                  label="Country / Region"
                  name="country"
                  onChange={(e) => handleChange("country", e.target.value)}
                  sx={{
                    backgroundColor: "white",
                  }}
                >
                  {countryOptions.map((country) => (
                    <MenuItem key={country} value={country}>
                      {country}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                required
                fullWidth
                label="Date of Birth"
                type="date"
                name="dateOfBirth"
                value={formData.dateOfBirth}
                onChange={(e) => handleChange("dateOfBirth", e.target.value)}
                InputLabelProps={{ shrink: true }}
                margin="normal"
                sx={{
                  backgroundColor: "white",
                }}
              />
              <AutoFillAwareTextField
                required
                fullWidth
                id="email"
                label="Email"
                type="email"
                name="email"
                value={formData.email}
                onChange={(value) => handleChange("email", value)}
                margin="normal"
              />
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <FormControl
                  margin="normal"
                  required
                  sx={{ paddingRight: "20px" }}
                >
                  <PhoneInput
                    country={"sg"}
                    value={formData.countryCode}
                    onChange={handlePhoneCodeChange}
                    inputStyle={{
                      maxWidth: "100px",
                      height: "56px",
                      borderRadius: "4px",
                      border: "1px solid rgba(0, 0, 0, 0.23)",
                      backgroundColor: "white",
                    }}
                  />
                </FormControl>
                <AutoFillAwareTextField
                  required
                  fullWidth
                  id="phoneNumber"
                  label="Phone Number"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={(value) => handleChange("phoneNumber", value)}
                  margin="normal"
                  helperText={
                    phoneNotInteger ? "Please input a valid phone number" : ""
                  }
                  sx={{
                    backgroundColor: "white",
                    "& .MuiOutlinedInput-root": {
                      "& fieldset": {
                        borderColor: phoneNotInteger ? "red" : "grey.300",
                      },
                    },
                    "&.Mui-focused fieldset": {
                      borderColor: "primary.main",
                      borderWidth: "2px",
                    },
                    "& .MuiFormHelperText-root": {
                      color: "red !important", // This will change the helper text color to red
                      backgroundColor: "#f5f5f7",
                      paddingTop: "5px",
                      paddingLeft: "8px",
                      margin: 0, // Remove margin to avoid white spaces
                    },
                  }}
                />
              </Box>
              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{
                  mt: 3,
                  mb: 2,
                  textTransform: "none",
                  backgroundColor: "black",
                }}
                disabled={loading}
              >
                {loading ? "Submitting..." : "Submit"}
              </Button>
            </Box>
          )}
        </Box>
        <SignUpFail
          open={isSubmitFailModalOpen}
          onClose={() => setIsSubmitFailModalOpen(false)}
        />
      </Box>
    </>
  );
};

export default SegmentOne;
