"use client";

import { Box, Typography, Avatar, Divider } from "@mui/material";
import { useState } from "react";
import Choreology from "./modals/Choreology";
import DanceInc from "./modals/DanceInc";
import DancingBodies from "./modals/DancingBodies";
import DanceHack from "./modals/DanceHack";
import Image from "next/image";
import "./SegmentThree.css";

// Define an interface for props if you expect to receive any props
interface SegmentThreeProps {
  // add if required
}

// Define a union type for program names
type ProgramNames = "Choreology" | "DancingBodies" | "DanceInc" | "DanceHack";

interface ProgramsItems {
  name: ProgramNames;
  label: string;
  description: string;
  image: string;
}

// ProgramsItems[] is a TypeScript array type that means "an array of ProgramsItems objects."
const programs: ProgramsItems[] = [
  {
    name: "Choreology",
    label: "Danc'inc",
    description: "Access Tools Workshop",
    image: "/programmes/segmentThree/tools.jpg", // Replace with the correct image paths
  },
  {
    name: "DancingBodies",
    label: "Dancing bodies",
    description: "Dance Anatomy Workshop",
    image: "/programmes/segmentThree/dance_body.jpg",
  },
  {
    name: "DanceInc",
    label: "Dance hack",
    description: "Dance X Digital Literacy Workshop",
    image: "/programmes/segmentThree/computer.jpg",
  },
  {
    name: "DanceHack",
    label: "Dance and choreology",
    description: "Movement Literacy Workshop",
    image: "/programmes/segmentThree/kid_dance.png",
  },
];

const SegmentThree: React.FC<SegmentThreeProps> = (props) => {
  // state to track the name of the currently active modal
  const [activeModalName, setActiveModalName] = useState<ProgramNames | "">("");
  const [openModal, setOpenModal] = useState<boolean>(false);

  // Create an object that maps button names to modal components
  const modalComponentMap: Record<
    ProgramNames,
    React.FC<{ open: boolean; onClose: () => void }>
  > = {
    Choreology,
    DancingBodies,
    DanceInc,
    DanceHack,
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
              src="/programmes/segmentThree/classroom.png"
              alt="Classroom"
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
              Our Dance Education (dancED) Programmes
            </Typography>
            <Typography
              variant="body1"
              sx={{
                marginTop: "20px",
                textAlign: "justify", // Justifies the text for alignment
              }}
            >
              We use dance and movement to create dynamic learning experiences
              through dance-integrated curricula. After a decade of designing
              and conducting dance education programmes, we’ve seen how an
              intentional integration of dance enlivens the learning field and
              encourages active participation from different groups, ranging
              from children & youths, to senior citizens. Over the years, we
              have created a range of dynamic learning experiences through
              dance-integrated curriculums that are accommodating of diverse
              learning styles. These are available as approved NAC-AEP
              programmes. Our dancED programmes are approved under the National
              Arts Council Arts Education Programme (NAC-AEP). Schools may
              purchase these programmes by contacting us directly via email, or
              whatsapp. Our dancED programmes are approved under the National
              Arts Council Arts Education Programme (NAC-AEP).
            </Typography>
            {/* Beautify the below segment please */}
            <Box>
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
      </Box>
    </>
  );
};

export default SegmentThree;
