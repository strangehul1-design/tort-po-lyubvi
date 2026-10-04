import {loadFont} from '@remotion/fonts';
import russoCyr from '@fontsource/russo-one/files/russo-one-cyrillic-400-normal.woff2';
import russoLat from '@fontsource/russo-one/files/russo-one-latin-400-normal.woff2';
import montCyr500 from '@fontsource/montserrat/files/montserrat-cyrillic-500-normal.woff2';
import montLat500 from '@fontsource/montserrat/files/montserrat-latin-500-normal.woff2';
import montCyr700 from '@fontsource/montserrat/files/montserrat-cyrillic-700-normal.woff2';
import montLat700 from '@fontsource/montserrat/files/montserrat-latin-700-normal.woff2';

// Шрифты лежат в node_modules, интернет при рендере не нужен.
const CYR = 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116';
const LAT =
  'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+20BD, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';

export const DISPLAY_FONT = 'Russo One';
export const BODY_FONT = 'Montserrat';

loadFont({family: DISPLAY_FONT, url: russoCyr, weight: '400', unicodeRange: CYR});
loadFont({family: DISPLAY_FONT, url: russoLat, weight: '400', unicodeRange: LAT});
loadFont({family: BODY_FONT, url: montCyr500, weight: '500', unicodeRange: CYR});
loadFont({family: BODY_FONT, url: montLat500, weight: '500', unicodeRange: LAT});
loadFont({family: BODY_FONT, url: montCyr700, weight: '700', unicodeRange: CYR});
loadFont({family: BODY_FONT, url: montLat700, weight: '700', unicodeRange: LAT});

/**
 * Размер заголовка, чтобы самое длинное слово влезло в ширину.
 * Russo One в верхнем регистре — примерно 0.78 em на букву.
 */
export const fitTitleSize = (text: string, maxWidth: number, base: number) => {
  const longest = Math.max(1, ...text.split(/\s+/).map((w) => w.length));
  return Math.min(base, maxWidth / (longest * 0.78));
};
