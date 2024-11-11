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
interface ChoreologyProps {
  open: boolean;
  onClose: () => void;
}

const Choreology: React.FC<ChoreologyProps> = ({ open, onClose }) => {
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
          p: { xs: 2, md: 3, xl: 4 },
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
            "&::-webkit-scrollbar": { display: "none" }, // Hides scrollbar in WebKit browsers
            scrollbarWidth: "none", // Hides scrollbar in Firefox
          }}
        >
          {/* First sentence */}
          <Typography sx={{ fontSize: "15px", fontWeight: "bold", mb: 2 }}>
            Dance Education (dancED) Programmes
          </Typography>
          {/* Second sentence */}
          <Typography
            sx={{
              fontSize: { xs: "20px", sm: "30px", md: "40px" },
              fontWeight: "bold",
              mb: 2,
            }}
          >
            Dance and Choreology
          </Typography>

          {/* First Card */}
          <Card sx={{ borderRadius: "8px", bgcolor: "grey.50", mb: 2 }}>
            <CardContent sx={{ padding: "0" }}>
              <Box
                sx={{
                  mx: "auto", // Sets both left and right margins to auto
                  width: { xs: "95%", xl: "70%" },
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
                    fontSize: { xs: "15px", sm: "18px", md: "20px" },
                    fontWeight: "bold",
                    mb: 2,
                    textAlign: "justify", // Justifies the text for alignment
                  }}
                >
                  Explore movement patterns, refine your movement observation
                  skills and develop movement literacy!
                  <span style={{ color: "#6E6E73" }}>
                    {"  "}By providing a structured framework for analyzing and
                    understanding movement, guided by the five elements of the
                    Laban Movement Theory — body, effort, space, shape, and
                    relationship — explore and embark on an inquiry about the
                    movement patterns of the body.
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
                  Our Curriculum.
                  <span style={{ color: "#6E6E73" }}>
                    {"  "} This workshop will help dancers become more aware of
                    their own movement patterns and possibilities, and
                    ultimately become more expressive and creative movers. We
                    seek to create a supportive space that is fertile for
                    curiosity, inquiry and experimentation.
                    <br></br>
                    <br></br>
                    Our time together will offer opportunities for dancers —
                    both new and seasoned — to generate novel movement material,
                    develop choreographic structures, and explore movement
                    possibilities with other dancers.
                    <br></br>
                    <br></br>
                    Suitable for: Dancers who are looking to gain greater
                    awareness about their own movement patterns, break down
                    habitual movement patterns and expand their movement
                    vocabulary. Non-dancers who have a keen interest in
                    exploring movement as a mode of expression.
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
                        fontSize: { xs: "12px", xl: "20px" },
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

export default Choreology;
