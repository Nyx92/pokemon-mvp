"use client";

import { Box, Typography, Avatar, Divider } from "@mui/material";
import { useState } from "react";
import Replay from "./modals/Replay";
import Company from "./modals/Company";
import Dawn from "./modals/Dawn";
import Hearth from "./modals/Hearth";
import Image from "next/image";
import "./SegmentTwo.css";

// Define an interface for props if you expect to receive any props
interface SegmentTwoProps {
  // add if required
}

// Define a union type for program names
type ProgramNames = "Replay" | "Dawn" | "Company" | "Hearth";

interface ProgramsItems {
  name: ProgramNames;
  label: string;
  description: string;
  image: string;
}

// ProgramsItems[] is a TypeScript array type that means "an array of ProgramsItems objects."
const programs: ProgramsItems[] = [
  {
    name: "Replay",
    label: "Re:play",
    description: "for Seniors",
    image: "/programmes/elderly.png",
  },
  {
    name: "Dawn",
    label: "D&wn",
    description: "for Special Needs",
    image: "/programmes/sun.png",
  },
  {
    name: "Company",
    label: "In moving company",
    description: "for Mental Wellness",
    image: "/programmes/brain.png",
  },
  {
    name: "Hearth",
    label: "Hearth",
    description: "for Healthcare Partners",
    image: "/programmes/hospital.png",
  },
];

const SegmentTwo: React.FC<SegmentTwoProps> = () => {
  // state to track the name of the currently active modal
  const [activeModalName, setActiveModalName] = useState<ProgramNames | "">("");
  const [openModal, setOpenModal] = useState<boolean>(false);

  // Create an object that maps button names to modal components
  const modalComponentMap: Record<
    ProgramNames,
    React.FC<{ open: boolean; onClose: () => void }>
  > = {
    Replay,
    Dawn,
    Company,
    Hearth,
  };

  const renderModal = () => {
    if (!activeModalName || !openModal) return null;
    // based on current activeModalName - i.e., the button which was clicked
    const ModalComponent = modalComponentMap[activeModalName as ProgramNames];
    if (!ModalComponent) return null; // In case there is no matching modal component

    return <ModalComponent open={openModal} onClose={handleCloseModal} />;
  };

  const handleOpenModal = (modalName: ProgramNames) => {
    setActiveModalName(modalName);
    setOpenModal(true);
  };

  const handleCloseModal = () => {
    setOpenModal(false);
  };

  return (
    <>
      {/* Program Overview Section */}
      <Box
        sx={{
          backgroundColor: "#fafafc",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          paddingTop: "100px",
        }}
      >
        {/* Programme Title */}
        <Box
          sx={{
            display: "flex",
            maxWidth: { lg: "100%", xl: "80%" },
            flexDirection: { xs: "column", lg: "row" },
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Box
            sx={{
              marginRight: { lg: "10%" },
              display: "flex",
              alignItems: "center",
              marginBottom: { xs: "20px", lg: "0px" },
            }}
          >
            <Image
              className="responsive-image"
              src="/programmes/dance_all_programme.png"
              alt="Dance Science"
              width={600} // Specify the actual width of the image
              height={400} // Adjust the height as needed to maintain aspect ratio
              style={{
                borderRadius: "10px",
              }}
            />
          </Box>
          <Box
            sx={{
              maxWidth: { xs: "90%", lg: "40%" },
            }}
          >
            <Typography variant="h4" sx={{ fontWeight: "bold" }}>
              Our Dance Science and Health (daSH) Programmes
            </Typography>
            <Typography
              variant="body1"
              sx={{
                marginTop: "20px",
                textAlign: "justify", // Justifies the text for alignment
              }}
            >
              Our Dance Science and Health (daSH) programmes are designed to
              promote overall health and social determinants of health for
              people across different backgrounds and demographics. Through
              daSH, we make arts and movement available and possible for
              everyone. Dance is an essential, critical and integral
              intervention in healthcare and can be a valuable approach for
              improving cognition, promoting physical, social, and mental
              wellbeing. It can be incorporated into the social prescribing
              model to help individuals improve their overall health and quality
              of life.
            </Typography>

            {programs.map((program) => (
              <Box key={program.label}>
                <Box
                  onClick={() => handleOpenModal(program.name)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    marginTop: "20px",
                    marginBottom: "15px",
                    cursor: "pointer",
                  }}
                >
                  {/* Image Section */}
                  <Avatar
                    src={program.image}
                    alt={program.label}
                    sx={{
                      width: "50px",
                      height: "50px",
                      marginRight: "20px",
                      marginLeft: "30px",
                    }}
                  />

                  {/* Text Section */}
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                      {program.label}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {program.description}
                    </Typography>
                  </Box>
                </Box>
                <Divider sx={{ width: "80%", ml: 2 }} />
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
      {/* This will render the modal based on the activeModalName */}
      {renderModal()}
    </>
  );
};

export default SegmentTwo;
