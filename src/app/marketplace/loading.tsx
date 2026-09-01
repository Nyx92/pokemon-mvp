"use client";

// src/app/marketplace/loading.tsx
//
// Shown automatically by Next.js (via Suspense) while page.tsx's async
// getListingsPage() call is in flight — replaces the old client-only
// PoroLoader spinner, which couldn't appear until the JS bundle had
// already loaded. Card-tile dimensions match CardListItem.tsx (280x220)
// so there's no layout shift when real cards replace these.
import { Box, Skeleton } from "@mui/material";
import { pageBackgroundSx } from "@/app/utils/pageBackground";
import { NAVBAR_HEIGHT } from "@/app/utils/navChrome";

const SKELETON_COUNT = 8;

export default function MarketplaceLoading() {
  return (
    <Box
      component="main"
      sx={{
        ...pageBackgroundSx("/collateral/Riftbound_BG_Market.jpg"),
        mt: `-${NAVBAR_HEIGHT}px`,
        pt: { xs: "88px", md: "112px" },
        minHeight: "100vh",
      }}
    >
      <Box sx={{ mt: 4, px: { xs: 2, md: 4 } }}>
        <Box sx={{ display: "flex", justifyContent: "center", mb: 4 }}>
          <Skeleton variant="rounded" width={200} height={40} sx={{ bgcolor: "rgba(255,255,255,0.12)" }} />
        </Box>

        <Box sx={{ mt: 4 }}>
          <Box sx={{ mb: 4 }}>
            <Skeleton variant="text" width={220} height={36} sx={{ bgcolor: "rgba(255,255,255,0.12)" }} />
            <Skeleton variant="text" width={340} height={20} sx={{ bgcolor: "rgba(255,255,255,0.08)" }} />
          </Box>

          <Box sx={{ display: "flex", flexWrap: "wrap", gap: "16px", justifyContent: "center" }}>
            {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
              <Skeleton
                key={i}
                variant="rounded"
                width={280}
                height={220}
                sx={{ bgcolor: "rgba(255,255,255,0.10)" }}
              />
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
