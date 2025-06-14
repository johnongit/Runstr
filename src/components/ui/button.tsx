import * as React from "react"
// import * as React from "react" // Removed because jsxInject in vite.config.js handles this
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // Base button styles optimized for mobile touch targets and minimalist design
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-all duration-normal ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Primary button - black/white high contrast
        primary:
          "bg-interactive text-background border border-interactive hover:bg-interactive-hover hover:border-interactive-hover active:bg-interactive-active",
        
        // Secondary button - outlined style
        secondary:
          "bg-transparent text-interactive border border-interactive hover:bg-interactive hover:text-background active:bg-interactive-active active:text-background",
        
        // Ghost button - minimal style
        ghost: 
          "bg-transparent text-text-secondary border border-transparent hover:bg-surface-elevated hover:text-text-primary active:bg-surface",
        
        // Accent button - Bitcoin orange for special actions
        accent:
          "bg-accent text-background border border-accent hover:bg-accent-hover hover:border-accent-hover",
        
        // Destructive button - error state
        destructive:
          "bg-error text-background border border-error hover:bg-error/90",
        
        // Link button - text-only
        link: 
          "text-interactive underline-offset-4 hover:underline border-none bg-transparent p-0",
      },
      size: {
        // Mobile-optimized sizes with minimum 44px touch targets
        sm: "h-10 px-3 text-sm min-w-[44px]",     // 40px height + padding = 44px+ touch target
        md: "h-11 px-4 text-base min-w-[44px]",   // 44px height - perfect mobile target
        lg: "h-12 px-6 text-lg min-w-[48px]",     // 48px height - large touch target
        icon: "h-11 w-11",                        // Square 44px touch target
        full: "h-11 px-4 text-base w-full",       // Full width with proper height
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  /**
   * Loading state for the button
   */
  loading?: boolean
  /**
   * Icon to display on the left side of the button
   */
  leftIcon?: React.ReactNode
  /**
   * Icon to display on the right side of the button
   */
  rightIcon?: React.ReactNode
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    className, 
    variant, 
    size, 
    asChild = false, 
    loading = false,
    leftIcon,
    rightIcon,
    children,
    disabled,
    ...props 
  }, ref) => {
    const Comp = asChild ? Slot : "button"
    
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {/* Loading spinner or left icon */}
        {loading ? (
          <svg 
            className="animate-spin h-4 w-4" 
            xmlns="http://www.w3.org/2000/svg" 
            fill="none" 
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle 
              className="opacity-25" 
              cx="12" 
              cy="12" 
              r="10" 
              stroke="currentColor" 
              strokeWidth="4"
            />
            <path 
              className="opacity-75" 
              fill="currentColor" 
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : leftIcon ? (
          leftIcon
        ) : null}
        
        {/* Button content */}
        {children}
        
        {/* Right icon */}
        {rightIcon && !loading && rightIcon}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
