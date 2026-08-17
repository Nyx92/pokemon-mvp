// src/lib/listingCatalog.ts
//
// Enforces the one rule a Postgres foreign key can't express by itself: a
// Listing must reference exactly one catalog row, and it must be the one
// matching `game`. This project manages its schema via `prisma db push`
// (no migration history), so a database CHECK constraint isn't practically
// available here — this rule lives in application code instead, called
// from every place a Listing is created or updated with new catalog refs.

export type ListingGame = "POKEMON" | "RIFTBOUND";

export interface ListingCatalogRefs {
  game: ListingGame;
  pokemonCardId?: string | null;
  riftboundCardId?: string | null;
}

export function assertValidListingCatalogRefs(refs: ListingCatalogRefs): void {
  const hasPokemon = refs.pokemonCardId != null;
  const hasRiftbound = refs.riftboundCardId != null;

  if (hasPokemon && hasRiftbound) {
    throw new Error(
      "A listing cannot reference both a Pokémon and a Riftbound catalog card."
    );
  }
  if (!hasPokemon && !hasRiftbound) {
    throw new Error("A listing must reference exactly one catalog card.");
  }
  if (refs.game === "POKEMON" && !hasPokemon) {
    throw new Error(
      'A listing with game "POKEMON" must reference a PokemonCardCatalog row, but riftboundCardId was set instead.'
    );
  }
  if (refs.game === "RIFTBOUND" && !hasRiftbound) {
    throw new Error(
      'A listing with game "RIFTBOUND" must reference a RiftboundCardCatalog row, but pokemonCardId was set instead.'
    );
  }
  if (refs.game !== "POKEMON" && refs.game !== "RIFTBOUND") {
    throw new Error(`Unknown listing game: "${refs.game}".`);
  }
}
