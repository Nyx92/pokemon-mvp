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
interface DanceProps {
  open: boolean;
  onClose: () => void;
}

const Fun: React.FC<DanceProps> = ({ open, onClose }) => {
  return (
    <Modal
      open={open}
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
          overflow: "hidden", // Prevents the modal box itself from scrolling
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
            Contemporary Dance
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
                  Dance & movement classes for everyone.
                  <span style={{ color: "#6E6E73" }}>
                    {"  "}Develop confidence and articulation in your dance
                    practice through explorative, experimental and
                    organically-devised movement.
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
                  Our class draws on principles of contemporary dance techniques
                  with an emphasis on breath, flow, energy, opposition and
                  connection with the floor.
                  <span style={{ color: "#6E6E73" }}>
                    {"  "} Participants will be led to discover and create as
                    they move, supporting personal expression and improvisation.
                    Each session begins with a gentle awakening of the senses
                    that bring awareness to the space and our bodies, and
                    eventually, through a playful exploration of dance
                    materials, build up to dynamic sequences.
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
                      <strong>Led by:</strong> Denise Leong & Lin Yu-Tzu
                    </Box>
                    {/* <Box component="span" display="block" mt={1}>
                    <strong>When:</strong> TBC
                  </Box>
                  <Box component="span" display="block" mt={1}>
                    <strong>Where:</strong> TBC
                  </Box>
                  <Box component="span" display="block" mt={1}>
                    <strong>Fee:</strong> TBC
                  </Box> */}
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

export default Fun;
