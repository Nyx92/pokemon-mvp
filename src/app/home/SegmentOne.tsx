"use client";

import { Box, Typography, Container } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { keyframes } from "@mui/system";

// Define an interface for props if you expect to receive any props
interface SegmentTwoProps {
  // Example prop definition; add more as required
  title?: string; // Optional prop
}

const SegmentTwo: React.FC<SegmentTwoProps> = (props) => {
  const theme = useTheme();

  const slideInFromBottom = keyframes`
    from {
      transform: translateY(10%);
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
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: theme.spacing(5),
        }}
      >
        <Box
          sx={{
            width: { xs: "100%", sm: "80%" },
            display: "flex",
            justifyContent: { xs: "flex-start", sm: "space-between" },
            flexDirection: { xs: "column", sm: "row" },
            alignItems: { xs: "flex-start", sm: "center" },
            marginBottom: theme.spacing(4),
            animation: `${slideInFromBottom} 1s ease-out both`,
          }}
        >
          {/* <Typography
            variant="h2"
            sx={{
              fontWeight: "bold",
              animation: `${slideInFromBottom} 1s ease-out both`,
              fontSize: { xs: "30px", sm: "50px" },
              mb: { xs: 1, sm: 0 },
            }}
          >
            {props.title || "Howone"}{" "}
          </Typography> */}

          <Box
            component="img"
            src="/logo2.png"
            alt="Logo"
            sx={{
              width: { xs: "150px", sm: "200px" },
              animation: `${slideInFromBottom} 1s ease-out both`,
              mb: { xs: 1, sm: 0 },
            }}
          />

          <Box
            sx={{
              textAlign: { xs: "left", sm: "right" },
              animation: `${slideInFromBottom} 1s ease-out both`,
            }}
          >
            <Typography
              variant="h5"
              component="span"
              sx={{ fontSize: { xs: "18px", sm: "24px" } }}
            >
              Creating healthy communities,
            </Typography>
            <br />
            <Typography
              variant="h5"
              component="span"
              sx={{ fontSize: { xs: "18px", sm: "24px" } }}
            >
              one move at a time.
            </Typography>
          </Box>
        </Box>

        <Box
          component="video"
          sx={{
            width: "100%",
            borderRadius: theme.shape.borderRadius,
            boxShadow: theme.shadows[5],
            animation: `${slideInFromBottom} 1s ease-out both`,
            outline: "none",
          }}
          autoPlay
          loop
          muted
        >
          <source src="/dance.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </Box>
      </Box>
    </Box>
  );
};

export default SegmentTwo;
