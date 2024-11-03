import React from "react";
import {
  Modal,
  Box,
  Typography,
  IconButton,
  Card,
  CardContent,
  Button,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import Image from "next/image";

// Define interface for props
interface ReplayProps {
  open: boolean;
  onClose: () => void;
}

const Replay: React.FC<ReplayProps> = ({ open, onClose }) => {
  return (
    <Modal
      open={open}
      onClose={onClose}
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
      sx={{
        display: "flex", // Use flex layout
        alignItems: "flex-start", // Align modal to the top
        justifyContent: "center", // Center modal horizontally
        overflowY: "scroll", // Apply scroll to the Modal to enable browser scrollbar
        height: "100%", // Modal takes up the entire height, this enables overflow and scrolling
        pt: "2.5%", // Padding top to push content down slightly from the top
      }}
    >
      <Box
        sx={{
          position: "relative", // Relative for the box inside the modal
          width: { xs: "90%", sm: "80%", lg: "70%", xl: "50%" }, // width of the modal
          bgcolor: "background.paper",
          borderRadius: "16px", // Rounded corners
          boxShadow: 24,
          p: 4,
        }}
      >
        {/* close modal button */}
        <IconButton
          onClick={onClose}
          sx={{ position: "absolute", top: 8, right: 8 }}
        >
          <CloseIcon />
        </IconButton>
        {/* First sentence */}
        <Typography sx={{ fontSize: "15px", fontWeight: "bold", mb: 2 }}>
          Dance Science and Health (daSH) Programmes
        </Typography>
        {/* Second sentence */}
        <Typography
          sx={{
            fontSize: { xs: "30px", sm: "40px" },
            fontWeight: "bold",
            mb: 2,
          }}
        >
          Re:play
        </Typography>

        {/* First Card */}
        <Card sx={{ borderRadius: "8px", bgcolor: "grey.50", mb: 5 }}>
          <CardContent sx={{ padding: "0" }}>
            <Box
              sx={{
                mx: "auto", // Sets both left and right margins to auto
                width: "70%",
                display: "flex",
                fontWeight: "bold",
                alignItems: "center",
                justifyContent: "center", // Add this line to center content horizontally
                mb: 5,
                mt: 5,
              }}
            >
              <Typography
                sx={{
                  fontSize: { xs: "15px", sm: "20px" },
                  fontWeight: "bold",
                  mb: 2,
                  textAlign: "justify", // Justifies the text for alignment
                }}
              >
                For our seniors.
                <span style={{ color: "#6E6E73" }}>
                  {"  "}The artistic freedom and social aspects of dance can
                  help seniors manage the stress and challenges to daily living
                  due to conditions like Dementia or Parkinson’s. Dancing can
                  enhance fluidity of movement, postural stability, flexibility
                  of the spine and improve balance. The use of rhythm and voice
                  can help with cueing movement and expression. The integration
                  of music and dance into reminiscence therapy also helps people
                  with dementia evoke memories and stimulate mental activity.
                  <br></br>
                  <br></br>
                </span>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: { xs: "20px", lg: "35px", xl: "40px" },
                  }}
                >
                  {/* Add an img tag here with src set to the image path */}
                  <Image
                    src="/programmes/segmentTwo/modal/garden_1.jpg" // Change to your image path
                    alt="garden"
                    width={1200} // Specify a width for the image
                    height={600} // Specify a height for the image
                    style={{
                      borderRadius: "20px",
                      objectFit: "cover",
                      width: "90%",
                      height: "auto",
                    }}
                  />
                </Box>
                CORE. Creating Opportunities, Resources and Empowerment for a
                Community Of Ready Elders!
                <span style={{ color: "#6E6E73" }}>
                  {"  "} Definitely a mouthful but the idea is straightforward —
                  a programme to empower seniors to train other seniors in
                  movement and wellness activities.
                  <br></br>
                  <br></br>
                  Evidence-based dance programmes have been shown to improve the
                  functional health of participants and also lead to sustained
                  improvement to psychosocial states. Studies have found that:
                  <br></br>
                  <br></br>
                  Frequent dance activity is associated with a 76% reduced risk
                  of dementia, the greatest reduction compared to other
                  activities like reading, swimming, or doing crossword puzzles
                  frequently Dancing at moderate intensities was associated with
                  a reduced risk of cardiovascular disease (more so than
                  walking!) Dance-based mind-motor interventions were associated
                  with a significant reduction in rate of falls among older
                  adults
                  <br></br>
                  <br></br>
                </span>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center", // Add this line to center conte
                  }}
                >
                  <Button
                    variant="contained"
                    sx={{
                      m: 1,
                      borderRadius: "30px",
                      textTransform: "none",
                      backgroundColor: "black",
                      fontSize: "20px",
                    }}
                  >
                    Enquire more {">"}
                  </Button>
                </Box>
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Modal>
  );
};

export default Replay;
