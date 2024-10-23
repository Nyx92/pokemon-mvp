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

// Define interface for props
interface DawnProps {
  open: boolean;
  onClose: () => void;
}

const Dawn: React.FC<DawnProps> = ({ open, onClose }) => {
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
          D&wn
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
                For Individuals with Special Needs.
                <span style={{ color: "#6E6E73" }}>
                  {"  "}We are committed to making dance accessible to all. The transformative potential of dance and movement makes it an excellent activity for people with special needs. Our inclusive classes provide opportunities for people with different abilities to reap the benefits of dance, develop important social and psychomotor skills, and experience an enhanced quality of life.
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
                      marginBottom: "20px"
                    }}
                  />
                </Box>
                Evidence-based dance programmes have been shown to improve the functional health of participants and also lead to sustained improvement to psychosocial states. Studies have found that:
                <span style={{ color: "#6E6E73" }}>
                  {"  "} Adapted dance programmes substantially improved the locomotor skills and balance capacity of children with Down syndrome than that of neuromuscular exercises.
                  <br></br>
                  <br></br>
                  Studies demonstrated evidence of the benefits of dance and rhythmic auditory stimulation on body functions, particularly balance, gait, walking, and cardiorespiratory fitness for individuals with cerebral palsy.
                  <br></br>
                  <br></br>
                  Dance practice contributed to body awareness and social involvement using techniques that provide mirroring, synchronisation, rhythm, and reciprocity in adults with normal to high-functioning autism spectrum disorder (ASD).
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
                  <Image
                    src="/programmes/segmentTwo/modal/healthy.jpg" // Change to your image path
                    alt="heart"
                    width={800} // Specify a width for the image
                    height={800} // Specify a height for the image
                    style={{
                      borderRadius: "20px",
                      objectFit: "cover",
                      width: "100%",
                      height: "auto",
                    }}
                  />
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
