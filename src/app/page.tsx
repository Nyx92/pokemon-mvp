"use client";

import React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Box, Tabs, Tab } from "@mui/material";
import HomeFeatured from "./home/HomeFeatured";
import Carousell from "./home/carousell/Carousell";
import CollectionsIcon from "@mui/icons-material/Collections";
import StorefrontIcon from "@mui/icons-material/Storefront";
import UploadIcon from "@mui/icons-material/Upload";
import { useAuth } from "@/app/hooks/useAuth";

export default function Home() {
  const pathname = usePathname();
  const { isLoggedIn, isAdmin } = useAuth();

  return (
    <main>
      {/* Hero Carousel */}
      <Carousell />

      {/* Tab Bar Section */}
      <Box sx={{ mt: 4, px: { xs: 2, md: 4 } }}>
        <Box sx={{ display: "flex", justifyContent: "center" }}>
          <Tabs
            value={pathname}
            textColor="primary"
            indicatorColor="primary"
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              "& .MuiTabs-flexContainer": {
                justifyContent: "center",
              },
              "& .MuiTab-root": {
                fontWeight: 600,
                fontSize: "1.05rem",
                letterSpacing: "0.5px",
                textTransform: "none",
                color: "#333",
                minHeight: 50,
              },
              "& .Mui-selected": { color: "black" },
              "& .MuiTabs-indicator": {
                backgroundColor: "black",
                height: 3,
                borderRadius: 2,
              },
            }}
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
    </main>
  );
}
