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
interface ResidencyProps {
  open: boolean;
  onClose: () => void;
}

const Fun: React.FC<ResidencyProps> = ({ open, onClose }) => {
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
            daSH residency
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
                  Engage with the local dance community
                  <span style={{ color: "#6E6E73" }}>
                    {"  "}daSH residency aims to provide holistic development
                    opportunities for dance artists and movement researchers to
                    embark on and deepen their engagement with the local
                    community. This includes providing opportunities for
                    capability building and platforms for you to encounter and
                    engage with various communities and community stakeholders.
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
                  Through the residency, you will have opportunities to
                  dialogue, develop and co-create with the community with the
                  objective of enhancing artistry, improving health and
                  reflecting the collective stories of the people.
                  <span style={{ color: "#6E6E73" }}>
                    {"  "} howone offer daSH residency attracting dance artists
                    and movement researcher at different stages of their
                    careers. During your time here, you will facilitate and
                    engage intimately with our local community, supporting their
                    journey in dance and health.
                    <br></br>
                    <br></br>
                  </span>
                  Cost and living?
                  <span style={{ color: "#6E6E73" }}>
                    {"  "}There will be no costs involved. Participants who
                    require visa to enter Singapore will need to apply for visa
                    independently. Flights and accomodation will not be
                    provided. daSH residency lasts from 2 weeks to 6 months
                    <br></br>
                    <br></br>
                  </span>
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
