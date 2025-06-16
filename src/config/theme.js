// RUNSTR Theme Configuration
// Centralized color constants for consistent purple/black theming

export const THEME_COLORS = {
  // Primary purple gradient (from dashboard banner: bg-gradient-to-r from-indigo-800 to-purple-800)
  primaryDark: '#3730a3',    // indigo-800 (keeping as accent)
  primary: '#6b21a8',       // purple-800 (main purple)
  
  // Interactive states - Purple scale
  accent: '#c084fc',        // purple-400 (for active nav states)
  accentMed: '#9333ea',     // purple-600 (for buttons)
  accentDark: '#7c3aed',    // purple-700 (for hover states)
  accentLight: '#ddd6fe',   // purple-200 (for light accents)
  
  // Existing theme colors (maintain consistency)
  background: '#111827',    // Dark background
  surface: '#1a222e',      // Card backgrounds  
  surfaceLight: '#1a1f2b', // Lighter cards
  text: '#e2e8f0',         // Light text
  textSecondary: '#a5adcf', // Secondary text
  textMuted: '#64748b',     // Muted text
  
  // Status colors (keep existing)
  success: '#10b981',       // Emerald
  warning: '#f59e0b',       // Amber
  error: '#ef4444',         // Red
  
  // Transparent variants for overlays
  primaryAlpha: 'rgba(107, 33, 168, 0.1)',     // purple-800 with 10% opacity
  accentAlpha: 'rgba(192, 132, 252, 0.1)',     // purple-400 with 10% opacity
  accentMedAlpha: 'rgba(147, 51, 234, 0.2)',   // purple-600 with 20% opacity
};

// Tailwind class mappings for quick reference
export const THEME_CLASSES = {
  // Backgrounds
  bgPrimary: 'bg-purple-800',
  bgAccent: 'bg-purple-400', 
  bgAccentMed: 'bg-purple-600',
  bgAccentDark: 'bg-purple-700',
  
  // Text colors
  textPrimary: 'text-purple-800',
  textAccent: 'text-purple-400',
  textAccentMed: 'text-purple-600',
  
  // Focus states
  focusRing: 'focus:ring-purple-500',
  focusBorder: 'focus:border-purple-500',
  
  // Gradients
  gradientPrimary: 'bg-gradient-to-r from-indigo-800 to-purple-800',
  gradientAccent: 'bg-gradient-to-r from-purple-600 to-purple-700',
};

export default THEME_COLORS; 