"use client";

import React, { useState } from "react";
import { Box, Tabs, Tab, Typography } from "@mui/material";
import MyCollection from "./home/myCollection/MyCollection";
import Marketplace from "./home/marketPlace/MarketPlace";
import Carousell from "./home/carousell/Carousell";
import CollectionsIcon from "@mui/icons-material/Collections";
import StorefrontIcon from "@mui/icons-material/Storefront";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import UploadIcon from "@mui/icons-material/Upload";
import { useSession } from "next-auth/react";
import UploadCard from "./home/uploadCard/UploadCard";

function Community() {
  return (
    <Box sx={{ py: 4 }}>
      <Typography textAlign="center" variant="h6" color="text.secondary">
        Community collections coming soon...
      </Typography>
    </Box>
  );
}

export default function Home() {
  // ✅ use string identifiers instead of numeric indexes
  const [tab, setTab] = useState("marketplace");
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user;
  const isAdmin = session?.user && (session.user as any).role === "admin";

  const handleTabChange = (_: React.SyntheticEvent, newValue: string) => {
    setTab(newValue);
  };

  // ✅ Much cleaner: no ternary logic required
  const renderContent = () => {
    switch (tab) {
      case "collection":
        return isLoggedIn ? <MyCollection /> : <LoginPrompt />;
      case "marketplace":
        return <Marketplace />;
      case "community":
        return <Community />;
      case "upload":
        return isLoggedIn ? <UploadCard /> : <LoginPrompt />;
      default:
        return <Marketplace />;
    }
  };

  // Small helper for unauthenticated users
  function LoginPrompt() {
    return (
      <Box sx={{ py: 4 }}>
        <Typography textAlign="center" variant="h6" color="text.secondary">
          Please log in to view this section.
        </Typography>
      </Box>
    );
  }

  return (
    <main>
      {/* 🧭 Hero Carousel */}
      <Carousell />

      {/* 🧭 Tab Bar Section */}
      <Box sx={{ mt: 4, px: { xs: 2, md: 4 } }}>
        <Box sx={{ display: "flex", justifyContent: "center" }}>
          <Tabs
            value={tab}
            onChange={handleTabChange}
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
                icon={<CollectionsIcon />}
                label="My Collection"
                iconPosition="start"
                value="collection"
              />
            )}
            <Tab
              icon={<StorefrontIcon />}
              label="Marketplace"
              iconPosition="start"
              value="marketplace"
            />
            <Tab
              icon={<PeopleAltIcon />}
              label="Community"
              iconPosition="start"
              value="community"
            />
            {isAdmin && (
              <Tab
                icon={<UploadIcon />}
                label="Upload Card"
                iconPosition="start"
                value="upload"
              />
            )}
          </Tabs>
        </Box>

        {/* Tab Content */}
        <Box sx={{ mt: 4 }}>{renderContent()}</Box>
      </Box>
    </main>
  );
}
