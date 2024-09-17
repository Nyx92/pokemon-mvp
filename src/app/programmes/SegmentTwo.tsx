"use client";

import { Box, Typography, Button, Grid } from "@mui/material";

const ProgramPage = () => {
  const handleOpenModal = (program: string) => {
    // Implement modal opening logic here
    console.log(`Open modal for ${program}`);
  };

  const handleContact = () => {
    // Implement contact logic here
    console.log("Contact us");
  };

  return (
    <Box sx={{ backgroundColor: "#fafafc", padding: "0 20px" }}>
      {/* Hero Section */}
      <Box
        sx={{
          position: "relative",
          height: "400px",
          backgroundImage: "url('/path-to-hero-image.jpg')",
          backgroundSize: "cover",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "black",
          textAlign: "center",
        }}
      >
        <Typography
          variant="h2"
          sx={{ fontWeight: "bold", fontSize: { xs: "24px", md: "48px" } }}
        >
          daSH
        </Typography>
        <Typography variant="h4" sx={{ marginTop: "20px" }}>
          DANCE SCIENCE & HEALTH
        </Typography>
      </Box>

      {/* Program Overview Section */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          padding: "40px",
        }}
      >
        <Box sx={{ flex: 1, padding: "20px" }}>
          <Typography variant="h4" sx={{ fontWeight: "bold" }}>
            Our Dance Science and Health (daSH) Programmes
          </Typography>
          <Typography variant="body1" sx={{ marginTop: "20px" }}>
            Integrating the artistry of dance and the science behind
            evidence-based practices, we bring the benefits of dance and joyful
            movement to everyone and every-body possible through community dance
            programmes.
          </Typography>
        </Box>
        <Box sx={{ flex: 1, padding: "20px" }}>
          <img
            src="/path-to-dash-image.jpg"
            alt="Dance Science"
            style={{ width: "100%", borderRadius: "10px" }}
          />
        </Box>
      </Box>

      {/* Subprograms Section */}
      <Box sx={{ padding: "40px" }}>
        <Typography
          variant="h4"
          sx={{ textAlign: "center", marginBottom: "30px" }}
        >
          Subprogrammes
        </Typography>
        <Grid container spacing={2}>
          {["Seniors", "Youths", "Special Needs"].map((program) => (
            <Grid item xs={12} sm={4} key={program}>
              <Box
                sx={{
                  padding: "20px",
                  textAlign: "center",
                  border: "1px solid #ccc",
                  borderRadius: "10px",
                  cursor: "pointer",
                  "&:hover": {
                    boxShadow: "0px 4px 15px rgba(0, 0, 0, 0.2)",
                  },
                }}
                onClick={() => handleOpenModal(program)}
              >
                <Typography variant="h6">{program}</Typography>
                <Typography variant="body2">
                  Brief description of {program}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Dance Education Section */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          padding: "40px",
        }}
      >
        <Box sx={{ flex: 1, padding: "20px" }}>
          <Typography variant="h4" sx={{ fontWeight: "bold" }}>
            dancED
          </Typography>
          <Typography variant="body1" sx={{ marginTop: "20px" }}>
            We use dance and movement to create dynamic learning experiences
            through dance-integrated curricula.
          </Typography>
        </Box>
        <Box sx={{ flex: 1, padding: "20px" }}>
          <img
            src="/path-to-danced-image.jpg"
            alt="Dance Education"
            style={{ width: "100%", borderRadius: "10px" }}
          />
        </Box>
      </Box>

      {/* Contact Section */}
      <Box sx={{ padding: "40px", textAlign: "center" }}>
        <Typography variant="h5" sx={{ marginBottom: "20px" }}>
          Interested in integrating movement into your programs?
        </Typography>
        <Button variant="contained" color="primary" onClick={handleContact}>
          Contact Us
        </Button>
      </Box>
    </Box>
  );
};

export default ProgramPage;
