import { Box, Typography } from "@mui/material";

// Define an interface for props if you expect to receive any props
interface SegmentOneProps {
  // add if required
}

const SegmentOne: React.FC<SegmentOneProps> = (props) => {
  return (
    <Box
      sx={{
        paddingTop: "90px",
        display: "flex",
        backgroundColor: "#fafafc",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden", // Prevents horizontal scroll due to overflow
      }}
    >
      <Box
        sx={{
          width: "100%",
          minHeight: "20vh",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          maxWidth: { md: "100%", lg: "80%" },
        }}
      >
        {/* Text column */}
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            maxWidth: "1200px", // Optional, for better readability on very wide screens
          }}
        >
          <Typography
            sx={{
              fontSize: { xs: "30px", md: "40px", lg: "60px" },
              fontWeight: "bold",
              color: "Black",
              fontFamily: "Roboto, sans-serif",
              letterSpacing: "-0.02em",
            }}
          >
            Our Programmes
          </Typography>

          <Typography
            sx={{
              mt: -1,
              fontSize: { xs: "15px", sm: "20px", md: "30px" },
              fontFamily: "Roboto, sans-serif",
              color: "black",
              letterSpacing: "-0.02em",
              marginBottom: "30px",
            }}
          >
            Every•body dancing any•way
          </Typography>

          <Typography
            sx={{
              textAlign: "justify", // Justifies the text for alignment
              marginX: "auto", // Center the block horizontally
              fontSize: { xs: "18px", sm: "24px" },
              marginBottom: "100px",
            }}
          >
            We are committed to helping you explore movement in a manner that is
            playful and rooted in curiosity. Using movement and dance as a
            medium, we uncover different possibilities through the human body in
            motion, and explore the joy of moving together.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default SegmentOne;
