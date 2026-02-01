import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 shrink-0",
  {
    variants: {
      variant: {
        default: "bg-[var(--brand-9)] text-white active:bg-[var(--brand-10)]",
        secondary: "bg-[var(--gray-3)] text-[var(--gray-12)] active:bg-[var(--gray-5)]",
        ghost: "bg-transparent text-[var(--gray-12)] active:bg-[var(--gray-3)]",
        link: "text-[var(--brand-9)]",
        destructive: "bg-[var(--red-9)] text-white active:bg-[var(--red-10)]",
        success: "bg-[var(--green-9)] text-white",
        error: "bg-[var(--pink-9)] text-white",
      },
      size: {
        default: "h-14 rounded-full px-6 text-base",
        sm: "h-10 rounded-full px-4 text-sm",
        xs: "h-8 rounded-full px-3 text-xs",
        icon: "h-10 w-10 rounded-full",
        "icon-sm": "h-8 w-8 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
