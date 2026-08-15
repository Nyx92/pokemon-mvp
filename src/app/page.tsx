"use client";

import React from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Box, Tabs, Tab } from "@mui/material";
import { motion } from "framer-motion";
import HomeFeatured from "./home/HomeFeatured";
import Carousell from "./home/carousell/Carousell";
import DuckReveal from "./home/DuckReveal";
import { pageBackgroundSx } from "@/app/utils/pageBackground";
import { NAVBAR_HEIGHT, frostedTabsSx } from "@/app/utils/navChrome";
import CollectionsIcon from "@mui/icons-material/Collections";
import StorefrontIcon from "@mui/icons-material/Storefront";
import GavelIcon from "@mui/icons-material/Gavel";
import UploadIcon from "@mui/icons-material/Upload";
import { useAuth } from "@/app/hooks/useAuth";

export default function Home() {
  const pathname = usePathname();
  const { isLoggedIn, isAdmin } = useAuth();

  return (
    <Box
      component="main"
      sx={{
        ...pageBackgroundSx("/collateral/Riftbound_BG.jpg"),
        mt: `-${NAVBAR_HEIGHT}px`,
        pt: `${NAVBAR_HEIGHT}px`,
        minHeight: "100vh",
      }}
    >
      {/* Hero Carousel */}
      <Box sx={{ position: "relative" }}>
        <Carousell />

        {/* Decorative poro perched on the top-left corner, overlapping the card */}
        <Box
          sx={{
            position: "absolute",
            top: { xs: 2, md: 0 },
            left: "50%",
            transform: {
              xs: "translateX(calc(-50% - 140px)) rotate(-4deg)",
              md: "translateX(calc(-50% - 280px)) rotate(-4deg)",
            },
            width: { xs: 44, md: 66 },
            height: "auto",
            zIndex: 2,
            pointerEvents: "none",
            filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.4))",
          }}
        >
          <Image
            src="/collateral/poro-happy.png"
            alt=""
            width={491}
            height={348}
            style={{ width: "100%", height: "auto" }}
          />
        </Box>

        {/* Decorative poro lying on the bottom-right corner of the card */}
        <Box
          sx={{
            position: "absolute",
            bottom: { xs: 6, md: 26 },
            left: "50%",
            transform: {
              xs: "translateX(calc(-50% - 130px)) rotate(5deg)",
              md: "translateX(calc(-50% - 260px)) rotate(5deg)",
            },
            width: { xs: 53, md: 78 },
            height: "auto",
            zIndex: 2,
            pointerEvents: "none",
            filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.4))",
          }}
        >
          <Image
            src="/collateral/poro-sleepy.png"
            alt=""
            width={558}
            height={307}
            style={{ width: "100%", height: "auto" }}
          />
        </Box>

        {/* Decorative poro hanging off the bottom-left corner of the card */}
        <Box
          sx={{
            position: "absolute",
            bottom: { xs: -14, md: -38 },
            left: "50%",
            transform: {
              xs: "translateX(calc(-50% + 195px)) rotate(-6deg)",
              md: "translateX(calc(-50% + 390px)) rotate(-6deg)",
            },
            width: { xs: 41, md: 58 },
            height: "auto",
            zIndex: 2,
            pointerEvents: "none",
            filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.4))",
          }}
        >
          <Image
            src="/collateral/poro-hanging.png"
            alt=""
            width={384}
            height={509}
            style={{ width: "100%", height: "auto" }}
          />
        </Box>
      </Box>

      {/* Tab Bar Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut", delay: 0.15 }}
      >
        <Box sx={{ mt: 4, px: { xs: 2, md: 4 } }}>
          <Box sx={{ display: "flex", justifyContent: "center" }}>
            <Tabs
              value={pathname}
              textColor="primary"
              indicatorColor="primary"
              variant="scrollable"
              scrollButtons="auto"
              sx={frostedTabsSx}
            >
              {isLoggedIn && (
                <Tab
                  component={Link}
                  href="/myCollection"
                  icon={<CollectionsIcon />}
                  label="My Collection"
                  iconPosition="start"
                  value="/myCollection"
                />
              )}
              <Tab
                component={Link}
                href="/marketplace"
                icon={<StorefrontIcon />}
                label="Marketplace"
                iconPosition="start"
                value="/marketplace"
              />
              <Tab
                component={Link}
                href="/auctions"
                icon={<GavelIcon />}
                label="Auctions"
                iconPosition="start"
                value="/auctions"
              />
              {isAdmin && (
                <Tab
                  component={Link}
                  href="/upload"
                  icon={<UploadIcon />}
                  label="Upload Card"
                  iconPosition="start"
                  value="/upload"
                />
              )}
            </Tabs>
          </Box>

          {/* Content */}
          <Box sx={{ mt: 4 }}>
            <HomeFeatured />
          </Box>
        </Box>
      </motion.div>
      <DuckReveal />
    </Box>
  );
}
