import React from "react";
import { Box, Typography } from "@mui/material";

// Define an interface for props if you expect to receive any props
interface SegmentOneProps {
  // add if required
}

const SegmentOne: React.FC<SegmentOneProps> = (props) => {
  return (
    <Box
      className="slide-in"
      sx={{
        marginX: "auto",
        width: "80%",
        marginTop: "80px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "40px",
      }}
    >
      {/* Edit Logo and tag line here */}
      <Box
        className="img-slide-in"
        sx={{
          width: { xs: "100%", sm: "80%" },
          display: "flex",
          justifyContent: { sm: "space-between" },
          flexDirection: { xs: "column", sm: "row" },
          alignItems: "center",
          marginBottom: "30px",
        }}
      >
        <Box
          component="img"
          src="/logo.png"
          alt="Logo"
          sx={{
            width: { xs: "150px", sm: "200px" },
            mb: { xs: 1, sm: 0 },
          }}
        />

        <Box
          sx={{
            textAlign: "right",
          }}
        >
          <Typography variant="h5" component="span" sx={{ fontSize: "24px" }}>
            A cheaper alternative
          </Typography>
          <br />
          <Typography variant="h5" component="span" sx={{ fontSize: "24px" }}>
            for your chaokeng needs
          </Typography>
        </Box>
      </Box>

      <Box
        className="slide-in"
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          borderRadius: 5,
          boxShadow: 5,
          overflow: "hidden",
        }}
      >
        <iframe
          src="https://giphy.com/embed/hOzfvZynn9AK4"
          width="720"
          height="540"
          style={{ border: "none" }}
          allowFullScreen
        ></iframe>
      </Box>
    </Box>
  );
};

export default SegmentOne;
