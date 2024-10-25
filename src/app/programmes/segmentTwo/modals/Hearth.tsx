import React from "react";
import {
  Modal,
  Box,
  Typography,
  IconButton,
  Card,
  CardContent,
  Button,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import Image from "next/image";

// Define interface for props
interface HearthProps {
  open: boolean;
  onClose: () => void;
}

const Dawn: React.FC<HearthProps> = ({ open, onClose }) => {
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
          width: { xs: "90%", sm: "80%", lg: "70%", xl: "50%" }, // width of the modal
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
          Dance Science and Health (daSH) Programmes
        </Typography>
        {/* Second sentence */}
        <Typography
          sx={{
            fontSize: { xs: "30px", sm: "40px" },
            fontWeight: "bold",
            mb: 2,
          }}
        >
          Hearth
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
                  textAlign: "justify", // Justifies the text for alignment
                }}
              >
                for Healthcare Partners.
                <span style={{ color: "#6E6E73" }}>
                  {"  "}We collaborate with community hospitals to research and
                  explore ways of integrating dance and movement into social
                  prescribing models to support healthcare and well being
                  initiatives. With the help of a dance movement
                  psychotherapist, we design community dance programmes to
                  connect diverse groups to affordable and accessible dance
                  classes in partnership with local healthcare providers.
                  <br></br>
                  <br></br>
                </span>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: { xs: "20px", lg: "35px", xl: "40px" },
                  }}
                >
                  {/* Add an img tag here with src set to the image path */}
                  <Image
                    src="/programmes/segmentTwo/modal/garden_1.jpg" // Change to your image path
                    alt="garden"
                    width={1200} // Specify a width for the image
                    height={600} // Specify a height for the image
                    style={{
                      borderRadius: "20px",
                      objectFit: "cover",
                      width: "100%",
                      height: "auto",
                    }}
                  />
                </Box>
                Evidence-based dance programmes have been shown to improve the
                functional health of participants and also lead to sustained
                improvement to psychosocial states. Studies have found that:
                <span style={{ color: "#6E6E73" }}>
                  {"  "} Dance promotes movement and physical activity for older
                  patients. It is a meaningful and enjoyable activity, which
                  encourages social interaction, enliven spaces and provides
                  respite from the medical environment.
                  <br></br>
                  <br></br>
                  92% of children and young people experiencing acute pain
                  following orthopaedic or cardiac surgery, or post-acquired
                  brain injury experienced a reduction in pain, with 80%
                  experiencing a more than 50% reduction through improvised
                  somatic dance (ISD) on 25 participants.
                  <br></br>
                  <br></br>
                </span>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center", // Add this line to center conte
                  }}
                >
                  <Button
                    variant="contained"
                    sx={{
                      m: 1,
                      borderRadius: "30px",
                      textTransform: "none",
                      backgroundColor: "black",
                      fontSize: "20px",
                    }}
                  >
                    Enquire more {">"}
                  </Button>
                </Box>
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Modal>
  );
};

export default Dawn;
