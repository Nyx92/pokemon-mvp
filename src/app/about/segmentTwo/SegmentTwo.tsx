"use client";

import { Box, Typography, Button } from "@mui/material";
import { useState } from "react";
import Care from "./modals/Care";
import Growth from "./modals/Growth";
import Play from "./modals/Play";
import Image from "next/image";

// Define a union type for modal names, a union type in TypeScript is a way to specify that a variable can hold one of several types. The pipe (|) operator acts as the union operator, meaning that the variable can hold either "Play", "Care", or "Growth".
type ModalName = "Play" | "Care" | "Growth";

// Define an interface for props if you expect to receive any props
interface SegmentTwoProps {
  // add if required
}

const buttons: { name: string; imgSrc: string; link: string }[] = [
  { name: "Play", imgSrc: "/about/about_play.png", link: "" },
  { name: "Care", imgSrc: "/about/about_care.png", link: "" },
  { name: "Growth", imgSrc: "/about/about_growth.png", link: "" },
];

const SegmentTwo: React.FC<SegmentTwoProps> = (props) => {
  // state to track the name of the currently active modal
  const [activeModalName, setActiveModalName] = useState<ModalName | "">("");
  const [openModal, setOpenModal] = useState(false);

  // Create an object that maps button names to modal components
  // Record<K, V> is a TypeScript utility type that is used to define an object type (i.e., key value pair)
  const modalComponentMap: Record<
    // K key is ModalName
    ModalName,
    // V value ensures that all components (Play, Care, Growth) inside modalComponentMap are React functional components that accept the specified props: { open: boolean; onClose: () => void }.
    React.FC<{ open: boolean; onClose: () => void }>
  > = {
    Play,
    Care,
    Growth,
  };

  const renderModal = () => {
    if (!activeModalName || !openModal) return null;
    // Retrieve the modal component based on activeModalName
    const ModalComponent = modalComponentMap[activeModalName];
    if (!ModalComponent) return null; // In case there is no matching modal component

    return <ModalComponent open={openModal} onClose={handleCloseModal} />;
  };

  const handleOpenModal = (modalName: ModalName) => {
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
              onClick={() => handleOpenModal(button.name as ModalName)}
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
              <Image
                src={button.imgSrc}
                alt={button.name}
                width={300} // Specify an appropriate width
                height={200} // Specify an appropriate height
                style={{
                  borderRadius: "16px",
                  width: "80%", // Full width within the button
                  height: "auto", // Maintain aspect ratio
                }}
              />
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
