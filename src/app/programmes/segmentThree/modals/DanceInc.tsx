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
interface DanceIncProps {
  open: boolean;
  onClose: () => void;
}

const DanceInc: React.FC<DanceIncProps> = ({ open, onClose }) => {
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
          Dance Education (dancED) Programmes
        </Typography>
        {/* Second sentence */}
        <Typography
          sx={{
            fontSize: { xs: "30px", sm: "40px" },
            fontWeight: "bold",
            mb: 2,
          }}
        >
          Danc'inc
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
                Learn about diversity and inclusion through an introduction to
                creative access tools.
                <span style={{ color: "#6E6E73" }}>
                  {"  "}While accessibility is a fundamental human right,
                  crucial for autonomy, dignity, independence, disability is
                  rarely visible and oftentimes overlooked. Have you ever
                  wondered how people with access needs navigate their everyday
                  life, enjoy a musical performance, or practice dancing? This
                  is where access tools come in!
                  <br></br>
                  <br></br>
                  For people with access needs, enjoying and experiencing the
                  arts is made possible through access tools and devices like
                  audio descriptions (AD), closed-captioning (CC), visual story
                  (printed), Haptic Access tours, Sign Language Interpretations.
                  When in place and used thoughtfully, these tools create
                  opportunities and remove barriers for participation in the
                  arts.
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
                      width: "90%",
                      height: "auto",
                    }}
                  />
                </Box>
                Our Curriculum:
                <span style={{ color: "#6E6E73" }}>
                  {"  "} Through a mix of presentations and discussions,
                  participants will learn how access tools make participation in
                  the arts more inclusive for all, as well as hone their
                  aesthetic perspective, informed by diverse corporeal (bodily)
                  experience. The highlight of the session? Students get a shot
                  at designing their own access tools.
                  <br></br>
                  <br></br>
                  Participants can expect to leave the workshop with greater
                  appreciation of the arts as well as greater awareness of
                  diverse needs. Through the workshop, we hope to encourage an
                  artistic practice and orientation that leans towards
                  inclusion, where all can experience art without compromise.
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

export default DanceInc;
