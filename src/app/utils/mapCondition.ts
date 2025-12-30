// src/utils/mapCondition.ts

export type ConditionMapping =
  | { type: "graded"; grade: string } // e.g. "10", "9"
  | { type: "raw"; key: string }; // e.g. "Near Mint", "Lightly Played"

export function mapConditionToAPI(condition: string): ConditionMapping {
  const c = condition.toLowerCase();

  // Graded cards (PSA…)
  if (c.includes("psa")) {
    return {
      type: "graded",
      grade: c.replace("psa", "").trim(), // "10", "9", "8.5"
    };
  }

  if (c.includes("near") || c.includes("nm")) {
    return { type: "raw", key: "Near Mint" };
  }
  if (c.includes("light") || c.includes("lp")) {
    return { type: "raw", key: "Lightly Played" };
  }
  if (c.includes("moderate") || c.includes("mp")) {
    return { type: "raw", key: "Moderately Played" };
  }
  if (c.includes("heavy") || c.includes("hp")) {
    return { type: "raw", key: "Heavily Played" };
  }
  if (c.includes("damaged") || c.includes("poor")) {
    return { type: "raw", key: "Damaged" };
  }

  // Default fallback
  return { type: "raw", key: "Near Mint" };
}
