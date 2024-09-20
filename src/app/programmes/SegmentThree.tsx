"use client";

import { Box, Typography, Button, Avatar, Divider } from "@mui/material";

// Define an interface for props if you expect to receive any props
interface SegmentThreeProps {
  // add if required
}

const SegmentThree: React.FC<SegmentThreeProps> = (props) => {
  const programs = [
    {
      label: "Danc'inc",
      description: "for Seniors",
      image: "/programmes/elderly.png", // Replace with the correct image paths
    },
    {
      label: "Dancing bodies",
      description: "for Special Needs",
      image: "/programmes/sun.png",
    },
    {
      label: "Dance hack",
      description: "for Mental Wellness",
      image: "/programmes/brain.png",
    },
    {
      label: "Dance and choreology",
      description: "for Healthcare Partners",
      image: "/programmes/hospital.png",
    },
  ];

  return (
    <>
      {/* Program Overview Section */}
      <Box
        sx={{
          backgroundColor: "#fafafc",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          paddingTop: "100px",
        }}
      >
        {/* Programme Title */}
        <Box
          sx={{
            display: "flex",
            maxWidth: { md: "100%", lg: "80%" },
            flexDirection: "row",

            justifyContent: "center",
          }}
        >
          <Box
            sx={{
              marginRight: "80px",
            }}
          >
            <img
              src="/programmes/classroom.png"
              alt="Dance Science"
              style={{ width: "110%", borderRadius: "10px" }}
            />
          </Box>
          <Box
            sx={{
              maxWidth: "50%",
            }}
          >
            <Typography variant="h4" sx={{ fontWeight: "bold" }}>
              Our Dance Education (dancED) Programmes
            </Typography>
            <Typography
              variant="body1"
              sx={{
                marginTop: "20px",
                textAlign: "justify", // Justifies the text for alignment
              }}
            >
              We use dance and movement to create dynamic learning experiences
              through dance-integrated curricula. After a decade of designing
              and conducting dance education programmes, we’ve seen how an
              intentional integration of dance enlivens the learning field and
              encourages active participation from different groups, ranging
              from children & youths, to senior citizens. Over the years, we
              have created a range of dynamic learning experiences through
              dance-integrated curriculums that are accommodating of diverse
              learning styles. These are available as approved NAC-AEP
              programmes. Our dancED programmes are approved under the National
              Arts Council Arts Education Programme (NAC-AEP). Schools may
              purchase these programmes by contacting us directly via email, or
              whatsapp. Our dancED programmes are approved under the National
              Arts Council Arts Education Programme (NAC-AEP).
            </Typography>
            {/* Beautify the below segment please */}
            <Box>
              {programs.map((program, index) => (
                <>
                  <Box
                    key={program.label}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      mb: 3,
                      marginTop: "20px",
                      marginBottom: "15px",
                    }}
                  >
                    {/* Image Section */}
                    <Avatar
                      src={program.image}
                      alt={program.label}
                      sx={{
                        width: "50px",
                        height: "50px",
                        marginRight: "20px",
                        marginLeft: "30px",
                      }}
                    />

                    {/* Text Section */}
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                        {program.label}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {program.description}
                      </Typography>
                    </Box>
                  </Box>
                  <Divider sx={{ width: "80%", ml: 2 }} />
                </>
              ))}
            </Box>
          </Box>
        </Box>
      </Box>
    </>
  );
};

export default SegmentThree;
