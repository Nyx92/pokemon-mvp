"use client";
import { useRef } from "react";
import { useInView } from "react-intersection-observer";
import { Box, Typography, Link } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { keyframes } from "@mui/system";

// Define an interface for props if you expect to receive any props
interface SegmentTwoProps {
  // add if required
}

const SegmentTwo: React.FC<SegmentTwoProps> = (props) => {
  const theme = useTheme();
  const scrollContainerRef = useRef(null);

  // Intersection Observer for the heading, to cause the elements to slide in when in view
  const { ref: headingRef, inView: headingInView } = useInView({
    triggerOnce: true, // Trigger animation only once
    threshold: 0.1, // Trigger when 10% of the element is in view
  });

  const slideInFromBottomTypography = keyframes`
    from {
      transform: translateY(100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  `;

  return (
    <Box
      sx={{
        marginX: "auto", // Automatically adjust the horizontal margins
        width: "80%",
        marginTop: theme.spacing(8),
        marginBottom: theme.spacing(8),
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Box
          ref={headingRef}
          sx={{
            width: { xs: "100%", sm: "80%" },
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: theme.spacing(4),
            animation: headingInView
              ? `${slideInFromBottomTypography} 1s ease-out both`
              : "",
          }}
        >
          <Typography
            sx={{
              fontSize: { xs: "20px", md: "30px", lg: "40px" },
              fontWeight: "bold",
              marginBottom: theme.spacing(4),
            }}
          >
            Creating healthy communities, one move at a time.
          </Typography>

          <Box
            sx={{
              width: "90%",
            }}
          >
            <Typography
              sx={{
                textAlign: "justify", // Justifies the text for alignment
                marginX: "auto", // Center the block horizontally
                fontSize: { xs: "18px", sm: "24px" },
                marginBottom: theme.spacing(4),
              }}
            >
              We are howone, a Creative Health social enterprise with science at
              play. As dancers and movers, we have experienced the tremendous
              potential of dance to enhance our sense of connection and well
              being. We want to bring the joy and benefits of dance to everyone
              regardless of age, ability and background. We believe movement is
              essential to health and we’re sincere about making it fun.
            </Typography>
          </Box>

          <Link
            href="#"
            sx={{
              color: "rgb(25, 118, 210)",
              textDecoration: "none",
              fontSize: { xs: "18px", sm: "24px" },
              display: "inline-block",
              marginRight: "20px",
              "&:hover": {
                textDecoration: "underline",
              },
            }}
          >
            Learn More
          </Link>
        </Box>
      </Box>
    </Box>
  );
};

export default SegmentTwo;
