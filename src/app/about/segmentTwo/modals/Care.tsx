import React from "react";
import {
  Modal,
  Box,
  Typography,
  IconButton,
  Card,
  CardContent,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import Image from "next/image";

// Define the prop types for the Care component
interface CareProps {
  open: boolean;
  onClose: () => void;
}

const Care: React.FC<CareProps> = ({ open, onClose }) => {
  return (
    <Modal
      open={open}
      onClose={onClose}
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
      sx={{
        display: "flex", // Use flex layout
        alignItems: "flex-start", // Align modal to the top
        justifyContent: "center", // Center modal horizontally
        overflowY: "scroll", // Apply scroll to the Modal to enable browser scrollbar
        height: "100%", // Modal takes up the entire height, this enables overflow and scrolling
        pt: "2.5%", // Padding top to push content down slightly from the top
      }}
    >
      <Box
        sx={{
          position: "relative", // Relative for the box inside the modal
          width: { xs: "90%", sm: "80%", lg: "50%" }, // width of the modal
          bgcolor: "background.paper",
          borderRadius: "16px", // Rounded corners
          boxShadow: 24,
          p: 4,
        }}
      >
        {/* close modal button */}
        <IconButton
          onClick={onClose}
          sx={{ position: "absolute", top: 8, right: 8 }}
        >
          <CloseIcon />
        </IconButton>
        {/* First sentence */}
        <Typography sx={{ fontSize: "15px", fontWeight: "bold", mb: 2 }}>
          Key Pillars
        </Typography>
        {/* Second sentence */}
        <Typography
          sx={{
            fontSize: { xs: "30px", sm: "40px" },
            fontWeight: "bold",
            mb: 2,
          }}
        >
          Care.
        </Typography>

        {/* First Card */}
        <Card sx={{ borderRadius: "8px", bgcolor: "grey.50", mb: 5 }}>
          <CardContent sx={{ padding: "0" }}>
            <Box
              sx={{
                mx: "auto", // Sets both left and right margins to auto
                width: "70%",
                display: "flex",
                fontWeight: "bold",
                alignItems: "center",
                justifyContent: "center", // Add this line to center content horizontally
                mb: 5,
                mt: 5,
              }}
            >
              <Typography
                sx={{
                  fontSize: { xs: "15px", sm: "20px" },
                  fontWeight: "bold",
                  mb: 2,
                }}
              >
                Caring for all.
                <span style={{ color: "#6E6E73" }}>
                  {"  "}Caught in the hustle and bustle of our time scarce
                  society, we experience a gradual erosion of care. A sincere,
                  attentive presence is often hard to come by. We recognize the
                  value of collective artmaking and creative practice as sites
                  for restoring care. The experience of dancing and moving
                  together — engaged joyously in a creative endeavour — creates
                  openings for mutual relating, nurtures connections between
                  people through the relational qualities of touch, which in the
                  process, allows us to enact gestures of care. We offer
                  invitations to come into more care-full ways of relating to
                  one another, paving ways for more equitable, just and caring
                  societies.
                </span>
              </Typography>
            </Box>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center", // Add this line to center conte
              }}
            >
              <Image
                src="/about/care_about.jpg" // Change to your image path
                alt="heart"
                width={300} // Set an appropriate width
                height={200} // Set an appropriate height
                style={{
                  borderRadius: "20px",
                  width: "30%", // Maintain responsive width
                  height: "auto", // Maintain aspect ratio
                }}
              />
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Modal>
  );
};

export default Care;
