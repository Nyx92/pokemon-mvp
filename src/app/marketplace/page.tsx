import Marketplace from "./MarketPlace";
import MarketplacePageShell from "./MarketplacePageShell";
import { getListingsPage } from "@/lib/listingsQuery";

// Card data must reflect the live DB on every visit; do not let this route
// be statically prerendered (MarketPlace.tsx skips its own client fetch on
// the default view, so a build-time snapshot would freeze the grid
// permanently with no runtime symptom). This route is currently dynamic
// anyway because the root layout calls getServerSession (which reads
// cookies), but that's incidental to page.tsx and could change — this
// makes the requirement explicit and independent of that layout behavior.
export const dynamic = "force-dynamic";

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
