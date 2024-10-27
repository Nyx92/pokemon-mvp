"use client";
import { Box, Typography } from "@mui/material";
import ClassCard from "./ClassCard"; // Import the class card component

const classesData = [
  {
    title: "Mat Pilates (online)",
    imgSrc: "/classes/yoga.jpg",
    description: "Strength, flexibility, coordination and balance.",
  },
  {
    title: "Fun-size movers",
    imgSrc: "/classes/dance_cardio.jpg",
    description: "Dance & movement classes for kids",
  },
  {
    title: "Creative Contemporary Dance",
    imgSrc: "/classes/pilates.jpg",
    description: "Explorative, experimental and organically-devised movement.",
  },
  {
    title: "daSH residency",
    imgSrc: "/classes/pilates.jpg",
    description:
      "Strengthen your core and improve posture with a series of Pilates exercises.",
  },
];

const ClassesPage: React.FC = () => {
  return (
    <Box
      sx={{
        paddingTop: "50px",
        paddingBottom: "50px",
        backgroundColor: "#fafafc",
        display: "flex",
        justifyContent: "center",
      }}
    >
      {/* Flexbox Container for 2x2 Layout */}
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "20px",
          padding: "0 20px",
          width: "60%",
        }}
      >
        {classesData.map((classItem, index) => (
          <ClassCard key={index} {...classItem} />
        ))}
      </Box>
    </Box>
  );
};

export default ClassesPage;
