"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { Box, Typography, Card, CardContent, IconButton } from "@mui/material";
import Image from "next/image";
import { useInView } from "react-intersection-observer";
import Pilates from "./modals/Pilates";
import Fun from "./modals/Fun";
import "./SegmentTwo.css";

// Define a union type for program names
type ClassNames = "Pilates" | "Fun";

interface ClassesItems {
  id: string;
  name: ClassNames;
  title: string;
  imgSrc: string;
  description: string;
  backgroundColor: string;
  fontColor: string;
}

const classes: ClassesItems[] = [
  {
    id: "1",
    name: "Pilates",
    title: "Mat Pilates (online)",
    imgSrc: "/classes/pilates_class.png",
    description: "Coordination, flexibility.",
    backgroundColor: "black",
    fontColor: "white",
  },
  {
    id: "2",
    name: "Fun",
    title: "Fun-size movers",
    imgSrc: "/classes/dancing-girl_class.jpg",
    description: "Dance classes for kids",
    backgroundColor: "white",
    fontColor: "black",
  },
];

const SegmentTwo: React.FC = () => {
  // state to track the name of the currently active modal
  const [activeModalName, setActiveModalName] = useState<ClassNames | "">("");
  const [openModal, setOpenModal] = useState<boolean>(false);

  // const selectedItem = classes.find((item) => item.id === selectedId);

  const controls = useAnimation();
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  useEffect(() => {
    if (inView) {
      controls.start("visible");
    }
  }, [controls, inView]);

  // Create an object that maps button names to modal components
  const modalComponentMap: Record<
    ClassNames,
    React.FC<{ open: boolean; onClose: () => void }>
  > = {
    Pilates,
    Fun,
  };

  const renderModal = () => {
    if (!activeModalName || !openModal) return null;
    // based on current activeModalName - i.e., the button which was clicked
    const ModalComponent = modalComponentMap[activeModalName as ClassNames];
    if (!ModalComponent) return null; // In case there is no matching modal component

    return <ModalComponent open={openModal} onClose={handleCloseModal} />;
  };

  const handleCloseModal = () => {
    setOpenModal(false);
  };

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
              onClick={() => {
                setActiveModalName(classItem.name);
                setOpenModal(true); // Add this line to open the modal
              }}
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
          {activeModalName && openModal && (
            <motion.div
              className="responsive-modal"
              layoutId={activeModalName}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: "fixed",
                top: "15%",
                transform: "translateX(-50%)",
                backgroundColor: "white",
                borderRadius: "16px",
                boxShadow: "0 8px 16px rgba(0, 0, 0, 0.3)",
                padding: "40px",
                overflowY: "auto",
                zIndex: 10,
              }}
            >
              {renderModal()}
            </motion.div>
          )}
        </AnimatePresence>
      </Box>
    </Box>
  );
};

export default SegmentTwo;
