"use client";

import { Box, Typography, Button } from "@mui/material";
import { useState } from "react";
import Care from "./modals/Care";
import Growth from "./modals/Growth";
import Play from "./modals/Play";

// Define an interface for props if you expect to receive any props
interface SegmentTwoProps {
  // add if required
}

const buttons = [
  {
    name: "Play",
    imgSrc: "/about/about_play.png",
    link: "",
  },
  {
    name: "Care",
    imgSrc: "/about/about_care.png",
    link: "",
  },
  {
    name: "Growth",
    imgSrc: "/about/about_growth.png",
    link: "",
  },
];

const SegmentTwo: React.FC<SegmentTwoProps> = (props) => {
  // state to track the name of the currently active modal
  const [activeModalName, setActiveModalName] = useState("");
  const [openModal, setOpenModal] = useState(false);

  // Create an object that maps button names to modal components
  const modalComponentMap = {
    Play,
    Care,
    Growth,
  };

  const renderModal = () => {
    if (!activeModalName || !openModal) return null;
    // based on current activeModalName - i.e., the button which was clicked
    const ModalComponent = modalComponentMap[activeModalName];
    if (!ModalComponent) return null; // In case there is no matching modal component

    return <ModalComponent open={openModal} onClose={handleCloseModal} />;
  };

  const handleOpenModal = (modalName) => {
    setActiveModalName(modalName);
    setOpenModal(true);
  };

  const handleCloseModal = () => {
    setOpenModal(false);
  };

  return (
    <Box
      sx={{
        display: "flex",
        backgroundColor: "#fafafc",
        alignItems: "center",
        justifyContent: "center",
        paddingTop: "40px",
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          maxWidth: "1200px", // Optional, for better readability on very wide screens
        }}
      >
        <Typography
          sx={{
            fontSize: { xs: "20px", md: "30px", lg: "40px" },
            fontWeight: "bold",
            color: "Black",
            fontFamily: "Roboto, sans-serif",
            letterSpacing: "-0.02em",
            marginBottom: "30px",
          }}
        >
          Key Pillars
        </Typography>

        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
          }}
        >
          {buttons.map((button) => (
            <Button
              key={button.name}
              onClick={() => handleOpenModal(button.name)}
              sx={{
                marginRight: "20px",
                backgroundColor: "#f5f5f5",
                alignSelf: "center",
                width: {
                  xs: "200px",
                  sm: "250px",
                  md: "300px",
                  lg: "340px",
                  xl: "500px",
                },
                height: {
                  xs: "140px",
                  sm: "150px",
                  md: "180px",
                  lg: "200px",
                  xl: "300px",
                },
                overflow: "hidden", // Prevents image from spilling out of rounded corners
                borderRadius: "16px", //for rounded edges
                transition: "all 0.3s ease",
                position: "relative",
                "& img": {
                  width: "80%",

                  borderRadius: "16px", // Apply rounded edges to the image as well
                  transition: "transform 0.3s ease", // Add this line for smooth transition of scaling
                },
                "&:hover": {
                  padding: 0,
                  zIndex: 2, // Ensure the button is above the others on hover
                  transform: "scale(1.03)", // Scales the button a bit larger
                  "& img": {
                    borderRadius: "16px",
                  },
                },
              }}
            >
              <img src={button.imgSrc} alt={button.name} />
            </Button>
          ))}
        </Box>
      </Box>
      {/* This will render the modal based on the activeModalName */}
      {renderModal()}
    </Box>
  );
};

export default SegmentTwo;
