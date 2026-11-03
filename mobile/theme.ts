export const COLORS = {
  primary: '#0066A4',
  dark: '#073B68',
  deep: '#082D50',
  light: '#EAF5FC',
  accent: '#27C5F5',
  background: '#F7F9FC',
  surface: '#FFFFFF',
  text: '#142B45',
  muted: '#64748B',
  border: '#DFE7EF',
  success: '#16A36A',
  alert: '#E9A23B',
  error: '#D94848',
  overlay: 'rgba(8, 45, 80, 0.36)',
} as const

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const

export const RADIUS = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  pill: 999,
} as const

export const SHADOW = {
  card: {
    shadowColor: COLORS.deep,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  hero: {
    shadowColor: COLORS.deep,
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  nav: {
    shadowColor: COLORS.deep,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10,
  },
} as const
