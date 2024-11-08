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
interface PilatesProps {
  open: boolean;
  onClose: () => void;
}

const Pilates: React.FC<PilatesProps> = ({ open, onClose }) => {
  return (
    <Modal
      open={open} // Add the missing open prop
      onClose={onClose}
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
      sx={{
        display: "flex",
        alignItems: "center", // Center modal vertically
        justifyContent: "center", // Center modal horizontally
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
          outline: "none", // Ensures no outline on the Box element
        }}
      >
        {/* close modal button */}
        <IconButton
          onClick={onClose}
          sx={{ position: "absolute", top: 8, right: 8 }}
        >
          <CloseIcon />
        </IconButton>
        {/* Scrollable Content */}
        <Box
          sx={{
            overflowY: "auto", // Enables scrolling within this content box
            maxHeight: "90vh", // Adjusts inner content height to ensure it fits within the modal
            pr: 2, // Padding to prevent text from touching the edge
            "&::-webkit-scrollbar": { display: "none" }, // Hides scrollbar in WebKit browsers
            scrollbarWidth: "none", // Hides scrollbar in Firefox
          }}
        >
          {/* First sentence */}
          <Typography sx={{ fontSize: "15px", fontWeight: "bold", mb: 2 }}>
            HowOne's Classes
          </Typography>
          {/* Second sentence */}
          <Typography
            sx={{
              fontSize: { xs: "30px", sm: "40px" },
              fontWeight: "bold",
              mb: 2,
            }}
          >
            Pilates (Online)
          </Typography>

          {/* First Card */}
          <Card sx={{ borderRadius: "8px", bgcolor: "grey.50", mb: 2 }}>
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
                  Listening to the Body's Language.
                  <span style={{ color: "#6E6E73" }}>
                    {"  "}Modern day stressors and sedentary lifestyles make the
                    body rigid, tense, painful, and lacking in vitality. This is
                    the body’s way of communicating with us. When we fail to
                    notice these signs, we lose touch with our bodies.
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
                  More than just exercise, pilates is a guide for the body.
                  <span style={{ color: "#6E6E73" }}>
                    {"  "} It is a gradual and systematic activation of the deep
                    core muscles guided and led by the breath. Though the
                    movements are simple, one can only achieve a high level of
                    control through concentration. Through conscious movement,
                    we pay attention to the body. With each intentional breath,
                    we wake up the sleeping self, get in touch with our own
                    stillness, and explore the curious and wonderful microcosm
                    of our bodies!
                    <br></br>
                    <br></br>
                    Our mat pilates classes are designed to increase strength,
                    flexibility, coordination and balance. We will be
                    integrating breath and movement within proper body mechanics
                    to increase awareness, and learn to utilise the muscles in
                    the body as they are designed. Class instructions will be
                    delivered in Chinese. Suitable for everyone ranging from new
                    to experienced participants.
                    <br></br>
                    <br></br>
                  </span>
                  <Typography
                    sx={{
                      fontSize: { xs: "15px", sm: "20px" },
                      fontWeight: "bold",
                      mb: 2,
                      textAlign: "left", // Aligns text to the left for a cleaner look
                    }}
                  >
                    <Box component="span" display="block">
                      <strong>Led by:</strong> Yu-Tzu Lin
                    </Box>
                    <Box component="span" display="block" mt={1}>
                      <strong>When:</strong> Every Sunday, 8:30-10:00 am
                    </Box>
                    <Box component="span" display="block" mt={1}>
                      <strong>Where:</strong> Online (via Zoom)
                    </Box>
                    <Box component="span" display="block" mt={1}>
                      <strong>Fee:</strong> NTD$250 or SGD$10
                    </Box>
                  </Typography>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
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
      </Box>
    </Modal>
  );
};

export default Pilates;
