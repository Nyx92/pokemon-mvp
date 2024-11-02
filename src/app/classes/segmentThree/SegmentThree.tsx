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
    title: "Creative Contemporary Dance",
    imgSrc: "/classes/contemporary_class.jpg",
    description: "Explorative, experimental.",
    backgroundColor: "white",
    fontColor: "black",
  },
  {
    id: "2",
    title: "daSH residency",
    imgSrc: "/classes/ballet_class.png",
    description: "Strength, posture.",
    backgroundColor: "white",
    fontColor: "black",
  },
];

const SegmentThree: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedItem = classes.find((item) => item.id === selectedId);

  const controls = useAnimation();
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  useEffect(() => {
    if (inView) {
      controls.start("visible");
    }
  }, [controls, inView]);

  return (
    <Box
      sx={{
        paddingBottom: "50px",
        backgroundColor: "#fafafc",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          gap: "20px",
          width: "70%",
        }}
      >
        {classes.map((classItem) => (
          <motion.div
            key={classItem.id}
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
              width: "45%",
            }}
          >
            <motion.div
              onClick={() => setSelectedId(classItem.id)}
              whileHover={{ scale: 1.05 }}
              style={{
                width: "100%",
                height: "900px",
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
                  backgroundColor: classItem.backgroundColor,
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
                      color: classItem.fontColor,
                      fontSize: "30px",
                    }}
                  >
                    {classItem.title}
                  </Typography>
                  <Typography
                    sx={{
                      mb: 2,
                      fontWeight: "bold",
                      fontSize: "40px",
                      color: classItem.fontColor,
                    }}
                  >
                    {classItem.description}
                  </Typography>
                  <Box>
                    <Image
                      src={classItem.imgSrc}
                      alt={classItem.title}
                      layout="intrinsic"
                      width={500}
                      height={300}
                      style={{
                        borderRadius: "16px 16px 0 0",
                        objectFit: "cover",
                        width: "90%",
                      }}
                    />
                  </Box>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        ))}

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
                top: "15%",
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

export default SegmentThree;
