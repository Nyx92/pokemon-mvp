"use client";
import { useEffect } from "react";
import { motion, useAnimation } from "framer-motion";
import { Box, Typography, Card, CardContent } from "@mui/material";
import Image from "next/image";
import { useInView } from "react-intersection-observer";

interface ClassCardProps {
  title: string;
  imgSrc: string;
  description: string;
  backgroundColor: string;
  fontColor: string;
}

const ClassCard: React.FC<ClassCardProps> = ({
  title,
  imgSrc,
  description,
  backgroundColor,
  fontColor,
}) => {
  const controls = useAnimation();
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.2,
  });

  useEffect(() => {
    if (inView) {
      controls.start("visible");
    }
  }, [controls, inView]);

  const variants = {
    hidden: { opacity: 0, y: 50 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={controls}
      variants={variants}
      transition={{ duration: 0.5, ease: "easeOut" }}
      style={{
        width: "calc(50% - 20px)", // Responsive for 2x2 layout
        height: "900px",
        minWidth: "280px", // Minimum width for smaller screens
        marginBottom: "20px",
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
          backgroundColor: { backgroundColor },
        }}
      >
        <CardContent
          sx={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            paddingTop: "140px",
          }}
        >
          <Typography
            sx={{
              fontWeight: "bold",
              mb: 1,
              color: fontColor,
              fontSize: "30px",
            }}
          >
            {title}
          </Typography>
          <Typography
            sx={{
              mb: 2,
              fontWeight: "bold",
              fontSize: "40px",
              color: fontColor,
            }}
          >
            {description}
          </Typography>
          <Box>
            <Image
              src={imgSrc}
              alt={title}
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
  );
};

export default ClassCard;
