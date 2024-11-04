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
interface ReplayProps {
  open: boolean;
  onClose: () => void;
}

const Replay: React.FC<ReplayProps> = ({ open, onClose }) => {
  return (
    <Box
      onClose={onClose}
      sx={{
        pt: "2.5%", // Padding top to push content down slightly from the top
        width: { xs: "90%", sm: "80%", lg: "70%", xl: "50%" }, // width of the modal
      }}
    >
      {/* close modal button */}
      <IconButton
        onClick={onClose}
        sx={{ position: "absolute", top: 8, right: 8 }}
      >
        <CloseIcon />
      </IconButton>
      {/* First sentence */}
      <Typography sx={{ fontSize: "15px", fontWeight: "bold", mb: 2 }}>
        Dance Science and Health (daSH) Programmes
      </Typography>
      {/* Second sentence */}
      <Typography
        sx={{
          fontSize: { xs: "30px", sm: "40px" },
          fontWeight: "bold",
          mb: 2,
        }}
      >
        Re:play
      </Typography>
    </Box>
  );
};

export default Replay;
