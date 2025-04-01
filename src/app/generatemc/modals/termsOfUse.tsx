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

// Define interface for props
interface TermsOfUseProps {
  open: boolean;
  onClose: () => void;
  onAcknowledge?: () => void; // Optional prop
  showAcknowledge?: boolean; // Prop to conditionally show the button
}

const TermsOfUse: React.FC<TermsOfUseProps> = ({
  open,
  onClose,
  onAcknowledge,
  showAcknowledge,
}) => {
  return (
    <Modal
      open={open}
      onClose={onClose}
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
      sx={{
        display: "flex",
        alignItems: "center", // Center modal vertically
        justifyContent: "center", // Center modal horizontally
        zIndex: 9999,
      }}
    >
      <Box
        sx={{
          position: "relative", // Relative for the box inside the modal
          width: { xs: "90%", sm: "80%", lg: "70%", xl: "50%" }, // width of the modal
          bgcolor: "background.paper",
          borderRadius: "16px", // Rounded corners
          boxShadow: 24,
          p: { xs: 2, md: 3, xl: 4 },
          outline: "none", // Ensures no outline on the Box element
        }}
      >
        {/* close modal button */}
        <IconButton
          onClick={onClose}
          sx={{ position: "absolute", top: 8, right: 8 }}
        >
          <CloseIcon />
        </IconButton>
        {/* Scrollable Content */}
        <Box
          sx={{
            overflowY: "auto", // Enables scrolling within this content box
            maxHeight: "90vh", // Adjusts inner content height to ensure it fits within the modal
            "&::-webkit-scrollbar": { display: "none" }, // Hides scrollbar in WebKit browsers
            scrollbarWidth: "none", // Hides scrollbar in Firefox
          }}
        >
          {/* First sentence */}
          <Typography
            sx={{
              display: "flex",
              fontSize: { xs: "20px", sm: "30px", md: "40px" },
              fontWeight: "bold",
              mb: 2,
              justifyContent: "center", // Add this line to center content horizontally
            }}
          >
            Terms of use
          </Typography>

          {/* First Card */}
          <Card sx={{ borderRadius: "8px", bgcolor: "grey.50", mb: 2 }}>
            <CardContent sx={{ padding: "0" }}>
              <Box
                sx={{
                  mx: "auto", // Sets both left and right margins to auto
                  width: { xs: "95%", xl: "70%" },
                  display: "flex",
                  fontWeight: "bold",
                  alignItems: "center",
                  justifyContent: "center", // Add this line to center content horizontally
                  mb: 5,
                  mt: 5,
                }}
              >
                <Typography
                  sx={{
                    fontSize: { xs: "15px", sm: "18px", md: "20px" },
                    fontWeight: "bold",
                    textAlign: "justify", // Justifies the text for alignment
                  }}
                >
                  <span style={{ color: "#6E6E73" }}>
                    {"  "}Welcome to SG.MC (the “Service”). By accessing or
                    using this Service, you agree to comply with and be bound by
                    these Terms of Use (“Terms”). Please read these Terms
                    carefully before using the Service. If you do not agree to
                    these Terms, you may not access or use the Service. By using
                    this Service, you acknowledge that you have read,
                    understood, and agreed to these Terms of Use. The creators
                    and operators of the Service expressly disclaim any
                    liability for actions taken by users that are contrary to
                    these Terms or the stated purpose of the Service.
                    <br></br>
                    <br></br>
                  </span>
                  1. Intended Use
                  <span style={{ color: "#6E6E73" }}>
                    <br></br>
                    <br></br>
                    The Service is created solely for entertainment, novelty,
                    and educational purposes. It is designed to allow users to
                    generate creative or humorous content, including fake
                    medical certificates (the “Generated Content”). The Service
                    is not intended for any real-world or official use and
                    should not be used to deceive, defraud, or mislead any
                    individual, organization, or entity.
                    <br></br>
                    <br></br>
                  </span>
                  2. Prohibited Uses
                  <span style={{ color: "#6E6E73" }}>
                    <br></br>
                    <br></br>
                    By using this Service, you agree not to: Use the Generated
                    Content for any unethical, unlawful, or fraudulent purposes,
                    including but not limited to: Misrepresenting health
                    conditions. Malingering or evading responsibilities (e.g.,
                    work, school, or legal obligations). Committing fraud or
                    causing harm to any individual or entity. Distribute, share,
                    or present Generated Content as legitimate or official
                    documentation. Use the Service in any way that violates
                    applicable local, national, or international laws or
                    regulations. Exploit the Service for purposes that could
                    damage the reputation of SG.MC or its operators.
                    <br></br>
                    <br></br>
                  </span>
                  3. Disclaimer of Liability
                  <span style={{ color: "#6E6E73" }}>
                    <br></br>
                    <br></br>
                    No Liability for Misuse: The creators and operators of the
                    Service shall not be held responsible or liable for any
                    consequences arising from the misuse of the Service or
                    Generated Content. By using the Service, you acknowledge and
                    accept full responsibility for how you use the Generated
                    Content.
                    <br></br>
                    <br></br>
                    Indemnification: You agree to indemnify and hold harmless
                    SG.MC, its creators, operators, employees, and affiliates
                    from and against any claims, damages, losses, liabilities,
                    costs, or expenses (including legal fees) resulting from
                    your use of the Service or Generated Content in violation of
                    these Terms.
                    <br></br>
                    <br></br>
                  </span>
                  {showAcknowledge && (
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Button
                        variant="contained"
                        onClick={() => {
                          if (onAcknowledge) onAcknowledge(); // Only call if defined
                          onClose(); // Close the modal
                        }}
                        sx={{
                          m: 1,
                          borderRadius: "30px",
                          textTransform: "none",
                          backgroundColor: "black",
                          fontSize: { xs: "12px", xl: "20px" },
                        }}
                      >
                        Acknowledge
                      </Button>
                    </Box>
                  )}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Modal>
  );
};

export default TermsOfUse;
