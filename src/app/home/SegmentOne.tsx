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
          <Typography
            variant="h5"
            component="span"
            sx={{ fontSize: "24px", display: { xs: "none" } }}
          >
            Creating healthy communities,
          </Typography>
          <br />
          <Typography
            variant="h5"
            component="span"
            sx={{ fontSize: "24px", display: { xs: "none" } }}
          >
            one move at a time.
          </Typography>
        </Box>
      </Box>

      <Box
        component="video"
        className="slide-in"
        sx={{
          width: "100%",
          borderRadius: 5,
          boxShadow: 5,
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
  );
};

export default SegmentOne;
