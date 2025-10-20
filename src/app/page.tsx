"use client";

import React, { useState } from "react";
import { Box, Tabs, Tab, Typography } from "@mui/material";
import MyCollection from "./home/myCollection/MyCollection";
import Carousell from "./home/Carousell/Carousell";
import CollectionsIcon from "@mui/icons-material/Collections";
import StorefrontIcon from "@mui/icons-material/Storefront";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";

// Placeholder components for the other tabs (we’ll replace these later)
function Marketplace() {
  return (
    <Box sx={{ py: 4 }}>
      <Typography textAlign="center" variant="h6" color="text.secondary">
        Marketplace coming soon...
      </Typography>
    </Box>
  );
}

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
  const [tab, setTab] = useState(0);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTab(newValue);
  };

  const renderContent = () => {
    switch (tab) {
      case 0:
        return <MyCollection />; // Your collection
      case 1:
        return <Marketplace />;
      case 2:
        return <Community />;
      default:
        return <MyCollection />;
    }
  };

  return (
    <main>
      {/* 🧭 Hero Carousel at the top */}
      <Carousell />

      {/* 🧭 Tab Bar Section */}
      <Box sx={{ mt: 4, px: { xs: 2, md: 4 } }}>
        {/* Tabs for navigation */}
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
                justifyContent: "center", // ensures equal centering inside the Tabs container
              },
              "& .MuiTab-root": {
                fontWeight: 600,
                fontSize: "1.05rem",
                letterSpacing: "0.5px",
                textTransform: "none",
                color: "#333",
                minHeight: 50,
              },
              "& .Mui-selected": {
                color: "black",
              },
              "& .MuiTabs-indicator": {
                backgroundColor: "black",
                height: 3,
                borderRadius: 2,
              },
            }}
          >
            <Tab
              icon={<CollectionsIcon />}
              label="My Collection"
              iconPosition="start"
            />
            <Tab
              icon={<StorefrontIcon />}
              label="Marketplace"
              iconPosition="start"
            />
            <Tab
              icon={<PeopleAltIcon />}
              label="Community"
              iconPosition="start"
            />
          </Tabs>
        </Box>

        {/* Tab Content */}
        <Box sx={{ mt: 4 }}>{renderContent()}</Box>
      </Box>
    </main>
  );
}
