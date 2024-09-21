"use client";

import { Box, Typography, Button, Avatar, Divider } from "@mui/material";
import { useState } from "react";
import Replay from "./modals/Replay";
import Company from "./modals/Company";
import Dawn from "./modals/Dawn";
import Hearth from "./modals/Hearth";

// Define an interface for props if you expect to receive any props
interface SegmentTwoProps {
  // add if required
}

const programs = [
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

const SegmentTwo: React.FC<SegmentTwoProps> = (props) => {
  // state to track the name of the currently active modal
  const [activeModalName, setActiveModalName] = useState("");
  const [openModal, setOpenModal] = useState(false);

  // Create an object that maps button names to modal components
  const modalComponentMap = {
    Replay,
    Dawn,
    Company,
    Hearth,
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
            maxWidth: { md: "100%", lg: "80%" },
            flexDirection: "row",

            justifyContent: "center",
          }}
        >
          <Box
            sx={{
              marginRight: "80px",
            }}
          >
            <img
              src="/programmes/dance_all_programme.png"
              alt="Dance Science"
              style={{ width: "110%", borderRadius: "10px" }}
            />
          </Box>
          <Box
            sx={{
              maxWidth: "50%",
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
            {/* Beautify the below segment please */}
            <Box>
              {programs.map((program, index) => (
                <>
                  <Box
                    key={program.label}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      mb: 3,
                      marginTop: "20px",
                      marginBottom: "15px",
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
                </>
              ))}
            </Box>
          </Box>
        </Box>
      </Box>
    </>
  );
};

export default SegmentTwo;
