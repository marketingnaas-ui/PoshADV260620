export type ThemeType = 'teal' | 'midnight' | 'emerald' | 'sunset';

export interface ThemePalette {
  primary: string;
  primaryHover: string;
  primaryLight: string;
  primary10: string;
  soft: string;
  border: string;
  shadow: string;
  shadowMedium: string;
}

export const THEME_PALETTES: Record<ThemeType, ThemePalette> = {
  teal: {
    primary: '#4E958D',
    primaryHover: '#3d7a73',
    primaryLight: '#6bada6',
    primary10: '#e8f5f4',
    soft: '#F4FBFA',
    border: '#E2F0EF',
    shadow: '0 1px 12px rgba(78, 149, 141, 0.07)',
    shadowMedium: '0 4px 22px rgba(78, 149, 141, 0.13)',
  },
  midnight: {
    primary: '#2563EB',
    primaryHover: '#1D4ED8',
    primaryLight: '#3B82F6',
    primary10: '#EFF6FF',
    soft: '#F0F5FF',
    border: '#DBEAFE',
    shadow: '0 1px 12px rgba(37, 99, 235, 0.07)',
    shadowMedium: '0 4px 22px rgba(37, 99, 235, 0.13)',
  },
  emerald: {
    primary: '#10B981',
    primaryHover: '#059669',
    primaryLight: '#34D399',
    primary10: '#ECFDF5',
    soft: '#F0FDF4',
    border: '#D1FAE5',
    shadow: '0 1px 12px rgba(16, 185, 129, 0.07)',
    shadowMedium: '0 4px 22px rgba(16, 185, 129, 0.13)',
  },
  sunset: {
    primary: '#F97316',
    primaryHover: '#EA580C',
    primaryLight: '#FB923C',
    primary10: '#FFF7ED',
    soft: '#FFF8F2',
    border: '#FFEDD5',
    shadow: '0 1px 12px rgba(249, 115, 22, 0.07)',
    shadowMedium: '0 4px 22px rgba(249, 115, 22, 0.13)',
  }
};

export function applyTheme(themeName: ThemeType) {
  const palette = THEME_PALETTES[themeName] || THEME_PALETTES.teal;
  
  if (typeof document !== 'undefined' && document.documentElement) {
    const root = document.documentElement;
    root.style.setProperty('--p', palette.primary);
    root.style.setProperty('--ph', palette.primaryHover);
    root.style.setProperty('--pl', palette.primaryLight);
    root.style.setProperty('--p10', palette.primary10);
    root.style.setProperty('--soft', palette.soft);
    root.style.setProperty('--bdr', palette.border);
    root.style.setProperty('--sh', palette.shadow);
    root.style.setProperty('--shm', palette.shadowMedium);
    
    // Save to local storage for persistence across reloads
    localStorage.setItem('advance_active_theme_name', themeName);
  }
}

export function getSavedTheme(): ThemeType {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('advance_active_theme_name');
    if (saved === 'teal' || saved === 'midnight' || saved === 'emerald' || saved === 'sunset') {
      return saved as ThemeType;
    }
  }
  return 'teal';
}
