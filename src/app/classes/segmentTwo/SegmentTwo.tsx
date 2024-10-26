"use client";
import { Box, Typography, Container, Grid } from "@mui/material";
import ClassCard from "./ClassCard"; // Import the class card component

const classesData = [
  {
    title: "Yoga Flow",
    imgSrc: "/classes/yoga.jpg",
    description:
      "An energizing flow class that focuses on flexibility and breath work. Perfect for beginners and experienced yogis.",
    upcomingClasses: "Monday, Wednesday, Friday at 6 PM",
    instructor: "Sarah Johnson",
    cost: "$20 per class",
  },
  {
    title: "Dance Cardio",
    imgSrc: "/classes/dance_cardio.jpg",
    description:
      "A high-energy class that combines fun dance moves with cardio exercises. Burn calories and have a blast!",
    upcomingClasses: "Tuesday, Thursday at 5 PM",
    instructor: "Michael Lee",
    cost: "$15 per class",
  },
  {
    title: "Pilates Strength",
    imgSrc: "/classes/pilates.jpg",
    description:
      "Strengthen your core and improve posture with a series of Pilates exercises.",
    upcomingClasses: "Saturday at 10 AM",
    instructor: "Emily Davis",
    cost: "$25 per class",
  },
];

const ClassesPage: React.FC = () => {
  return (
    <Container sx={{ paddingTop: "50px", paddingBottom: "50px" }}>
      <Typography
        variant="h3"
        sx={{
          fontWeight: "bold",
          textAlign: "center",
          marginBottom: "40px",
        }}
      >
        Our Classes
      </Typography>

      <Grid container spacing={4} justifyContent="center">
        {classesData.map((classItem, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
            <ClassCard {...classItem} />
          </Grid>
        ))}
      </Grid>
    </Container>
  );
};

export default ClassesPage;
