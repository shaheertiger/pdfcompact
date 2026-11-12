/**
 * Rough password strength: estimated entropy from length and character
 * classes, with heavy penalties for common passwords and repeats. A hint,
 * not a guarantee.
 */
const common = [
  "password", "123456", "12345678", "qwerty", "111111", "abc123", "letmein", "welcome", "admin", "iloveyou",
  "monkey", "dragon", "football", "baseball", "sunshine", "princess", "000000", "123123", "passw0rd", "secret",
];

export type Strength = { score: 0 | 1 | 2 | 3; label: string; hint: string; bits: number };

export function passwordStrength(pw: string): Strength {
  if (!pw) return { score: 0, label: "", hint: "", bits: 0 };
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/[0-9]/.test(pw)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(pw)) pool += 33;
  const unique = new Set(pw).size;
  // Repeated characters add little: count length as somewhere between unique and full length.
  const effLen = Math.min(pw.length, unique + (pw.length - unique) * 0.3);
  let bits = effLen * Math.log2(Math.max(pool, 2));
  const lower = pw.toLowerCase();
  if (common.some((c) => lower.includes(c))) bits = Math.min(bits, 15);
  if (/^\d+$/.test(pw)) bits = Math.min(bits, pw.length * 3.32);
  if (/^(19|20)\d{2}[01]\d[0-3]\d$|^[0-3]\d[01]\d(19|20)\d{2}$/.test(pw)) bits = Math.min(bits, 15); // dates

  if (pw.length < 6 || bits < 28)
    return { score: 0, label: "Weak", hint: "Easy to guess. Use 12+ characters or a few random words.", bits };
  if (bits < 45) return { score: 1, label: "Fair", hint: "OK for casual use. Longer is much safer.", bits };
  if (bits < 64) return { score: 2, label: "Good", hint: "Hard to guess for most attackers.", bits };
  return { score: 3, label: "Strong", hint: "Very hard to crack.", bits };
}
