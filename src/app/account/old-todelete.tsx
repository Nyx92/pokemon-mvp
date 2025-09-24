"use client";
import { useState } from "react";
import {
  Box,
  Typography,
  Button,
  TextField,
  CircularProgress,
  Tooltip,
} from "@mui/material";
import AutoFillAwareTextField from "../shared-components/AutoFillAwareTextField";
import { keyframes } from "@emotion/react"; // Import keyframes for animation
import { differenceInDays, parseISO, format } from "date-fns"; // Import date-fns for date calculations
import TermsOfUse from "../shared-components/footer/modals/termsOfUse";

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
  days: string;
  startDateNo: string;
}

// Keyframe animation for tilting
const tiltAnimation = keyframes`
  0% { transform: rotate(-3deg); }
  50% { transform: rotate(3deg); }
  100% { transform: rotate(-3deg); }
`;

const SegmentOne: React.FC<SegmentOneProps> = (props) => {
  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    lastName: "",
    nric: "",
    mcStartDate: "",
    mcEndDate: "",
    days: "",
    startDateNo: "",
  });
  const [loading, setLoading] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [openModal, setOpenModal] = useState<boolean>(false);

  const handleFormSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault(); // Prevent default if the event is provided
    setLoading(true);

    try {
      // First prepare the form data with the date fields formatted
      const formattedFormData = {
        ...formData,
        mcStartDate: format(parseISO(formData.mcStartDate), "dd MMM yy"),
        mcEndDate: format(parseISO(formData.mcEndDate), "dd MMM yy"),
        firstName: formData.firstName.toUpperCase(),
        lastName: formData.lastName.toUpperCase(),
      };

      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formData: formattedFormData }), // Send as 'formData'
      });

      const { url } = await response.json();

      // Redirect user to Stripe Checkout
      window.location.href = url;
    } catch (error) {
      console.error("Error initiating payment:", error);
      alert("Payment initiation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // This function is used to check if termsOfUse modal should be rendered, i.e., validated form, otherwise, report invalid fields
  const handleFormSubmitWithValidation = (event: React.FormEvent) => {
    event.preventDefault(); // Prevent default form submission
    // Check if the form is valid using the browser's built-in validation
    // event.currentTarget refers to the form element that triggered the onSubmit event.
    // We cast it to HTMLFormElement using as HTMLFormElement to ensure TypeScript knows
    // it’s a form element and provides proper type-checking and autocompletion for form-specific methods and properties.
    const form = event.currentTarget as HTMLFormElement;
    // form.checkValidity() is a built-in browser method that checks if all the form fields pass their validation constraints (e.g., required fields are filled, email fields are valid, etc.).
    // It returns true if the form is valid and false if any field fails validation.
    if (form.checkValidity()) {
      // If the form is valid, open the modal
      setOpenModal(true);
    } else {
      // If the form is invalid, trigger the browser's validation messages
      // form.reportValidity() is a built-in browser method that triggers the browser's native validation messages.
      // These messages will appear next to the problematic fields, informing the user what needs to be corrected.
      form.reportValidity();
    }
  };

  // Updated handleChange to work with AutoFillAwareTextField
  // The keyof operator in TypeScript creates a union of string literal types for all the keys in an interface or type.
  // It means the name parameter can only be one of the keys in FormData
  const handleChange = (name: keyof FormData, value: string | number) => {
    const updatedFormData = { ...formData, [name]: value.toString() };
    setFormData(updatedFormData);

    if (name === "mcStartDate" || name === "mcEndDate") {
      const startDate = parseISO(updatedFormData.mcStartDate || "");
      const endDate = parseISO(updatedFormData.mcEndDate || "");

      // Check if both dates are valid and calculate the difference
      if (
        startDate &&
        endDate &&
        !isNaN(startDate.getTime()) &&
        !isNaN(endDate.getTime())
      ) {
        const daysDifference = differenceInDays(endDate, startDate) + 1;
        setShowTooltip(daysDifference > 3); // Show tooltip if the difference is greater than 3 days

        // Add calculated days into form submission, to avoid having to calculate it again
        setFormData((prevFormData) => ({
          ...prevFormData,
          days: daysDifference.toString(),
        }));

        // Update `startDateNo` when `mcStartDate` changes
        const startDateNo = format(startDate, "yyyyMMdd");
        setFormData((prevFormData) => ({
          ...prevFormData,
          startDateNo,
        }));
      }
    }
  };

  return (
    <>
      <Box
        sx={{
          paddingTop: { xs: "30%", sm: "25%", md: "20%", lg: "12%", xl: "8%" },
          backgroundColor: "white",
          display: "flex",
          flexDirection: "column",
          minHeight: { xs: "920px", lg: "950px" },
          width: "100%",
        }}
      >
        {/* Heading */}
        <Box
          sx={{
            textAlign: "center",
            mb: 4,
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
            }}
          >
            $10 a pop. No frills.
          </Typography>
        </Box>
        <Box
          sx={{
            margin: "0 auto",
          }}
        >
          {/* form starts here */}
          {/* if loading is true, show loading screen, otherwise show form */}
          <Box
            sx={{
              display: "flex",
              flexDirection: "column", // Stack on small screens, row layout on medium+
              alignItems: "center",
              justifyContent: "center", // Center content horizontally
            }}
          >
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
                onSubmit={handleFormSubmitWithValidation}
                sx={{
                  mt: 1,
                  width: { xs: "400px", sm: "500px", md: "700px" },
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
                    sx={{
                      mt: 1,
                      width: "48%",
                      backgroundColor: "white",
                      "& input:-webkit-autofill": {
                        WebkitBoxShadow: "0 0 0 1000px white inset",
                        WebkitTextFillColor: "black",
                      },
                    }}
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
                    sx={{
                      mt: 1,
                      width: "48%",
                      backgroundColor: "white",
                      "& input:-webkit-autofill": {
                        WebkitBoxShadow: "0 0 0 1000px white inset",
                        WebkitTextFillColor: "black",
                      },
                    }}
                  />
                </Box>
                <AutoFillAwareTextField
                  required
                  fullWidth
                  id="nric"
                  label="Last 4 digits of your NRIC (e.g., 777D)"
                  type="nric"
                  name="nric"
                  value={formData.nric}
                  onChange={(value) => handleChange("nric", value)}
                  margin="normal"
                  sx={{
                    backgroundColor: "white",
                    "& input:-webkit-autofill": {
                      WebkitBoxShadow: "0 0 0 1000px white inset",
                      WebkitTextFillColor: "black",
                    },
                  }}
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

                {/* Tooltip for Start of MC */}
                <Tooltip
                  title="We recommend limiting your MC to a maximum of 3 days."
                  open={showTooltip}
                  arrow
                >
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
                </Tooltip>
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  sx={{
                    mt: 4,
                    mb: 2,
                    textTransform: "none",
                    backgroundColor: "black",
                  }}
                  disabled={loading}
                >
                  {loading ? "Generating..." : "Generate"}
                </Button>
                {/* <Button
                  onClick={() => setOpenModal(true)}
                  fullWidth
                  variant="contained"
                  sx={{
                    mt: 4,
                    mb: 2,
                    textTransform: "none",
                    backgroundColor: "black",
                  }}
                  disabled={loading}
                >
                  Submit
                </Button> */}
              </Box>
            )}
            {/* Animated Picture */}
            {!loading && (
              <Box
                component="img"
                src="/fullerton.png" // Replace with the path to your image
                alt="Blinking Poster"
                sx={{
                  width: { xs: "50%", md: "30%" },
                  animation: `${tiltAnimation} 2s infinite ease-in-out`,
                  mt: 5,
                }}
              />
            )}
          </Box>
        </Box>
        <TermsOfUse
          open={openModal}
          onClose={() => setOpenModal(false)}
          onAcknowledge={handleFormSubmit} // Pass handleFormSubmit to modal
          showAcknowledge={true} // Pass prop to render the acknowledge button
        />
      </Box>
    </>
  );
};

export default SegmentOne;
