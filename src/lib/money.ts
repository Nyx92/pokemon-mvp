// lib/money.ts

/**
 * Converts a dollar amount (e.g. 19.99) into cents (e.g. 1999).
 *
 * WHY:
 * - All monetary values in the database are stored as integers (cents).
 * - This avoids floating point precision issues (e.g. 0.1 + 0.2 problems).
 * - Stripe and most payment systems also require amounts in cents.
 *
 * WHEN TO USE:
 * - Before saving user input into the database.
 * - Before sending amounts to Stripe as `unit_amount`.
 */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/**
 * Converts a cents amount (e.g. 1999) back into dollars (e.g. 19.99).
 *
 * WHY:
 * - The database stores prices in cents for accuracy.
 * - The UI needs prices in dollars for display.
 *
 * IMPORTANT:
 * - This returns a number (not a formatted string).
 * - Formatting (e.g. `.toFixed(2)` or Intl.NumberFormat)
 *   should be done at the UI layer.
 *
 * WHEN TO USE:
 * - When returning data from the API for frontend display.
 */
export function centsToDollars(cents: number): number {
  return cents / 100;
}
