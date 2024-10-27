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
}

const ClassCard: React.FC<ClassCardProps> = ({
  title,
  imgSrc,
  description,
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
        height: "800px",
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
          backgroundColor: "black",
        }}
      >
        <Image
          src={imgSrc}
          alt={title}
          width={500}
          height={300}
          style={{
            borderRadius: "16px 16px 0 0",
            objectFit: "cover",
            width: "100%",
          }}
        />
        <CardContent>
          <Typography
            variant="h5"
            sx={{ fontWeight: "bold", mb: 1, color: "white" }}
          >
            {title}
          </Typography>
          <Typography variant="body1" sx={{ mb: 2, color: "white" }}>
            {description}
          </Typography>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default ClassCard;
