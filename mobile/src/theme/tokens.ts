import { Appearance } from 'react-native';

/**
 * Same design tokens as web/src/styles/tokens.css, ported to RN
 * StyleSheet-friendly JS values. Kept in sync by hand — if the two drift,
 * treat the web tokens as the source (they carry the design rationale).
 */
const light = {
  paper: '#F7F5FB',
  surface: '#FFFFFF',
  ink: '#17132C',
  inkSoft: '#443E63',
  muted: '#6B6582',
  line: '#E4E0F0',
  lineStrong: '#D2CBE8',

  primary: '#4A3A9C',
  primaryDark: '#372B78',
  primarySoft: '#EDEAFA',

  protected: '#1B8A5C',
  protectedSoft: '#E3F5EC',

  amber: '#C97E1F',
  amberSoft: '#FCEFDA',

  alert: '#B8452E',
  alertSoft: '#FBE9E4',
};

const dark = {
  paper: '#151228',
  surface: '#1D1936',
  ink: '#F1EEFA',
  inkSoft: '#C7C0E0',
  muted: '#9992BE',
  line: '#312A54',
  lineStrong: '#453B72',

  primary: '#8879E8',
  primaryDark: '#A79BF0',
  primarySoft: '#241F44',

  protected: '#4FCB92',
  protectedSoft: '#153427',

  amber: '#E9AE5C',
  amberSoft: '#3A2B10',

  alert: '#E17A63',
  alertSoft: '#3A2018',
};

export function useTokens() {
  const scheme = Appearance.getColorScheme();
  return scheme === 'dark' ? dark : light;
}

export const radius = { sm: 6, md: 10, lg: 16 };
