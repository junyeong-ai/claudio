import emojiData from 'emojibase-data/en/compact.json';
import iamcalShortcodes from 'emojibase-data/en/shortcodes/iamcal.json';

type ShortcodeMap = Record<string, string | string[]>;

const shortcodeToEmoji: Map<string, string> = new Map();

function initShortcodeMap() {
  if (shortcodeToEmoji.size > 0) return;

  const hexToEmoji = new Map<string, string>();
  for (const emoji of emojiData) {
    hexToEmoji.set(emoji.hexcode, emoji.unicode);
  }

  const shortcodes = iamcalShortcodes as ShortcodeMap;
  for (const [hexcode, codes] of Object.entries(shortcodes)) {
    const emoji = hexToEmoji.get(hexcode);
    if (!emoji) continue;

    const codeList = Array.isArray(codes) ? codes : [codes];
    for (const code of codeList) {
      shortcodeToEmoji.set(code, emoji);
    }
  }
}

export function getStandardEmoji(shortcode: string): string | null {
  initShortcodeMap();
  return shortcodeToEmoji.get(shortcode) ?? null;
}
