import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: { tcgId: string } }
) {
  const { tcgId } = params;
  const { searchParams } = new URL(req.url);
  const graded = searchParams.get("graded") === "true";

  if (!tcgId) {
    return NextResponse.json({ error: "Missing tcgPlayerId" }, { status: 400 });
  }

  const API_KEY = process.env.POKEMON_PRICE_TRACKER_KEY; // add to env

  try {
    const url = graded
      ? `https://www.pokemonpricetracker.com/api/v2/cards?tcgPlayerId=${tcgId}&includeEbay=true&includeHistory=true&days=365`
      : `https://www.pokemonpricetracker.com/api/v2/cards?tcgPlayerId=${tcgId}&includeHistory=true&days=365`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${API_KEY}` },
      next: { revalidate: 3600 }, // cache 1hr
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Market price fetch failed:", err);
    return NextResponse.json({ error: "API request failed" }, { status: 500 });
  }
}
