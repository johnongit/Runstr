/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
  	extend: {
  		/* RUNSTR Design System Integration */
  		colors: {
  			/* Core Backgrounds */
  			'bg-primary': 'var(--bg-primary)',
  			'bg-secondary': 'var(--bg-secondary)',
  			'bg-tertiary': 'var(--bg-tertiary)',
  			
  			/* Text Colors */
  			'text-primary': 'var(--text-primary)',
  			'text-secondary': 'var(--text-secondary)',
  			'text-muted': 'var(--text-muted)',
  			'text-inverse': 'var(--text-inverse)',
  			
  			/* Brand Colors */
  			'primary': {
  				DEFAULT: 'var(--primary)',
  				hover: 'var(--primary-hover)',
  				light: 'var(--primary-light)'
  			},
  			'secondary': {
  				DEFAULT: 'var(--secondary)',
  				hover: 'var(--secondary-hover)'
  			},
  			
  			/* Status Colors */
  			'success': {
  				DEFAULT: 'var(--success)',
  				light: 'var(--success-light)'
  			},
  			'warning': {
  				DEFAULT: 'var(--warning)',
  				light: 'var(--warning-light)'
  			},
  			'error': {
  				DEFAULT: 'var(--error)',
  				light: 'var(--error-light)'
  			},
  			'info': {
  				DEFAULT: 'var(--info)',
  				light: 'var(--info-light)'
  			},
  			
  			/* Bitcoin Colors */
  			'bitcoin': {
  				DEFAULT: 'var(--bitcoin)',
  				light: 'var(--bitcoin-light)'
  			},
  			
  			/* Border Colors */
  			'border-primary': 'var(--border-primary)',
  			'border-secondary': 'var(--border-secondary)',
  			'border-focus': 'var(--border-focus)',
  			
  			/* Legacy Support for existing components */
  			background: 'var(--bg-primary)',
  			foreground: 'var(--text-primary)',
  			card: {
  				DEFAULT: 'var(--bg-secondary)',
  				foreground: 'var(--text-primary)'
  			},
  			popover: {
  				DEFAULT: 'var(--bg-tertiary)',
  				foreground: 'var(--text-primary)'
  			},
  			muted: {
  				DEFAULT: 'var(--bg-tertiary)',
  				foreground: 'var(--text-muted)'
  			},
  			accent: {
  				DEFAULT: 'var(--primary-light)',
  				foreground: 'var(--primary)'
  			},
  			destructive: {
  				DEFAULT: 'var(--error)',
  				foreground: 'var(--text-primary)'
  			},
  			border: 'var(--border-secondary)',
  			input: 'var(--bg-tertiary)',
  			ring: 'var(--border-focus)',
  			chart: {
  				'1': 'var(--primary)',
  				'2': 'var(--secondary)',
  				'3': 'var(--success)',
  				'4': 'var(--warning)',
  				'5': 'var(--error)'
  			}
  		},
  		
  		/* Spacing Scale */
  		spacing: {
  			'1': 'var(--spacing-1)',
  			'2': 'var(--spacing-2)',
  			'3': 'var(--spacing-3)',
  			'4': 'var(--spacing-4)',
  			'5': 'var(--spacing-5)',
  			'6': 'var(--spacing-6)',
  			'8': 'var(--spacing-8)',
  			'10': 'var(--spacing-10)',
  			'12': 'var(--spacing-12)'
  		},
  		
  		/* Border Radius Scale */
  		borderRadius: {
  			'sm': 'var(--radius-sm)',
  			'md': 'var(--radius-md)',
  			'lg': 'var(--radius-lg)',
  			'xl': 'var(--radius-xl)',
  			'full': 'var(--radius-full)',
  			/* Legacy support */
  			'DEFAULT': 'var(--radius-md)'
  		},
  		
  		/* Typography Scale */
  		fontSize: {
  			'xs': 'var(--text-xs)',
  			'sm': 'var(--text-sm)',
  			'base': 'var(--text-base)',
  			'lg': 'var(--text-lg)',
  			'xl': 'var(--text-xl)',
  			'2xl': 'var(--text-2xl)',
  			'3xl': 'var(--text-3xl)'
  		},
  		
  		/* Font Weights */
  		fontWeight: {
  			'normal': 'var(--font-normal)',
  			'medium': 'var(--font-medium)',
  			'semibold': 'var(--font-semibold)',
  			'bold': 'var(--font-bold)'
  		},
  		
  		/* Shadow System */
  		boxShadow: {
  			'sm': 'var(--shadow-sm)',
  			'md': 'var(--shadow-md)',
  			'lg': 'var(--shadow-lg)',
  			'xl': 'var(--shadow-xl)'
  		},
  		
  		/* Animation Durations */
  		transitionDuration: {
  			'fast': 'var(--animation-fast)',
  			'normal': 'var(--animation-normal)',
  			'slow': 'var(--animation-slow)'
  		},
  		
  		/* Z-Index Scale */
  		zIndex: {
  			'base': 'var(--z-base)',
  			'dropdown': 'var(--z-dropdown)',
  			'overlay': 'var(--z-overlay)',
  			'modal': 'var(--z-modal)',
  			'notification': 'var(--z-notification)',
  			'max': 'var(--z-max)'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
} 