import { webLightTheme, webDarkTheme, createLightTheme, createDarkTheme } from '@fluentui/react-components';

const brandVariants = {
  system: null, // use default blue
  red: {
    10:'#fff1f1',20:'#fde0e0',30:'#fbc5c5',40:'#f7a0a0',50:'#f17070',60:'#e84545',70:'#d62828',80:'#b91c1c',90:'#991b1b',100:'#7f1d1d',110:'#6b1616',120:'#5a1212',130:'#4a0e0e',140:'#3b0a0a',150:'#2d0707',160:'#1f0404'
  },
  white: null,
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

export function getTheme(mode, accent) {
  const isDark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const base = isDark ? webDarkTheme : webLightTheme;
  const variants = brandVariants[accent];
  if (!variants || accent === 'system' || accent === 'white') {
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
