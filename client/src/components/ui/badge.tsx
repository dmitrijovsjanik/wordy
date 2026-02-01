import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium [&>svg]:size-3.5 gap-1 [&>svg]:pointer-events-none transition-colors",
  {
    variants: {
      variant: {
        default: "bg-[var(--gray-3)] text-[var(--gray-12)]",
        primary: "bg-[var(--brand-9)] text-white",
        success: "bg-[var(--green-3)] text-[var(--green-11)]",
        error: "bg-[var(--pink-9)] text-white",
        secondary: "bg-[var(--gray-2)] text-[var(--gray-11)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
