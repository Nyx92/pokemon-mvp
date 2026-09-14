// src/lib/phone.ts
//
// Phone numbers are stored as E.164 (a leading "+" then digits, no spaces
// or separators) — the format both Twilio and AWS SNS require for the "to"
// address (see src/lib/sms.ts).
//
// react-phone-input-2 (used at signup and in profile editing — see
// EditProfilePage.tsx) returns its value as digits only, with the calling
// code already concatenated onto the national number (e.g. "6591234567"
// for Singapore's +65 91234567). E.164 for that value is just a leading
// "+" away, so normalizing is a one-line prepend rather than needing to
// know where the calling code ends.

const E164_REGEX = /^\+[1-9]\d{7,14}$/;

/** Strips everything but digits, then prepends "+". */
export function normalizePhoneNumber(raw: string): string {
  return `+${raw.replace(/\D/g, "")}`;
}

export function isValidE164(phoneNumber: string): boolean {
  return E164_REGEX.test(phoneNumber);
}
