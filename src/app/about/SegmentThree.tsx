"use client";

import { Box, Typography, Button } from "@mui/material";
import { useState } from "react";

// Define an interface for props if you expect to receive any props
interface SegmentThreeProps {
  // add if required
}

const SegmentThree: React.FC<SegmentThreeProps> = (props) => {
  return (
    <Box
      sx={{
        display: "flex",
        backgroundColor: "#fafafc",
        alignItems: "center",
        justifyContent: "center",
        paddingTop: "40px",
        flexDirection: "column",
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          maxWidth: "1200px", // Optional, for better readability on very wide screens
          marginBottom: "40px",
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
          Our Approach
        </Typography>

        <Typography
          sx={{
            textAlign: "justify", // Justifies the text for alignment
            marginX: "auto", // Center the block horizontally
            fontSize: { xs: "18px", sm: "24px" },
          }}
        >
          <span style={{ fontWeight: "bold" }}>
            We are constantly seeking to expand the possibilities of dance
            beyond aesthetics and performance so that we can bring the benefits
            of dance and joyful movement to everyone and every-body possible.{" "}
          </span>
          Through our programmes, we make dance accessible by breaking it down
          into an approachable and creative repertoire of functional movements
          for everyday life.
        </Typography>
      </Box>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          maxWidth: "1200px", // Optional, for better readability on very wide screens
          marginBottom: "40px",
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
          Dance & Movement as Intervention
        </Typography>

        <Typography
          sx={{
            textAlign: "justify", // Justifies the text for alignment
            marginX: "auto", // Center the block horizontally
            fontSize: { xs: "18px", sm: "24px" },
            marginBottom: "20px",
          }}
        >
          More than just a complementary or alternative intervention modality,
          dance and movement is hugely powerful and can offer opportunities for
          transformation. We see it as a rich resource and medium for the
          cultivation and restoration of health.
        </Typography>

        <Typography
          sx={{
            textAlign: "justify", // Justifies the text for alignment
            marginX: "auto", // Center the block horizontally
            fontSize: { xs: "18px", sm: "24px" },
            marginBottom: "20px",
          }}
        >
          While dance therapy is great, engagement is sometimes viewed through a
          treatment lens and participants, too, can come to see themselves as
          patients — a situation which is extremely limiting and constraining
          considering the potential for dance to be transformative. The
          activities in our programmes may take similar forms, but our
          orientation and intention differs from that of dance therapy sessions.
          We want to see our participants not as patients, but as dancers. When
          they’re moving with us, they're simply Uncle Roger or Aunty Annie. Not
          Uncle Roger or Aunty Annie with Alzheimer's. Our focus is to get our
          participants moving creatively and joyfully, often in community. In
          doing so, we believe therapeutic effects will flow naturally.
        </Typography>
      </Box>
    </Box>
  );
};

export default SegmentThree;
