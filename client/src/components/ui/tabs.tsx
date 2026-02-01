import * as React from "react"

import { cn } from "@/lib/utils"

function Tabs({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="tabs"
      className={cn("flex flex-col", className)}
      {...props}
    />
  )
}

function TabsList({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="tabs-list"
      className={cn(
        "flex h-14 items-center rounded-full bg-[var(--gray-2)] p-1",
        className,
      )}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  active,
  ...props
}: React.ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      data-slot="tabs-trigger"
      className={cn(
        "flex-1 rounded-full text-sm font-medium transition-colors h-full",
        active
          ? "bg-[var(--gray-1)] text-[var(--gray-12)]"
          : "text-[var(--gray-11)]",
        className,
      )}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger }
