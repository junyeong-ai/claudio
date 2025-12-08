import * as React from "react"
import { cn } from "@/lib/utils"

interface LabelProps extends React.ComponentProps<"label"> {
  required?: boolean
}

function Label({ className, required, children, ...props }: LabelProps) {
  return (
    <label
      data-slot="label"
      className={cn(
        "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className
      )}
      {...props}
    >
      {children}
      {required && <span className="text-destructive ml-1" aria-hidden="true">*</span>}
    </label>
  )
}

export { Label }
