import { NextResponse } from "next/server";

const RAW_GRADES = [
  "Mint",
  "Near Mint",
  "Lightly Played",
  "Moderately Played",
  "Heavily Played",
  "Damaged",
] as const;

const RAW_GRADE_SET = new Set<string>(RAW_GRADES.map((g) => g.toLowerCase()));

function isGradedCondition(condition?: string | null) {
  console.log(condition);
  if (!condition) return false; // if unknown, treat as raw
  return !RAW_GRADE_SET.has(condition.toLowerCase());
}

export async function GET(
  req: Request,
  { params }: { params: { tcgId: string } }
) {
  const { tcgId } = params;
  const { searchParams } = new URL(req.url);

  // normalize language
  const rawLanguage = searchParams.get("language");
  const language = rawLanguage ? rawLanguage.toLowerCase() : "english";

  // NEW: infer graded from condition
  const condition = searchParams.get("condition");
  const graded = isGradedCondition(condition);
  console.log("graded true?");
  console.log(graded);

  if (!tcgId) {
    return NextResponse.json({ error: "Missing tcgPlayerId" }, { status: 400 });
  }

  const API_KEY = process.env.POKEMON_PRICE_TRACKER_KEY;

  try {
    const url = graded
      ? `https://www.pokemonpricetracker.com/api/v2/cards?tcgPlayerId=${tcgId}&language=${encodeURIComponent(
          language
        )}&includeHistory=true&includeEbay=true&days=365`
      : `https://www.pokemonpricetracker.com/api/v2/cards?tcgPlayerId=${tcgId}&language=${encodeURIComponent(
          language
        )}&includeHistory=true&days=365`;
    console.log(url);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${API_KEY}` },
      next: { revalidate: 3600 },
    });

    const data = await res.json();
    console.log(data);
    return NextResponse.json(data);
  } catch (err) {
    console.error("Market price fetch failed:", err);
    return NextResponse.json({ error: "API request failed" }, { status: 500 });
  }
}
