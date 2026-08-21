// src/lib/catalogLookupForm.ts
//
// Once GET /api/catalog/lookup reports a match, UploadCard.tsx hides the
// catalog-identity fields (title/setName/rarity/cardNumber/language/type/
// supertype) behind a read-only "Card found" summary. But whatever was last
// in those fields — usually nothing — is still what gets submitted, and
// POST/PUT /api/cards require title (and, for Riftbound, type/supertype)
// unconditionally, since the server has no way to know in advance whether a
// match exists. Relaxing that requirement server-side would let a
// genuinely-new catalog row be created with a blank title, so instead this
// backfills the matched catalog's real values into those hidden fields
// before they're ever submitted.

export interface CatalogMatch {
  title: string;
  setName: string | null;
  rarity: string | null;
  cardNumber: string | null;
  language?: string;
  type?: string;
  supertype?: string;
}

export interface CatalogIdentityFormFields {
  title: string;
  setName: string;
  rarity: string;
  cardNumber: string;
  language: string;
  type: string;
  supertype: string;
}

export function applyCatalogMatchToForm(catalog: CatalogMatch): CatalogIdentityFormFields {
  return {
    title: catalog.title,
    setName: catalog.setName ?? "",
    rarity: catalog.rarity ?? "",
    cardNumber: catalog.cardNumber ?? "",
    language: catalog.language ?? "",
    type: catalog.type ?? "",
    supertype: catalog.supertype ?? "",
  };
}

// Spread in when a lookup starts or comes back not-found, so a stale match
// from a previously-typed tcgPlayerId doesn't linger in now-visible,
// editable fields for a different card.
export const BLANK_CATALOG_IDENTITY_FIELDS: CatalogIdentityFormFields = {
  title: "",
  setName: "",
  rarity: "",
  cardNumber: "",
  language: "",
  type: "",
  supertype: "",
};
