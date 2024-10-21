import { Box, Typography } from "@mui/material";
import Image from "next/image";

// Define an interface for props if you expect to receive any props
interface SegmentOneProps {
  // add if required
}

const SegmentOne: React.FC<SegmentOneProps> = (props) => {
  return (
    <Box
      sx={{
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
          maxWidth: { md: "100%", lg: "80%" },
        }}
      >
        <Box
          sx={{
            width: "100%",
            display: "flex",
            justifyContent: "center",
            marginBottom: "30px",
          }}
        >
          <Image
            src="/about/about_dance.jpg"
            alt="iMac"
            // These are required by the <Image /> component to define the original dimensions of the image in pixels. They help Next.js determine the aspect ratio of the image to maintain layout stability during loading, preventing CLS (Cumulative Layout Shift).
            width={1200}
            height={800}
            style={{
              width: "100%", // Full width for the image itself
              height: "auto", // Maintain aspect ratio
            }}
            priority // Improves LCP for critical images
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
              fontSize: { xs: "20px", md: "30px", lg: "40px" },
              fontWeight: "bold",
              color: "Black",
              fontFamily: "Roboto, sans-serif",
              letterSpacing: "-0.02em",
              marginBottom: "30px",
            }}
          >
            Ethos & Philosophy
          </Typography>

          <Typography
            sx={{
              textAlign: "center", // Justifies the text for alignment
              marginX: "auto", // Center the block horizontally
              fontSize: { xs: "18px", sm: "24px" },
              marginBottom: "20px",
            }}
          >
            We believe in making dance and movement accessible to all and our
            programmes are designed with play,care and growth in mind.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default SegmentOne;
