import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      className={cn(
        "h-14 w-full rounded-[16px] border border-transparent bg-[var(--gray-2)] px-5 text-sm outline-none transition-colors placeholder:text-[var(--gray-11)] focus:border-[var(--brand-9)] disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
}

export { Input }
