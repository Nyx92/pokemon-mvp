"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Box } from "@mui/material";

const FRAMES = [
  { src: "/collateral/loading_1.png", width: 80, height: 75 },
  { src: "/collateral/loading_2.png", width: 108, height: 59 },
  { src: "/collateral/loading_3.png", width: 80, height: 79 },
];
const FRAME_DURATION_MS = 150;

export default function PoroLoader() {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    FRAMES.forEach(({ src }) => {
      const preload = new window.Image();
      preload.src = src;
    });
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setFrame((f) => (f + 1) % FRAMES.length);
    }, FRAME_DURATION_MS);
    return () => clearInterval(id);
  }, []);

  const { src, width, height } = FRAMES[frame];

  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{ display: "flex", justifyContent: "center", alignItems: "flex-end", height: 80 }}
    >
      <Image src={src} alt="" width={width} height={height} style={{ objectFit: "contain" }} />
      <Box
        component="span"
        sx={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}
      >
        Loading…
      </Box>
    </Box>
  );
}
