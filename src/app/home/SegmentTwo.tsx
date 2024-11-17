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
              textAlign: "center", // Centers the text within Typography
            }}
          >
            Looking for a place to generate a medical certificate?
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
              Feeling too 'sick' to face the daily grind? Whether it's dodging
              work, skipping school, or just taking that much-needed 'you' day,
              we’ve got you covered! Create your very own medical certificate in
              minutes. Choose your symptoms—migraine, food poisoning, or that
              mysterious headache - and pick as many days off as you need, all
              without the hassle of waiting rooms or expensive doctor visits.
              Why bother with the real deal when you can craft the perfect
              excuse at a fraction of the cost?
            </Typography>

            <Typography
              sx={{
                textAlign: "justify", // Justifies the text for alignment
                marginX: "auto", // Center the block horizontally
                fontSize: { xs: "18px", sm: "24px" },
                marginBottom: theme.spacing(4),
              }}
            >
              We create precise replicas of authentic medical certificates
              issued by licensed practitioners in Singapore, ensuring every
              detail looks legitimate and professional. With our meticulous
              design, no one will ever suspect a thing, giving you the perfect
              alibi when you need it most.
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
            Generate now!
          </Link>
        </Box>
      </Box>
    </Box>
  );
};

export default SegmentTwo;
