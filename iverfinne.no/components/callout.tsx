'use client'

import { cn } from "@/lib/utils"

const colorMap: Record<string, string> = {
  blue_background: "border-blue-400 bg-blue-50 dark:bg-blue-950/30",
  blue: "border-blue-400 bg-blue-50 dark:bg-blue-950/30",
  red_background: "border-red-400 bg-red-50 dark:bg-red-950/30",
  red: "border-red-400 bg-red-50 dark:bg-red-950/30",
  green_background: "border-green-400 bg-green-50 dark:bg-green-950/30",
  green: "border-green-400 bg-green-50 dark:bg-green-950/30",
  yellow_background: "border-yellow-400 bg-yellow-50 dark:bg-yellow-950/30",
  yellow: "border-yellow-400 bg-yellow-50 dark:bg-yellow-950/30",
  orange_background: "border-orange-400 bg-orange-50 dark:bg-orange-950/30",
  orange: "border-orange-400 bg-orange-50 dark:bg-orange-950/30",
  purple_background: "border-purple-400 bg-purple-50 dark:bg-purple-950/30",
  purple: "border-purple-400 bg-purple-50 dark:bg-purple-950/30",
  pink_background: "border-pink-400 bg-pink-50 dark:bg-pink-950/30",
  pink: "border-pink-400 bg-pink-50 dark:bg-pink-950/30",
  gray_background: "border-gray-400 bg-gray-50 dark:bg-gray-800/50",
  gray: "border-gray-400 bg-gray-50 dark:bg-gray-800/50",
  brown_background: "border-amber-600 bg-amber-50 dark:bg-amber-950/30",
  brown: "border-amber-600 bg-amber-50 dark:bg-amber-950/30",
  default: "border-gray-300 bg-gray-50 dark:bg-gray-800/50",
}

interface CalloutProps {
  icon?: string
  type?: string
  children: React.ReactNode
}

export function Callout({ icon, type = "default", children }: CalloutProps) {
  const colors = colorMap[type] || colorMap.default

  return (
    <div className={cn("flex gap-3 rounded-md border-l-4 p-4 my-4 not-prose", colors)}>
      {icon && <span className="text-xl shrink-0 leading-7">{icon}</span>}
      <div className="min-w-0 text-sm leading-relaxed [&>p]:m-0">{children}</div>
    </div>
  )
}
