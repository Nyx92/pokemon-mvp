"use client";

import { Box, Button, Divider } from "@mui/material";
import { useRouter } from "next/navigation";

export interface DescriptionLabel {
  title?: string;
  button?: string;
  link: string;
}

interface DescriptionBarProps {
  labels: DescriptionLabel[];
}

export default function DescriptionBar({ labels }: DescriptionBarProps) {
  const router = useRouter();

  const hasLeftTitle = labels.length > 0 && !!labels[0].title?.trim();

  return (
    <>
      <Box sx={{ width: "100%", display: "flex", justifyContent: "center" }}>
        <Box
          sx={{
            backgroundColor: "#f5f5f7",
            height: "60px",
            width: { xs: "80%", lg: "55%" },
            display: "flex",
            alignItems: "center",
            justifyContent: hasLeftTitle ? "space-between" : "flex-end", // handle layout if no title
            px: 2,
          }}
        >
          {hasLeftTitle && (
            <Button
              onClick={() => router.push(labels[0].link)}
              sx={{
                textTransform: "none",
                color: "black",
                fontWeight: "bold",
                fontSize: { xs: "15px", lg: "20px" },
                letterSpacing: "-0.02em",
              }}
            >
              {labels[0].title}
            </Button>
          )}

          {/* Buttons on right */}
          <Box>
            {labels.slice(1).map((label, index) => (
              <Button
                key={index}
                onClick={() => router.push(label.link)}
                sx={{
                  textTransform: "none",
                  color: "#000",
                  fontSize: { xs: "12px", lg: "15px" },
                  letterSpacing: "-0.02em",
                }}
              >
                {label.button}
              </Button>
            ))}
          </Box>
        </Box>
      </Box>
      <Divider sx={{ width: "100%" }} />
    </>
  );
}
