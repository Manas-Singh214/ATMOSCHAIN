import { createContext, useContext, useState, useEffect } from 'react';

const ThemeCtx = createContext(null);

/* ────────────────────────────────────────────────────────────────
   Color palettes — all inline-style values live here so one
   toggle automatically re-renders every component.
   ──────────────────────────────────────────────────────────────── */
export const DARK = {
  /* Background layers */
  bg:            '#000a0d',
  bgPanel:       'rgba(0, 8, 16, 0.94)',
  bgCard:        'rgba(0, 20, 32, 0.92)',
  bgCardHover:   'rgba(0, 30, 46, 0.95)',
  bgInput:       'rgba(0, 8, 14, 0.9)',
  bgDropzone:    'rgba(0, 10, 16, 0.75)',
  bgTabActive:   'rgba(0,229,255,0.12)',
  bgInfoBox:     'rgba(255,109,0,0.05)',
  bgSuccessBox:  'rgba(0,230,118,0.06)',

  /* Text */
  textPrimary:   '#e4f0f2',
  textSecondary: '#7aaab5',
  textMuted:     'rgba(0,229,255,0.45)',
  textBody:      'rgba(200,225,230,0.7)',

  /* Accents */
  cyan:          '#00e5ff',
  cyanDim:       '#00b8cc',
  cyanBorder:    'rgba(0,229,255,0.18)',
  cyanBorderBright: 'rgba(0,229,255,0.4)',
  cyanBg:        'rgba(0,229,255,0.06)',
  cyanGlow:      '0 0 18px rgba(0,229,255,0.4)',
  green:         '#00e676',
  greenBorder:   'rgba(0,230,118,0.22)',
  greenBg:       'rgba(0,230,118,0.07)',
  orange:        '#ff7043',
  orangeBorder:  'rgba(255,112,67,0.22)',
  orangeBg:      'rgba(255,112,67,0.06)',
  red:           '#ff4569',
  purple:        'rgba(180,130,255,0.9)',

  /* Borders */
  border:        'rgba(0,229,255,0.14)',
  divider:       'rgba(0,229,255,0.1)',

  /* Navbar */
  navBg:         'rgba(0, 5, 10, 0.94)',
  navBorder:     'rgba(0,229,255,0.12)',
  navLink:       'rgba(0,229,255,0.5)',
  navLinkActive: '#000',
  navActiveBtn:  '#00e5ff',

  /* Badges */
  badgeCyanBg:   'rgba(0,229,255,0.08)',
  badgeGreenBg:  'rgba(0,230,118,0.08)',
  badgeRedBg:    'rgba(255,69,105,0.08)',

  /* Renderer */
  clearColor:    '#000a0d',
  planetColor:   0xff6622,
  planetInner:   0x110600,
  planetInnerEmissive: 0x1a0800,
  ringColor:     0x00e5ff,
  ring2Color:    0x00cccc,
  starColor:     0xffffff,
  debrisColors:  [0x00e5ff, 0xff6622, 0x4455aa],
  gridColor1:    0x003333,
  gridColor2:    0x001a1a,
  gridOpacity:   0.3,
  ambientColor:  0x111122,
  ambientInt:    1.0,
  lightColor1:   0x00e5ff,
  lightColor2:   0xff6600,
};

export const LIGHT = {
  /* Background layers */
  bg:            '#e8f3f8',
  bgPanel:       'rgba(255, 255, 255, 0.95)',
  bgCard:        'rgba(255, 255, 255, 0.98)',
  bgCardHover:   'rgba(240, 250, 255, 1.0)',
  bgInput:       'rgba(245, 250, 255, 0.98)',
  bgDropzone:    'rgba(235, 246, 252, 0.8)',
  bgTabActive:   'rgba(0,90,180,0.1)',
  bgInfoBox:     'rgba(180,80,0,0.05)',
  bgSuccessBox:  'rgba(0,120,70,0.05)',

  /* Text */
  textPrimary:   '#0a1a2e',
  textSecondary: '#1e4060',
  textMuted:     'rgba(0,60,120,0.55)',
  textBody:      'rgba(20,50,80,0.75)',

  /* Accents */
  cyan:          '#005faa',
  cyanDim:       '#0048880',
  cyanBorder:    'rgba(0,95,170,0.22)',
  cyanBorderBright: 'rgba(0,95,170,0.45)',
  cyanBg:        'rgba(0,95,170,0.06)',
  cyanGlow:      '0 0 18px rgba(0,95,170,0.25)',
  green:         '#006e3c',
  greenBorder:   'rgba(0,110,60,0.22)',
  greenBg:       'rgba(0,110,60,0.06)',
  orange:        '#b84500',
  orangeBorder:  'rgba(184,69,0,0.22)',
  orangeBg:      'rgba(184,69,0,0.05)',
  red:           '#b81c2e',
  purple:        '#5f3da8',

  /* Borders */
  border:        'rgba(0,95,170,0.16)',
  divider:       'rgba(0,95,170,0.12)',

  /* Navbar */
  navBg:         'rgba(255, 255, 255, 0.97)',
  navBorder:     'rgba(0,95,170,0.15)',
  navLink:       'rgba(0,60,120,0.55)',
  navLinkActive: '#ffffff',
  navActiveBtn:  '#005faa',

  /* Badges */
  badgeCyanBg:   'rgba(0,95,170,0.08)',
  badgeGreenBg:  'rgba(0,110,60,0.08)',
  badgeRedBg:    'rgba(184,28,46,0.08)',

  /* Renderer */
  clearColor:    '#c8e0ee',
  planetColor:   0x1155cc,
  planetInner:   0xa8d4ee,
  planetInnerEmissive: 0x3388cc,
  ringColor:     0x004499,
  ring2Color:    0x2266bb,
  starColor:     0x0033aa,
  debrisColors:  [0x0055cc, 0x3399cc, 0x2244aa],
  gridColor1:    0x6699bb,
  gridColor2:    0x88aacc,
  gridOpacity:   0.2,
  ambientColor:  0xaabbcc,
  ambientInt:    1.5,
  lightColor1:   0x4488ff,
  lightColor2:   0x3399cc,
};

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    try { return localStorage.getItem('ac-theme') !== 'light'; } catch { return true; }
  });

  const toggle = () => setIsDark(v => {
    const next = !v;
    try { localStorage.setItem('ac-theme', next ? 'dark' : 'light'); } catch {}
    return next;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    // Also update body background for instant visual feedback
    document.body.style.background = isDark ? DARK.bg : LIGHT.bg;
  }, [isDark]);

  const colors = isDark ? DARK : LIGHT;

  return (
    <ThemeCtx.Provider value={{ isDark, toggle, colors }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export const useTheme = () => useContext(ThemeCtx);
