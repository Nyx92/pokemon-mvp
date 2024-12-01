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
import SignUpFail from "./modals/ContactSubmitFail";
import AutoFillAwareTextField from "./AutoFillAwareTextField";
import { keyframes } from "@emotion/react"; // Import keyframes for animation
import { differenceInDays, parseISO } from "date-fns"; // Import date-fns for date calculations
import axios from "axios";

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
  });
  const [loading, setLoading] = useState(false);
  const [isFailedSubmit, setIsFailedSubmit] = useState(false);
  const [isSubmitFailModalOpen, setIsSubmitFailModalOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const handleFormSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    try {
      // By default, Axios assumes the response is in JSON format and attempts to parse it as such. Since the response from your server is a binary file (a PNG image in this case), you must explicitly tell Axios to treat the response as a blob (a raw binary object).
      const response = await axios.post("/api/submitForm", formData, {
        responseType: "blob", // Important to handle the binary response (PNG file)
      });

      // Create a blob from the response
      // creating a new Blob allows you to explicitly set its type, without specifying the type, the file might not be handled correctly when displayed or downloaded.
      const blob = new Blob([response.data], {
        type: response.headers["content-type"],
      });
      // URL.createObjectURL(blob) generates a temporary URL that represents the data contained in the blob.
      // This "Blob URL" serves as a reference to the raw data stored in memory, and by attaching it to an anchor (<a>) element with the download attribute, you effectively instruct the browser to: Recognize the Blob data as a file and allow the user to download the file when they click the link.
      const url = window.URL.createObjectURL(blob);

      // Creates an HTML <a> (anchor) element dynamically using JavaScript.
      const link = document.createElement("a");
      // Assigns the temporary blob: URL to the href attribute of the <a> element.
      link.href = url;
      // Sets the download attribute of the <a> element to "certificate.png".
      link.download = "certificate.png";
      // Sets the download attribute of the <a> element to "certificate.png".
      document.body.appendChild(link);
      // Simulates a user clicking the link.
      link.click();
      //Removes the <a> element from the DOM after the download starts.
      link.remove();

      // Revoke the object URL to release memory
      URL.revokeObjectURL(url);

      setLoading(false);
    } catch (error) {
      console.error(error);
      setLoading(false);
      alert("Error generating document");
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
        const daysDifference = differenceInDays(endDate, startDate);
        setShowTooltip(daysDifference > 3); // Show tooltip if the difference is greater than 3 days
      }
    }
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
            $15 a pop. No frills.
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
                onSubmit={handleFormSubmit}
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
                  label="NRIC"
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
              </Box>
            )}
            {/* Animated Picture */}
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
          </Box>
        </Box>
      </Box>
      <SignUpFail
        open={isSubmitFailModalOpen}
        onClose={() => setIsSubmitFailModalOpen(false)}
      />
    </>
  );
};

export default SegmentOne;
