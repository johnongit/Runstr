import * as React from "react"
import { Button, ButtonProps } from "./button"
import { cn } from "@/lib/utils"

interface ButtonGroupProps {
  value: string
  onValueChange: (value: string) => void
  options: Array<{
    value: string
    label: string
    disabled?: boolean
  }>
  variant?: ButtonProps["variant"]
  size?: ButtonProps["size"]
  className?: string
}

export const ButtonGroup = React.forwardRef<HTMLDivElement, ButtonGroupProps>(
  ({ value, onValueChange, options, variant = "outline", size = "default", className, ...props }, ref) => {
    return (
      <div 
        ref={ref}
        className={cn("flex rounded-md bg-bg-tertiary p-1 border border-border-secondary", className)}
        {...props}
      >
        {options.map((option, index) => (
          <Button
            key={option.value}
            variant={value === option.value ? "default" : variant}
            size={size}
            onClick={() => onValueChange(option.value)}
            disabled={option.disabled}
            className={cn(
              "flex-1 transition-colors duration-normal",
              index === 0 && "rounded-l-md rounded-r-none",
              index === options.length - 1 && "rounded-r-md rounded-l-none", 
              index !== 0 && index !== options.length - 1 && "rounded-none",
              value === option.value 
                ? "bg-primary text-text-primary shadow-sm" 
                : "bg-transparent text-text-muted hover:text-text-secondary hover:bg-bg-secondary"
            )}
          >
            {option.label}
          </Button>
        ))}
      </div>
    )
  }
)

ButtonGroup.displayName = "ButtonGroup" 