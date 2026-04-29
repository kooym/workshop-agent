'use client'

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-on-primary hover:bg-primary-focus active:scale-95 disabled:opacity-40',
  secondary:
    'border border-hairline bg-white text-ink hover:bg-canvas-parchment disabled:text-ink-muted-48',
  ghost:
    'text-ink-muted-80 hover:bg-canvas-parchment hover:text-ink disabled:text-ink-muted-48',
  danger:
    'bg-red-600 text-white hover:bg-red-500 active:scale-95 disabled:opacity-40',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1 text-xs gap-1.5',
  md: 'px-3.5 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-sm gap-2',
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', icon, className = '', children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center rounded-full font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
})
