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
interface DanceHackProps {
  open: boolean;
  onClose: () => void;
}

const DanceHack: React.FC<DanceHackProps> = ({ open, onClose }) => {
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
          Dance Hack
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
                An engaging and unique workshop for students to learn dance
                techniques and digital literacy for the future.
                <span style={{ color: "#6E6E73" }}>
                  {"  "}Understanding coding is essential for students to be
                  prepared for the jobs of the future, develop problem-solving
                  skills, foster creativity, and develop digital literacy skills
                  that are critical in the modern world.
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
                  {"  "} In this 90-min workshop, complex and abstract concepts
                  (which is coding, for most of us!) is made more accessible and
                  tangible through kinesthetic learning. Using dance techniques,
                  movement experiments and discussions, we will embark on an
                  exploration of basic computing concepts and an understanding
                  of logic thinking.
                  <br></br>
                  <br></br>
                  During the session, participants will be using movements and
                  dance routines to learn about sequencing, loops, and debugging
                  in coding. The session will culminate in a performance
                  showcase where students will get the opportunity to put their
                  newly acquired coding skills on display through movement
                  sequences developed during the workshop.
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

export default DanceHack;
