"use client";
import { Box, Typography } from "@mui/material";
import ClassCard from "./ClassCard"; // Import the class card component

const classesData = [
  {
    title: "Mat Pilates (online)",
    imgSrc: "/classes/pilates_class.png",
    description: "Coordination, flexibility.",
    backgroundColor: "black",
    fontColor: "white",
  },
  {
    title: "Fun-size movers",
    imgSrc: "/classes/dancing-girl_class.jpg",
    description: "Dance classes for kids",
    backgroundColor: "white",
    fontColor: "black",
  },
  {
    title: "Creative Contemporary Dance",
    imgSrc: "/classes/contemporary_class.jpg",
    description: "Explorative, experimental.",
    backgroundColor: "white",
    fontColor: "black",
  },
  {
    title: "daSH residency",
    imgSrc: "/classes/pilates.jpg",
    description: "Strength, posture.",
    backgroundColor: "white",
    fontColor: "black",
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
