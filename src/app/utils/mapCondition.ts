// src/utils/mapCondition.ts

export type ConditionMapping =
  | { type: "graded"; grade: string } // e.g. "10", "9"
  | { type: "raw"; key: string }; // e.g. "Near Mint", "Lightly Played"

// Any of these substrings identifies a graded (not raw) card. Kept in sync
// with the grading companies in src/constants/grades.ts.
const GRADING_COMPANY_MARKERS = ["psa", "cgc", "sgc", "beckett"];

export function mapConditionToAPI(condition: string): ConditionMapping {
  const c = condition.toLowerCase();

  // Graded cards (PSA, CGC, SGC, Beckett…)
  const gradingCompany = GRADING_COMPANY_MARKERS.find((marker) => c.includes(marker));
  if (gradingCompany) {
    return {
      type: "graded",
      grade: gradingCompany === "psa" ? c.replace("psa", "").trim() : c, // "10", "9", "8.5" for PSA; full string for others
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
