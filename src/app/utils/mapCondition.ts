// src/app/utils/mapCondition.ts
//
// Turns a Listing's free-text `condition` string into the canonical price
// variant label used as PriceHistory.variant: "RAW" for any ungraded
// condition, or "<COMPANY> <GRADE>" (e.g. "PSA 10", "CGC 9.5") for a graded
// one. Both the refresh job (writing prices) and the chart (reading them)
// go through this so they always agree on the same label for the same card.

const GRADE_PATTERN = /^(PSA|CGC|SGC|Beckett)\s+(\d+(?:\.\d+)?)/i;

export function toPriceVariantLabel(condition: string): string {
  const match = condition.trim().match(GRADE_PATTERN);
  if (!match) return "RAW";
  const [, company, grade] = match;
  return `${company.toUpperCase()} ${grade}`;
}
