import Marketplace from "./MarketPlace";
import MarketplacePageShell from "./MarketplacePageShell";
import { getListingsPage } from "@/lib/listingsQuery";

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
    <MarketplacePageShell>
      <Marketplace initialCards={initial.cards} initialHasMore={initial.hasMore ?? false} />
    </MarketplacePageShell>
  );
}
