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
interface PilatesProps {
  open: boolean;
  onClose: () => void;
}

const Pilates: React.FC<PilatesProps> = ({ onClose }) => {
  return (
    <Box
      onClose={onClose}
      sx={{
        width: "100%",
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <IconButton sx={{ position: "absolute", top: 8, right: 8 }}>
          <CloseIcon />
        </IconButton>
        <Typography sx={{ fontSize: "15px", fontWeight: "bold", mb: 2 }}>
          Key Pillars two
        </Typography>
        <Typography
          sx={{
            fontSize: { xs: "30px", sm: "40px" },
            fontWeight: "bold",
            mb: 2,
          }}
        >
          test test
        </Typography>
      </Box>
    </Box>
  );
};

export default Pilates;
