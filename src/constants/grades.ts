// NOTE: `as const` tells TypeScript to treat this array as read-only
// and to keep each value as a literal type instead of just `string`.
// Example: ["PSA 10", "PSA 9"] becomes the strict union
// type "PSA 10" | "PSA 9"
// This gives better autocomplete + prevents invalid values,
// but it is optional and not required for normal JS usage.
export const PSA_GRADES = [
  "PSA 10",
  "PSA 9",
  "PSA 8",
  "PSA 7",
  "PSA 6",
  "PSA 5",
  "PSA 4",
  "PSA 3",
  "PSA 2",
  "PSA 1",
] as const;

export const RAW_GRADES = [
  "Mint",
  "Near Mint",
  "Good",
  "Fair",
  "Poor",
] as const;

export const BECKETT_GRADES = [
  "Beckett 10 Black Label",
  "Beckett 10 Pristine",
  "Beckett 9.5 Gem Mint",
  "Beckett 9 Mint",
  "Beckett 8.5 NM-MT+",
  "Beckett 8 NM-MT",
  "Beckett 7.5 NM+",
  "Beckett 7 NM",
  "Beckett 6.5 EX-MT+",
  "Beckett 6 EX-MT",
] as const;

export const CGC_GRADES = [
  "CGC 10 Pristine",
  "CGC 9.5 Gem Mint",
  "CGC 9 Mint",
  "CGC 8.5 NM-MT+",
  "CGC 8 NM-MT",
  "CGC 7.5 NM+",
  "CGC 7 NM",
] as const;

export const SGC_GRADES = [
  "SGC 10 Pristine",
  "SGC 9.5 Gem Mint",
  "SGC 9 Mint",
  "SGC 8.5 NM-MT+",
  "SGC 8 NM-MT",
  "SGC 7.5 NM+",
  "SGC 7 NM",
] as const;

// Optional TS helper types
export type RawGrade = (typeof RAW_GRADES)[number];
export type PsaGrade = (typeof PSA_GRADES)[number];
export type BeckettGrade = (typeof BECKETT_GRADES)[number];
export type CgcGrade = (typeof CGC_GRADES)[number];
export type SgcGrade = (typeof SGC_GRADES)[number];
