"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/app/hooks/useAuth";
import { Box, Tab, Tabs } from "@mui/material";
import CollectionsIcon from "@mui/icons-material/Collections";
import GavelIcon from "@mui/icons-material/Gavel";
import StorefrontIcon from "@mui/icons-material/Storefront";
import UploadIcon from "@mui/icons-material/Upload";
import { frostedTabsSx } from "@/app/utils/navChrome";

export default function MarketplaceTabs() {
  const pathname = usePathname();
  const { isLoggedIn, isAdmin } = useAuth();

  return (
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
  );
}
