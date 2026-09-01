import { Box, Typography } from "@mui/material";
import { motion } from "framer-motion";
import MarketplaceTabs from "./MarketplaceTabs";
import Marketplace from "./MarketPlace";
import { getListingsPage } from "@/lib/listingsQuery";
import { pageBackgroundSx } from "@/app/utils/pageBackground";
import { NAVBAR_HEIGHT } from "@/app/utils/navChrome";

// Matches MarketPlace.tsx's own PAGE_SIZE/DEFAULT_FILTERS — page 1 of the
// no-filter, no-search POKEMON view. Fetched here (server-side, at request
// time) so the first row of cards is already in the HTML the browser gets,
// instead of appearing only after the client bundle loads and fetches it.
const INITIAL_PAGE_SIZE = 24;

export default async function MarketplacePage() {
  const initial = await getListingsPage({
    forSale: true,
    game: "POKEMON",
    page: 1,
    pageSize: INITIAL_PAGE_SIZE,
  });

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
        <MarketplaceTabs />

        <Box sx={{ mt: 4 }}>
          {/* Page header */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <Box sx={{ mb: 4 }}>
              <Typography sx={{ fontSize: { xs: 22, md: 28 }, fontWeight: 800, lineHeight: 1.1, color: "#fff" }}>
                Marketplace
              </Typography>
              <Typography sx={{ fontSize: 13, color: "rgba(255,255,255,0.6)", mt: 0.25 }}>
                Browse and buy Pokémon cards listed by other collectors.
              </Typography>
            </Box>
          </motion.div>

          <Marketplace initialCards={initial.cards as any} initialHasMore={initial.hasMore ?? false} />
        </Box>
      </Box>
    </Box>
  );
}
