import { Box, Typography, Link } from "@mui/material";

// Define an interface for props if you expect to receive any props
interface SegmentOneProps {
  // add if required
}

const SegmentOne: React.FC<SegmentOneProps> = (props) => {
  return (
    <Box
      sx={{
        marginX: "auto", // This might need adjustment or removal to ensure full width
        marginTop: "60px",
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
          minwidth: "80vw",
          maxWidth: { md: "100vw", lg: "80vw" },
        }}
      >
        {/* Start of phone pic */}
        <Box
          sx={{
            width: "100%",
            display: "flex",
            justifyContent: "center",
            marginBottom: "30px",
          }}
        >
          <img
            src="/about_dance.jpg"
            alt="iMac"
            style={{
              width: "100%", // Full width for the image itself
              height: "auto", // Maintain aspect ratio
            }}
          />
        </Box>
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
              fontSize: { xs: "30px", md: "50px", lg: "80px" },
              fontWeight: "bold",
              color: "Black",
              fontFamily: "Roboto, sans-serif",
              letterSpacing: "-0.02em",
            }}
          >
            Our Story
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
            Packed with more fun.
          </Typography>
          {/* Links */}
          <Box
            sx={{
              mt: 2,
              fontSize: { xs: "13px", sm: "17px", md: "26px" },
            }}
          ></Box>
          {/* End of links */}
        </Box>
        <Typography
          sx={{
            textAlign: "justify", // Justifies the text for alignment
            marginX: "auto", // Center the block horizontally
            fontSize: { xs: "18px", sm: "24px" },
            marginBottom: "100px",
          }}
        >
          howone (pronounced "how one") is derived from the Chinese characters
          好玩, meaning ‘good fun’. howone is a Creative Health social
          enterprise and we believe in the power of play and finding joy in
          every aspect of health. As dancers, we have experienced how dance is
          an incredibly powerful instrument, one that we can use to improve
          cognitive, physical and mental wellbeing, a sense of connection to
          ourselves and to others. It's not just about building strength and
          balance — it's also about fun, playfulness, and creative expression.
          We believe movement is essential to health and we’re sincere about
          making it fun.
        </Typography>
      </Box>
    </Box>
  );
};

export default SegmentOne;
