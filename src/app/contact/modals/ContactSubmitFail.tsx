import { Modal, Box, Typography, Button } from "@mui/material";
import CancelIcon from "@mui/icons-material/Cancel";
import { FC } from "react";

interface ContactSubmitFailProps {
  open: boolean;
  onClose: () => void;
}

const ContactSubmitFail: FC<ContactSubmitFailProps> = ({ open, onClose }) => {
  return (
    <Modal
      open={open}
      onClose={onClose}
      sx={{
        display: "flex", // Use flex layout
        alignSelf: "center", // Align modal to the top
        alignItems: "center", // Align modal to the top
        justifyContent: "center", // Center modal horizontally
      }}
    >
      <Box
        sx={{
          position: "relative", // Relative for the box inside the modal
          height: { xs: "200px", sm: "300px" }, // Height of modal
          minWidth: { xs: "300px", sm: "500px" },
          bgcolor: "background.paper",
          borderRadius: "16px", // Rounded corners
          pb: "15px",
        }}
      >
        {/* Top half here */}
        {/* close modal button */}
        <Box
          sx={{
            bgcolor: "error.main", // Use the theme's success color
            borderRadius: "16px 16px 0 0", // Top left, top right, bottom right, bottom left
            height: { xs: "80px", sm: "120px" }, // Height of the top hald of the modal
            color: "common.white", // Use the theme's white color
            padding: 2, // Use theme spacing
            display: "flex", // Use flexbox to align items
            alignItems: "center", // Center items vertically
            justifyContent: "center", // Space out the close icon and the error title
          }}
        >
          <CancelIcon style={{ fontSize: 60, color: "white" }} />
        </Box>
        {/* Bottom half here */}
        {/* First sentence */}
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <Typography
            sx={{
              fontSize: { xs: "20px", sm: "30px" },
              fontWeight: "bold",
              mt: 2,
              mb: { xs: 1, sm: 2 },
            }}
          >
            Failed to submit form.
          </Typography>
          {/* Second sentence */}
          <Typography
            sx={{
              fontSize: { xs: "10px", sm: "15px" },
              mb: 1.5,
            }}
          >
            An unexpected error occured. We're working on it!
          </Typography>
          <Button
            variant="contained"
            onClick={onClose}
            sx={{
              color: "white",
              backgroundColor: "black",
              minWidth: "80px",
              borderRadius: "10px",
              textTransform: "none",
              fontSize: { xs: "10px", sm: "15px" },
              "&:hover": {
                backgroundColor: "black", // Keeping the background the same on hover
              },
            }}
          >
            {" "}
            Close
          </Button>
        </Box>
      </Box>
    </Modal>
  );
};

export default ContactSubmitFail;
