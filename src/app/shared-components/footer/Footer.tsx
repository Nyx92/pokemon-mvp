"use client";
import {
  Box,
  Container,
  Link,
  Typography,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { forwardRef, useState } from "react";
import "./Footer.css"; // Import your CSS file for media queries
import TermsOfUse from "../../generatemc/modals/termsOfUse";

// Define the type for FooterLink props
interface FooterLinkProps {
  href: string;
  title: string;
}

// Define the type for FooterColumn props
interface FooterColumnProps {
  columnGroups: {
    title: string;
    items: string[];
  }[];
}

// Define a union type for program names
type FooterNames = "TermsOfUse";

const FooterLink = ({ href, title }: FooterLinkProps) => (
  <Link
    href={href}
    variant="body2"
    color="text.secondary"
    underline="hover"
    sx={{ display: "block", mb: 0.5 }}
  >
    {title}
  </Link>
);

const FooterColumn = ({ columnGroups }: FooterColumnProps) => {
  return (
    <>
      {/* For mobile view */}
      <Box className="mobile-only" sx={{ width: "100%" }}>
        {columnGroups.map((group, index) => (
          <Accordion key={index}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1">{group.title}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              {group.items.map((item, itemIndex) => (
                <FooterLink key={itemIndex} href="#" title={item} />
              ))}
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>

      {/* For desktop view */}
      <Box
        className="desktop-only"
        sx={{
          flex: "1",
          minWidth: 0,
          maxWidth: "100%",
          padding: "0 16px",
        }}
      >
        {columnGroups.map((group, index) => (
          <Box key={index} sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              {group.title}
            </Typography>
            {group.items.map((item, itemIndex) => (
              <FooterLink key={itemIndex} href="#" title={item} />
            ))}
          </Box>
        ))}
      </Box>
    </>
  );
};

// Define the props for Footer component
interface FooterProps {
  ref?: React.Ref<HTMLDivElement>;
}

// Convert Footer component to TSX with forwardRef
const Footer = forwardRef<HTMLDivElement, FooterProps>((props, ref) => {
  // state to track the name of the currently active modal
  const [activeModalName, setActiveModalName] = useState<FooterNames | "">("");
  const [openModal, setOpenModal] = useState<boolean>(false);

  // Create an object that maps button names to modal components
  const modalComponentMap: Record<
    FooterNames,
    React.FC<{ open: boolean; onClose: () => void }>
  > = {
    TermsOfUse,
  };

  const renderModal = () => {
    if (!activeModalName || !openModal) return null;
    // based on current activeModalName - i.e., the button which was clicked
    const ModalComponent = modalComponentMap[activeModalName as FooterNames];
    if (!ModalComponent) return null; // In case there is no matching modal component

    return <ModalComponent open={openModal} onClose={handleCloseModal} />;
  };

  const handleOpenModal = (modalName: FooterNames) => {
    setActiveModalName(modalName);
    setOpenModal(true);
  };

  const handleCloseModal = () => {
    setOpenModal(false);
  };
  const footerColumns = [
    // add as required
    {
      columnGroups: [
        // {
        //   title: "Programmes",
        //   items: ["daSH", "dancED"],
        // },
      ],
    },
    // {
    //   columnGroups: [
    //     {
    //       title: "Classes",
    //       items: [
    //         "Mat Pilates",
    //         "Fun-size movers",
    //         "Creative Contemporary Dance",
    //         "daSH residency",
    //       ],
    //     },
    //   ],
    // },
  ];

  return (
    <Box
      component="footer"
      ref={ref}
      id="footer"
      sx={{ backgroundColor: "#f5f5f7", py: 4 }}
    >
      <Container maxWidth="lg">
        {/* <Divider sx={{ my: 4 }} /> */}
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            rowGap: 2,
          }}
        >
          {footerColumns.map((column, index) => (
            <FooterColumn key={index} columnGroups={column.columnGroups} />
          ))}
        </Box>
        <Typography
          variant="body2"
          color="text.secondary"
          align="left"
          sx={{ mt: 2 }}
        >
          Need to contact us?{" "}
          <Link href="#" color="inherit" underline="hover">
            Click here to Email us!
          </Link>{" "}
        </Typography>
        <Divider sx={{ my: 1 }} />
        <Box
          display="flex"
          justifyContent="left"
          alignItems="center"
          flexWrap="wrap"
        >
          <Typography variant="body2" color="text.secondary" align="left">
            Copyright © 2025 PLACEHOLDER Inc. All rights reserved.
          </Typography>
          <Box sx={{ mx: { xs: 1, sm: 2 } }}>|</Box>
          <Link
            onClick={() => handleOpenModal("TermsOfUse")}
            color="inherit"
            underline="hover"
            fontSize={{ xs: 10, md: 15 }}
            sx={{
              cursor: "pointer", // Add pointer cursor on hover
            }}
          >
            Terms of Use
          </Link>
          <Box sx={{ mx: { xs: 1, sm: 2 } }}>|</Box>
        </Box>
      </Container>
      {renderModal()};
    </Box>
  );
});

Footer.displayName = "Footer";

export default Footer;
