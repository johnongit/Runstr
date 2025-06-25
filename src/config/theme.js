// RUNSTR Theme Configuration
// Centralized color constants for minimalistic black/white theming

export const THEME_COLORS = {
  // Primary black/white system
  primaryDark: '#000000',   // Pure black - maximum contrast
  primary: '#FFFFFF',       // Pure white - primary actions
  
  // Interactive states - Grayscale system
  accent: '#E0E0E0',        // Light gray (for active nav states)
  accentMed: '#A0A0A0',     // Medium gray (for buttons)
  accentDark: '#606060',    // Dark gray (for hover states)
  accentLight: '#F5F5F5',   // Very light gray (for light accents)
  
  // Existing theme colors (updated for black/white system)
  background: '#000000',    // Pure black background
  surface: '#1A1A1A',      // Dark gray card backgrounds  
  surfaceLight: '#2A2A2A', // Medium gray lighter cards
  text: '#FFFFFF',         // Pure white text
  textSecondary: '#E0E0E0', // Light gray secondary text
  textMuted: '#A0A0A0',     // Medium gray muted text
  
  // Status colors (keep existing)
  success: '#10b981',       // Emerald
  warning: '#f59e0b',       // Amber
  error: '#ef4444',         // Red
  
  // Transparent variants for overlays
  primaryAlpha: 'rgba(255, 255, 255, 0.1)',    // white with 10% opacity
  accentAlpha: 'rgba(224, 224, 224, 0.1)',     // light gray with 10% opacity
  accentMedAlpha: 'rgba(160, 160, 160, 0.2)',  // medium gray with 20% opacity
};

// Tailwind class mappings for black/white minimalistic design
export const THEME_CLASSES = {
  // Backgrounds
  bgPrimary: 'bg-black',
  bgAccent: 'bg-white', 
  bgAccentMed: 'bg-gray-800',
  bgAccentDark: 'bg-gray-900',
  
  // Text colors
  textPrimary: 'text-white',
  textAccent: 'text-black',
  textAccentMed: 'text-gray-300',
  
  // Focus states
  focusRing: 'focus:ring-white',
  focusBorder: 'focus:border-white',
  
  // Gradients
  gradientPrimary: 'bg-gradient-to-r from-black to-gray-900',
  gradientAccent: 'bg-gradient-to-r from-gray-800 to-gray-900',
};

export default THEME_COLORS; 