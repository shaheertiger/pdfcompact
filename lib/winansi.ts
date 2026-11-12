/**
 * pdf-lib's standard 14 fonts (Helvetica, Times, Courier) can only draw
 * characters in the WinAnsi (Windows-1252) character set. This maps common
 * look-alikes to safe characters and replaces the rest with "?", counting how
 * many were lost so the tool can warn about it.
 */

const EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";

const MAP: Record<string, string> = {
  "−": "-", // minus sign
  "‐": "-",
  "‑": "-",
  "‒": "-",
  "―": "—",
  "′": "'",
  "″": '"',
  "‵": "'",
  "‛": "'",
  "‟": '"',
  "‹": "‹",
  "⁄": "/",
  "←": "<-",
  "→": "->",
  "↔": "<->",
  "⇒": "=>",
  "≤": "<=",
  "≥": ">=",
  "≠": "!=",
  "≈": "~",
  "∞": "oo",
  "•": "•",
  "‣": "•",
  "●": "•",
  "▪": "•",
  "■": "•",
  "⁃": "-",
  "∙": "·",
  "‧": "·",
  "✓": "v",
  "✔": "v",
  "✗": "x",
  "✘": "x",
  "☐": "[ ]",
  "☑": "[x]",
  "☒": "[x]",
  "ﬀ": "ff",
  "ﬁ": "fi",
  "ﬂ": "fl",
  "ﬃ": "ffi",
  "ﬄ": "ffl",
  "Œ": "Œ",
  " ": " ",
  " ": " ",
  " ": " ",
  " ": " ",
  " ": " ",
  " ": " ",
  " ": " ",
  " ": " ",
  " ": " ",
  " ": " ",
  " ": " ",
  " ": " ",
  " ": " ",
  "　": " ",
  " ": " ",
  " ": " ",
  "\t": " ",
  "­": "",
  "​": "",
  "‌": "",
  "‍": "",
  "⁠": "",
  "﻿": "",
  "₽": "RUB",
  "₹": "Rs",
  "₩": "W",
  "₪": "ILS",
  "₺": "TL",
  "ı": "i",
  "Ł": "L",
  "ł": "l",
  "Đ": "D",
  "đ": "d",
  "ß": "ß",
};

export function isWinAnsi(ch: string): boolean {
  const c = ch.charCodeAt(0);
  if (ch.length !== 1) return false;
  if (c >= 0x20 && c <= 0x7e) return true;
  if (c >= 0xa0 && c <= 0xff) return true;
  return EXTRA.includes(ch);
}

export type Sanitizer = { clean: (s: string) => string; replaced: () => number; samples: () => string[] };

/** Create a sanitizer that remembers how many characters it had to drop. */
export function createSanitizer(): Sanitizer {
  let count = 0;
  const seen = new Set<string>();
  const cache = new Map<string, string>();
  const one = (ch: string): string => {
    const hit = cache.get(ch);
    if (hit !== undefined) {
      if (hit === "?") count++;
      return hit;
    }
    let out: string;
    if (isWinAnsi(ch)) out = ch;
    else if (ch in MAP) out = MAP[ch];
    else {
      // Accented letters outside WinAnsi (ā, ő, ș): drop the accent.
      const base = ch.normalize("NFKD").replace(/[̀-ͯ]/g, "");
      out = base && [...base].every(isWinAnsi) ? base : "?";
    }
    cache.set(ch, out);
    if (out === "?") {
      count++;
      if (seen.size < 8) seen.add(ch);
    }
    return out;
  };
  return {
    clean: (s: string) => {
      let r = "";
      for (const ch of s.replace(/\r\n?/g, "\n")) r += ch === "\n" ? "\n" : one(ch);
      return r;
    },
    replaced: () => count,
    samples: () => [...seen],
  };
}
