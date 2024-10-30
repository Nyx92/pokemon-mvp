"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { Box, Typography, Card, CardContent, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import Image from "next/image";
import { useInView } from "react-intersection-observer";

interface ClassesItems {
  id: string;
  title: string;
  imgSrc: string;
  description: string;
  backgroundColor: string;
  fontColor: string;
}

const classes: ClassesItems[] = [
  {
    id: "1",
    title: "Mat Pilates (online)",
    imgSrc: "/classes/pilates_class.png",
    description: "Coordination, flexibility.",
    backgroundColor: "black",
    fontColor: "white",
  },
  {
    id: "2",
    title: "Fun-size movers",
    imgSrc: "/classes/dancing-girl_class.jpg",
    description: "Dance classes for kids",
    backgroundColor: "white",
    fontColor: "black",
  },
  {
    id: "3",
    title: "Creative Contemporary Dance",
    imgSrc: "/classes/contemporary_class.jpg",
    description: "Explorative, experimental.",
    backgroundColor: "white",
    fontColor: "black",
  },
  {
    id: "4",
    title: "daSH residency",
    imgSrc: "/classes/ballet_class.png",
    description: "Strength, posture.",
    backgroundColor: "white",
    fontColor: "black",
  },
];

const ClassesPage: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedItem = classes.find((item) => item.id === selectedId);

  // Split classes into rows of 2 cards each
  const rows = [];
  for (let i = 0; i < classes.length; i += 2) {
    rows.push(classes.slice(i, i + 2));
  }

  return (
    <Box
      sx={{
        paddingTop: "50px",
        paddingBottom: "50px",
        backgroundColor: "#fafafc",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <Box
        sx={{
          width: "60%",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        {rows.map((row, rowIndex) => {
          // Set up useInView for each row
          const controls = useAnimation();
          const [ref, inView] = useInView({
            triggerOnce: true,
            threshold: 0.1, // Adjust for when the animation should start
          });

          useEffect(() => {
            if (inView) {
              controls.start("visible");
            }
          }, [controls, inView]);

          return (
            <motion.div
              key={rowIndex}
              ref={ref}
              initial="hidden"
              animate={controls}
              variants={{
                hidden: { opacity: 0, y: 50 },
                visible: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "20px",
              }}
            >
              {row.map((item) => (
                <motion.div
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  whileHover={{ scale: 1.05 }}
                  style={{
                    width: "calc(50% - 10px)", // Adjust for 2x2 layout
                    height: "900px", // Adjust card height
                    minWidth: "280px",
                    cursor: "pointer",
                  }}
                >
                  <Card
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      boxShadow: "0 8px 16px rgba(0, 0, 0, 0.2)",
                      borderRadius: "16px",
                      width: "100%",
                      height: "100%",
                      backgroundColor: item.backgroundColor,
                    }}
                  >
                    <CardContent
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        paddingTop: "140px",
                        width: "100%",
                        height: "100%",
                      }}
                    >
                      <Typography
                        sx={{
                          fontWeight: "bold",
                          mb: 1,
                          color: item.fontColor,
                          fontSize: "30px",
                        }}
                      >
                        {item.title}
                      </Typography>
                      <Typography
                        sx={{
                          mb: 2,
                          fontWeight: "bold",
                          fontSize: "40px",
                          color: item.fontColor,
                        }}
                      >
                        {item.description}
                      </Typography>
                      <Box>
                        <Image
                          src={item.imgSrc}
                          alt={item.title}
                          layout="intrinsic" // Use intrinsic for better control
                          width={500}
                          height={300}
                          style={{
                            borderRadius: "16px 16px 0 0",
                            objectFit: "cover", // Ensures the image covers the container
                            width: "90%", // Full width of the container
                          }}
                        />
                      </Box>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          );
        })}
        {/* Animated Expanded Card */}
        <AnimatePresence>
          {selectedId && (
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
                  justifyContent: "center",
                }}
              >
                <IconButton
                  onClick={() => setSelectedId(null)}
                  sx={{ position: "absolute", top: 8, right: 8 }}
                >
                  <CloseIcon />
                </IconButton>
                <Typography
                  sx={{ fontSize: "15px", fontWeight: "bold", mb: 2 }}
                >
                  Key Pillars
                </Typography>
                <Typography
                  sx={{
                    fontSize: { xs: "30px", sm: "40px" },
                    fontWeight: "bold",
                    mb: 2,
                  }}
                >
                  {selectedItem?.title || ""}
                </Typography>
              </Box>
            </motion.div>
          )}
        </AnimatePresence>
      </Box>
    </Box>
  );
};

export default ClassesPage;
