/**
 * Fütüristik ve tutarlı UI stilleri için yardımcı değişkenler ve fonksiyonlar
 */

// Ana renk paleti
export const colors = {
  // Ana renkler
  primary: '#1E90FF',          // Canlı mavi
  secondary: '#7F00FF',        // Mor
  accent: '#00FFFF',           // Siber mavi
  
  // Arka plan renkleri
  background: {
    dark: '#000000',           // Saf siyah
    darker: '#0A0A0A',         // Biraz daha açık siyah
    darkGray: '#121212',       // Koyu gri
    card: '#1A1A1A',           // Kart arka planı
  },
  
  // Metin renkleri
  text: {
    primary: '#FFFFFF',        // Beyaz
    secondary: '#B0B0B0',      // Gri
    accent: '#00FFFF',         // Siber mavi
    disabled: '#505050',       // Devre dışı metin
  },
  
  // Durum renkleri
  status: {
    success: '#00FF9F',        // Neon yeşil
    warning: '#FFD700',        // Altın sarısı
    error: '#FF3E3E',          // Parlak kırmızı
    info: '#1E90FF',           // Bilgi mavisi
  },
  
  // Gradient için renkler
  gradient: {
    bluePurple: ['#1E90FF', '#7F00FF'],    // Mavi-mor geçişi
    cyanBlue: ['#00FFFF', '#1E90FF'],      // Camgöbeği-mavi
    purplePink: ['#7F00FF', '#FF00FF'],    // Mor-pembe
    blueGreen: ['#1E90FF', '#00FF9F'],     // Mavi-yeşil
  }
};

// Standart kenar yuvarlaklıkları
export const borderRadius = {
  small: '4px',
  medium: '8px',
  large: '12px',
  rounded: '50%',
};

// Gölgeler
export const shadows = {
  small: '0 2px 8px rgba(0, 0, 0, 0.15)',
  medium: '0 4px 12px rgba(0, 0, 0, 0.2)',
  large: '0 8px 24px rgba(0, 0, 0, 0.3)',
  glow: (color: string) => `0 0 15px ${color}, 0 0 30px ${color}40`,
  neon: (color: string) => `0 0 5px ${color}, 0 0 20px ${color}80, 0 0 40px ${color}40`,
};

// Geçişler
export const transitions = {
  fast: '0.15s ease',
  normal: '0.3s ease',
  slow: '0.5s ease',
};

// Metin stilleri
export const typography = {
  fontFamily: '"Exo 2", "Roboto", sans-serif',
  heading: {
    h1: { fontSize: '2.5rem', fontWeight: 700 },
    h2: { fontSize: '2rem', fontWeight: 600 },
    h3: { fontSize: '1.5rem', fontWeight: 600 },
    h4: { fontSize: '1.25rem', fontWeight: 500 },
  },
  body: {
    regular: { fontSize: '1rem', fontWeight: 400 },
    small: { fontSize: '0.875rem', fontWeight: 400 },
    tiny: { fontSize: '0.75rem', fontWeight: 400 },
  },
};

// Yaygın gradient stilleri
export const gradients = {
  // Dikeyden yataya gradientler
  primary: `linear-gradient(135deg, ${colors.gradient.bluePurple[0]}, ${colors.gradient.bluePurple[1]})`,
  accent: `linear-gradient(135deg, ${colors.gradient.cyanBlue[0]}, ${colors.gradient.cyanBlue[1]})`,
  success: `linear-gradient(135deg, ${colors.status.success}, ${colors.gradient.blueGreen[1]})`,
  warning: `linear-gradient(135deg, ${colors.status.warning}, ${colors.gradient.purplePink[1]})`,
  error: `linear-gradient(135deg, ${colors.status.error}, ${colors.gradient.purplePink[1]})`,
  
  // Kart arka planı için
  cardBg: `linear-gradient(180deg, ${colors.background.card}, ${colors.background.darker})`,
  
  // Progress bar için
  progressBar: `linear-gradient(90deg, ${colors.accent}, ${colors.primary})`,
};

// Button stilleri
export const buttonStyles = {
  primary: {
    background: gradients.primary,
    color: colors.text.primary,
    border: 'none',
    borderRadius: borderRadius.medium,
    padding: '10px 20px',
    fontWeight: 500,
    transition: transitions.normal,
    boxShadow: shadows.glow(colors.primary),
    hover: {
      boxShadow: shadows.neon(colors.primary),
      transform: 'translateY(-2px)',
    }
  },
  secondary: {
    background: 'transparent',
    color: colors.text.primary,
    border: `1px solid ${colors.primary}`,
    borderRadius: borderRadius.medium,
    padding: '10px 20px',
    fontWeight: 500,
    transition: transitions.normal,
    hover: {
      background: `${colors.primary}20`,
      boxShadow: shadows.glow(colors.primary),
    }
  },
  accent: {
    background: gradients.accent,
    color: colors.text.primary,
    border: 'none',
    borderRadius: borderRadius.medium,
    padding: '10px 20px',
    fontWeight: 500,
    transition: transitions.normal,
    boxShadow: shadows.small,
    hover: {
      boxShadow: shadows.neon(colors.accent),
      transform: 'translateY(-2px)',
    }
  },
};

// Kart stilleri
export const cardStyles = {
  default: {
    background: colors.background.card,
    borderRadius: borderRadius.medium,
    padding: '20px',
    boxShadow: shadows.medium,
  },
  gradient: {
    background: gradients.cardBg,
    borderRadius: borderRadius.medium,
    padding: '20px',
    boxShadow: shadows.medium,
    border: `1px solid ${colors.primary}30`,
  },
  glowing: {
    background: colors.background.card,
    borderRadius: borderRadius.medium,
    padding: '20px',
    boxShadow: shadows.glow(colors.primary),
    border: `1px solid ${colors.primary}50`,
  },
};

// İlerleme çubukları
export const progressBarStyles = {
  container: {
    background: `${colors.background.darkGray}`,
    borderRadius: borderRadius.small,
    border: `1px solid ${colors.primary}30`,
    padding: '3px',
    height: '12px',
  },
  bar: {
    background: gradients.progressBar,
    borderRadius: borderRadius.small,
    transition: transitions.normal,
  },
  thin: {
    container: {
      height: '6px',
      padding: '1px',
    }
  }
}; 