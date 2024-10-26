"use client";
import { useEffect, useRef } from "react";
import { motion, useAnimation } from "framer-motion";
import { Box, Typography, Card, CardContent } from "@mui/material";
import Image from "next/image";
import { useInView } from "react-intersection-observer";

interface ClassCardProps {
  title: string;
  imgSrc: string;
  description: string;
  upcomingClasses: string;
  instructor: string;
  cost: string;
}

const ClassCard: React.FC<ClassCardProps> = ({
  title,
  imgSrc,
  description,
  upcomingClasses,
  instructor,
  cost,
}) => {
  // Animation controls
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

  // Animation variants
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
    >
      <Card
        sx={{
          margin: "20px 0",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 8px 16px rgba(0, 0, 0, 0.2)",
          borderRadius: "16px",
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
          <Typography variant="h5" sx={{ fontWeight: "bold", mb: 1 }}>
            {title}
          </Typography>
          <Typography variant="body1" color="textSecondary" sx={{ mb: 2 }}>
            {description}
          </Typography>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="textSecondary">
              <strong>Upcoming Classes:</strong> {upcomingClasses}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              <strong>Instructor:</strong> {instructor}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              <strong>Cost:</strong> {cost}
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default ClassCard;
