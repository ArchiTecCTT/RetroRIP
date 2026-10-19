import { webLightTheme, webDarkTheme, createLightTheme, createDarkTheme } from '@fluentui/react-components';

const brandVariants = {
  red: {
    10:'#fff1f1',20:'#fde0e0',30:'#fbc5c5',40:'#f7a0a0',50:'#f17070',60:'#e84545',70:'#d62828',80:'#b91c1c',90:'#991b1b',100:'#7f1d1d',110:'#6b1616',120:'#5a1212',130:'#4a0e0e',140:'#3b0a0a',150:'#2d0707',160:'#1f0404'
  },
  pink: {
    10:'#fdf2f8',20:'#fce7f3',30:'#fbcfe8',40:'#f9a8d4',50:'#f472b6',60:'#ec4899',70:'#db2777',80:'#be185d',90:'#9d174d',100:'#831843',110:'#701a3d',120:'#5e1634',130:'#4c122b',140:'#3b0e22',150:'#2a0a19',160:'#1a0610'
  },
  matcha: {
    10:'#f0fdf4',20:'#dcfce7',30:'#bbf7d0',40:'#86efac',50:'#4ade80',60:'#22c55e',70:'#16a34a',80:'#15803d',90:'#166534',100:'#14532d',110:'#124726',120:'#0f3b1f',130:'#0c2f19',140:'#092413',150:'#06190d',160:'#040f08'
  },
  purple: {
    10:'#faf5ff',20:'#f3e8ff',30:'#e9d5ff',40:'#d8b4fe',50:'#c084fc',60:'#a855f7',70:'#9333ea',80:'#7e22ce',90:'#6b21a8',100:'#581c87',110:'#4c1a75',120:'#401763',130:'#341351',140:'#280f3f',150:'#1c0b2d',160:'#11071c'
  },
  blue: {
    10:'#eff6ff',20:'#dbeafe',30:'#bfdbfe',40:'#93c5fd',50:'#60a5fa',60:'#3b82f6',70:'#2563eb',80:'#1d4ed8',90:'#1e40af',100:'#1e3a8a',110:'#1e357a',120:'#1c2f6a',130:'#1a295a',140:'#17234a',150:'#141d3a',160:'#10172a'
  },
};

/* ---------- helpers to build a Fluent brand palette from one accent color ---------- */

function parseHex(hex) {
  if (typeof hex !== 'string') return null;
  const m = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(m)) return null;
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
}
function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
function hslToRgb([h, s, l]) {
  const f = (p, q, t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  return [f(p, q, h + 1 / 3) * 255, f(p, q, h) * 255, f(p, q, h - 1 / 3) * 255];
}
const toHex = (rgb) => '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, amt) => a.map((v, i) => v + (b[i] - v) * amt);
function luminance([r, g, b]) {
  const c = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contrast = (a, b) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};
const withLightness = (rgb, l) => { const [h, s] = rgbToHsl(rgb); return hslToRgb([h, s, Math.max(0.04, Math.min(0.96, l))]); };

// Builds the Fluent brand tokens for the Windows system accent, tuned per light/dark
// so primary buttons, selection tints and accent text stay readable in both modes.
function systemAccentTheme(base, isDark, hex) {
  const accent = parseHex(hex);
  if (!accent) return base;
  const [, , accL] = rgbToHsl(accent);
  let bg = accent;
  if (!isDark) {
    let l = Math.min(accL, 0.42);
    bg = withLightness(accent, l);
    while (contrast(bg, [255, 255, 255]) < 4.2 && l > 0.10) { l -= 0.03; bg = withLightness(accent, l); }
  } else {
    let l = Math.max(accL, 0.34);
    bg = withLightness(accent, l);
    while (contrast(bg, [255, 255, 255]) < 3.0 && l < 0.62) { l += 0.03; bg = withLightness(accent, l); }
  }
  const [, , bgL] = rgbToHsl(bg);
  const hover = withLightness(bg, isDark ? bgL + 0.07 : bgL - 0.06);
  const pressed = withLightness(bg, isDark ? bgL - 0.08 : bgL - 0.13);
  const selected = withLightness(bg, isDark ? bgL + 0.03 : bgL - 0.09);
  let fg = isDark ? withLightness(bg, Math.max(bgL, 0.60)) : bg;
  if (isDark) {
    let l = Math.max(bgL, 0.60);
    while (contrast(fg, [36, 36, 36]) < 4.2 && l < 0.88) { l += 0.03; fg = withLightness(bg, l); }
  }
  const onBrand = contrast(bg, [255, 255, 255]) >= contrast(bg, [17, 17, 17]) ? '#ffffff' : '#111111';
  const surface = isDark ? [20, 20, 20] : [255, 255, 255];
  const bg2 = mix(bg, surface, isDark ? 0.80 : 0.88);
  const tokensOut = {
    colorBrandBackground: toHex(bg),
    colorBrandBackgroundHover: toHex(hover),
    colorBrandBackgroundPressed: toHex(pressed),
    colorBrandBackgroundSelected: toHex(selected),
    colorBrandBackground2: toHex(bg2),
    colorBrandBackground2Hover: toHex(mix(bg, surface, isDark ? 0.72 : 0.82)),
    colorBrandBackground2Pressed: toHex(mix(bg, surface, isDark ? 0.64 : 0.76)),
    colorBrandForeground1: toHex(fg),
    colorBrandForeground2: toHex(isDark ? fg : hover),
    colorBrandForegroundInverted: toHex(isDark ? bg : fg),
    colorCompoundBrandBackground: toHex(bg),
    colorCompoundBrandBackgroundHover: toHex(hover),
    colorCompoundBrandBackgroundPressed: toHex(pressed),
    colorCompoundBrandForeground1: toHex(fg),
    colorCompoundBrandForeground1Hover: toHex(isDark ? fg : hover),
    colorCompoundBrandForeground1Pressed: toHex(pressed),
    colorBrandStroke1: toHex(fg),
    colorBrandStroke2: toHex(mix(bg, surface, isDark ? 0.55 : 0.65)),
    colorCompoundBrandStroke: toHex(fg),
    colorCompoundBrandStrokeHover: toHex(isDark ? fg : hover),
    colorCompoundBrandStrokePressed: toHex(pressed),
    colorNeutralForegroundOnBrand: onBrand,
  };
  return { ...base, ...tokensOut };
}

export function getTheme(mode, accent, systemAccent) {
  const isDark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const base = isDark ? webDarkTheme : webLightTheme;
  if (accent === 'system') {
    // Follow the actual Windows accent color (falls back to Fluent blue if unavailable).
    return systemAccentTheme(base, isDark, systemAccent);
  }
  const variants = brandVariants[accent];
  if (!variants || accent === 'white') {
    // white accent -> neutral grey brand
    if (accent === 'white') {
      const grey = { 10:'#fafafa',20:'#f5f5f5',30:'#e5e5e5',40:'#d4d4d4',50:'#a3a3a3',60:'#737373',70:'#525252',80:'#404040',90:'#262626',100:'#171717',110:'#141414',120:'#101010',130:'#0d0d0d',140:'#0a0a0a',150:'#070707',160:'#040404' };
      const t = isDark ? createDarkTheme(grey) : createLightTheme(grey);
      return t;
    }
    return base;
  }
  const t = isDark ? createDarkTheme(variants) : createLightTheme(variants);
  return t;
}
