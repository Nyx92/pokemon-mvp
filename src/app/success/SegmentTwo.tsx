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
              textAlign: "center", // Centers the text within Typography
            }}
          >
            Your medical certificate is being downloaded!
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
              Your officially unofficial medical certificate is ready! 🎉
              Whether you needed a well-earned break, a strategic escape, or
              just some "me time," we’ve got you covered. Rest easy knowing your
              perfectly crafted excuse is in hand—now go forth and enjoy your
              time off (responsibly, of course 😉). Stay healthy (or at least
              look like it), and we’ll be here whenever you need another day to
              recover from... life! 😏
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default SegmentTwo;
