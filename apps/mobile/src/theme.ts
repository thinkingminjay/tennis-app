import { useColorScheme } from 'react-native';

// docs/DESIGN.md: bright and clean, one orange accent for 접수중, blue for 안내중, grey for closed
// states, dark mode.
// Screens sit on a light grey `page` with white `card` groups (pattern from Korean booking and
// settings screens on uibowl); `surface` is the subtle fill used inside a card.
const light = {
  page: '#F2F4F6',
  card: '#FFFFFF',
  bg: '#FFFFFF',
  surface: '#F5F6F4',
  border: '#E3E5E1',
  text: '#16181A',
  sub: '#6B7075',
  faint: '#9AA0A6',
  accent: '#EF6C00',
  accentSoft: '#FFF0E3',
  onAccent: '#FFFFFF',
  soon: '#2F6BCC',
  soonSoft: '#E6EEFB',
  off: '#8A8F94',
  offSoft: '#EEEFEE',
  danger: '#C0392B',
};

const dark: typeof light = {
  page: '#0F1112',
  card: '#1A1D1F',
  bg: '#0F1112',
  surface: '#25292C',
  border: '#2A2E31',
  text: '#F1F3F4',
  sub: '#A3A9AE',
  faint: '#6F767C',
  accent: '#FF8F3D',
  accentSoft: '#3A2312',
  onAccent: '#1A0C02',
  soon: '#7AA8F0',
  soonSoft: '#172540',
  off: '#8E959A',
  offSoft: '#23272A',
  danger: '#F06A5B',
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}
