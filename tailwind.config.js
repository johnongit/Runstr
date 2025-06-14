/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      /* Design System Colors */
      colors: {
        // Core colors mapped to CSS variables
        background: 'var(--color-background)',
        surface: {
          DEFAULT: 'var(--color-surface)',
          elevated: 'var(--color-surface-elevated)',
        },
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          tertiary: 'var(--color-text-tertiary)',
        },
        interactive: {
          DEFAULT: 'var(--color-interactive)',
          hover: 'var(--color-interactive-hover)',
          active: 'var(--color-interactive-active)',
          disabled: 'var(--color-interactive-disabled)',
        },
        border: {
          DEFAULT: 'var(--color-border)',
          hover: 'var(--color-border-hover)',
          active: 'var(--color-border-active)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          subtle: 'var(--color-accent-subtle)',
          hover: 'var(--color-accent-hover)',
        },
        // System colors
        success: {
          DEFAULT: 'var(--color-success)',
          subtle: 'var(--color-success-subtle)',
        },
        error: {
          DEFAULT: 'var(--color-error)',
          subtle: 'var(--color-error-subtle)',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          subtle: 'var(--color-warning-subtle)',
        },
        info: {
          DEFAULT: 'var(--color-info)',
          subtle: 'var(--color-info-subtle)',
        },
        
        // Backwards compatibility mappings
        primary: 'var(--primary-color)',
        secondary: 'var(--secondary-color)',
        
        // Legacy color mappings
        foreground: 'var(--color-text-primary)',
        card: {
          DEFAULT: 'var(--color-surface)',
          foreground: 'var(--color-text-primary)'
        },
        popover: {
          DEFAULT: 'var(--color-surface-elevated)',
          foreground: 'var(--color-text-primary)'
        },
        muted: {
          DEFAULT: 'var(--color-surface)',
          foreground: 'var(--color-text-secondary)'
        },
        destructive: {
          DEFAULT: 'var(--color-error)',
          foreground: 'var(--color-background)'
        },
        input: 'var(--color-surface)',
        ring: 'var(--color-border-active)',
      },
      
      /* Typography */
      fontFamily: {
        primary: 'var(--font-family-primary)',
        sans: 'var(--font-family-primary)',
      },
      fontSize: {
        xs: 'var(--font-size-xs)',
        sm: 'var(--font-size-sm)',
        base: 'var(--font-size-base)',
        lg: 'var(--font-size-lg)',
        xl: 'var(--font-size-xl)',
        '2xl': 'var(--font-size-2xl)',
        '3xl': 'var(--font-size-3xl)',
        '4xl': 'var(--font-size-4xl)',
      },
      
      /* Spacing */
      spacing: {
        0: 'var(--space-0)',
        1: 'var(--space-1)',
        2: 'var(--space-2)',
        3: 'var(--space-3)',
        4: 'var(--space-4)',
        5: 'var(--space-5)',
        6: 'var(--space-6)',
        8: 'var(--space-8)',
        10: 'var(--space-10)',
        12: 'var(--space-12)',
        16: 'var(--space-16)',
      },
      
      /* Border Radius */
      borderRadius: {
        none: 'var(--radius-none)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        full: 'var(--radius-full)',
      },
      
      /* Shadows */
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
      },
      
      /* Animation */
      transitionDuration: {
        fast: 'var(--timing-fast)',
        normal: 'var(--timing-normal)',
        slow: 'var(--timing-slow)',
      },
      
      transitionTimingFunction: {
        'ease-out': 'var(--easing-ease-out)',
        'ease-in-out': 'var(--easing-ease-in-out)',
      }
    }
  },
  plugins: [require("tailwindcss-animate")],
} 