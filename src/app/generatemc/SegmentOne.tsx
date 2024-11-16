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
import SignUpFail from "./modals/ContactSubmitFail";
import AutoFillAwareTextField from "./AutoFillAwareTextField";

// Define an interface for props if you expect to receive any props
interface SegmentOneProps {
  // add if required
}

interface FormData {
  firstName: string;
  lastName: string;
  nric: string;
  mcStartDate: string;
  mcEndDate: string;
}

const SegmentOne: React.FC<SegmentOneProps> = (props) => {
  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    lastName: "",
    nric: "",
    mcStartDate: "",
    mcEndDate: "",
  });
  const [loading, setLoading] = useState(false);
  const [isFailedSubmit, setIsFailedSubmit] = useState(false);
  const [isSubmitFailModalOpen, setIsSubmitFailModalOpen] = useState(false);

  const handleFormSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true); // Start loading

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
            Generate your MC now!
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
            $15 a pop. No frills.
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
              <AutoFillAwareTextField
                required
                fullWidth
                id="nric"
                label="NRIC"
                type="nric"
                name="nric"
                value={formData.nric}
                onChange={(value) => handleChange("nric", value)}
                margin="normal"
              />

              <TextField
                required
                fullWidth
                label="Start of MC"
                type="date"
                name="mcStartDate"
                value={formData.mcStartDate}
                onChange={(e) => handleChange("mcStartDate", e.target.value)}
                InputLabelProps={{ shrink: true }}
                margin="normal"
                sx={{
                  backgroundColor: "white",
                }}
              />
              <TextField
                required
                fullWidth
                label="End of MC"
                type="date"
                name="mcEndDate"
                value={formData.mcEndDate}
                onChange={(e) => handleChange("mcEndDate", e.target.value)}
                InputLabelProps={{ shrink: true }}
                margin="normal"
                sx={{
                  backgroundColor: "white",
                }}
              />

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
                {loading ? "Generating..." : "Generate"}
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
