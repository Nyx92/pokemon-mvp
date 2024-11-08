"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Box, Typography, IconButton, Card, CardContent } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import "./SegmentTwo.css";
import Image from "next/image";

interface Item {
  id: string;
  title: string;
  imgSrc: string;
  crdSrc: string;
  subtitle: string;
  content: string;
}

const items: Item[] = [
  {
    id: "1",
    title: "Play",
    imgSrc: "/about/about_play.png",
    crdSrc: "/about/playground_about.jpg",
    subtitle: "Play is a non-negotiable.",
    content:
      "Whether you’re 5 or 50, we believe that a playful and lighthearted orientation makes for a better learning experience. Through a mishmash of games, creative tasks, music, we encourage a playful, fun and supportive environment to explore and learn more about our bodies, movements and the ways in which we interact with and experience the world.",
  },
  {
    id: "2",
    title: "Care",
    imgSrc: "/about/about_care.png",
    crdSrc: "/about/care_about.jpg",
    subtitle: "Caring for all.",
    content:
      "Caught in the hustle and bustle of our time scarce society, we experience a gradual erosion of care. A sincere, attentive presence is often hard to come by. We recognize the value of collective artmaking and creative practice as sites for restoring care. The experience of dancing and moving together — engaged joyously in a creative endeavour — creates openings for mutual relating, nurtures connections between people through the relational qualities of touch, which in the process, allows us to enact gestures of care. We offer invitations to come into more care-full ways of relating to one another, paving ways for more equitable, just and caring societies.",
  },
  {
    id: "3",
    title: "Growth",
    imgSrc: "/about/about_growth.png",
    crdSrc: "/about/growth_modal.jpg",
    subtitle: "Nurturing growth.",
    content:
      "We’re interested in nurturing growth and creating acontainer for safe exploration through our dance and movement programmes. Whether it’s about becoming a more articulate dancer, building creative confidence, or simply finding more ease in the body … we’re interested in uncovering and celebrating these milestones with you! We care about and hope to create a supportive environment for your development.",
  },
];

const SegmentTwo: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Inside the SegmentTwo component
  const selectedItem = items.find((item) => item.id === selectedId);

  const handleClose = () => {
    setSelectedId(null);
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        backgroundColor: "#fafafc",
        paddingTop: "40px",
      }}
    >
      {/* Card List */}
      <Box
        sx={{
          display: "flex",
          gap: 2,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {items.map((item) => (
          <motion.div
            key={item.id}
            layoutId={item.id}
            onClick={() => setSelectedId(item.id)}
            style={{
              // size of the modals
              width: "300px",
              height: "200px",
              borderRadius: "12px",
              backgroundColor: "#f5f5f5",
              cursor: "pointer",
              boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
            whileHover={{ scale: 1.05 }}
          >
            <Image
              src={item.imgSrc}
              alt={item.title}
              width={300} // Specify an appropriate width
              height={200} // Specify an appropriate height
              style={{
                borderRadius: "16px",
                width: "80%", // Full width within the button
                height: "auto", // Maintain aspect ratio
              }}
            />
          </motion.div>
        ))}
      </Box>

      {/* Animated Expanded Card */}
      <AnimatePresence>
        {selectedId && (
          <motion.div
            className="modal-backdrop"
            onClick={handleClose} // Close modal on backdrop click
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.5)", // Semi-transparent backdrop
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
          >
            <motion.div
              className="modal-container"
              layoutId={selectedId}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                padding: "40px",
                borderRadius: "16px",
                backgroundColor: "white",
                position: "fixed",
                top: "15%", // Adjust for smaller screens
                boxShadow: "0 8px 16px rgba(0, 0, 0, 0.3)",
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center", // Center modal horizontally
                }}
              >
                {/* close modal button */}
                <IconButton
                  onClick={() => setSelectedId(null)}
                  sx={{ position: "absolute", top: 8, right: 8 }}
                >
                  <CloseIcon />
                </IconButton>

                {/* First sentence */}
                <Typography
                  sx={{ fontSize: "15px", fontWeight: "bold", mb: 2 }}
                >
                  Key Pillars
                </Typography>
                {/* Title */}
                <Typography
                  sx={{
                    fontSize: { xs: "30px", sm: "40px" },
                    fontWeight: "bold",
                    mb: 2,
                  }}
                >
                  {selectedItem?.title || ""}
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
                        {selectedItem?.subtitle || ""}
                        <span style={{ color: "#6E6E73" }}>
                          {"  "}
                          {selectedItem?.content || ""}
                        </span>
                      </Typography>
                    </Box>

                    {/* Add an img tag here with src set to the image path */}
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center", // Add this line to center conte
                      }}
                    >
                      {/* Add an img tag here with src set to the image path */}
                      <Image
                        src={selectedItem?.crdSrc || ""}
                        alt={selectedItem?.title || "Image"}
                        width={1200} // Specify a width for the image
                        height={600} // Specify a height for the image
                        style={{
                          borderRadius: "20px",
                          objectFit: "cover",
                          width: "60%",
                          height: "auto",
                        }}
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
};

export default SegmentTwo;
