"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/app/hooks/useAuth";
import MyCollection from "./MyCollection";
import { Box, Tab, Tabs, Typography } from "@mui/material";
import { motion } from "framer-motion";
import CollectionsIcon from "@mui/icons-material/Collections";
import GavelIcon from "@mui/icons-material/Gavel";
import StorefrontIcon from "@mui/icons-material/Storefront";
import UploadIcon from "@mui/icons-material/Upload";

export default function CollectionPage() {
  const pathname = usePathname();
  const { isLoggedIn, isAdmin } = useAuth();

  return (
    <main>
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

        <Box sx={{ mt: 4 }}>
          {/* Page header */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <Box sx={{ mb: 4 }}>
              <Typography sx={{ fontSize: { xs: 22, md: 28 }, fontWeight: 800, lineHeight: 1.1 }}>
                My Collection
              </Typography>
              <Typography sx={{ fontSize: 13, color: "#6b7280", mt: 0.25 }}>
                Browse and manage your Pokémon card collection.
              </Typography>
            </Box>
          </motion.div>

          {isLoggedIn ? (
            <MyCollection />
          ) : (
            <Typography textAlign="center" variant="h6" color="text.secondary">
              Please log in to view this section.
            </Typography>
          )}
        </Box>
      </Box>
    </main>
  );
}
