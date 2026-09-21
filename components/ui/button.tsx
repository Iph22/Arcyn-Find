import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      // A compact height for mouse input, and a touch *floor* on top of it.
      // `pointer-coarse` is the right question -- viewport width says nothing
      // about how the thing is being pointed at, and a tablet or a touchscreen
      // laptop is wide and coarse at once.
      //
      // These are `min-h-*`, not `h-*`, and that distinction is load-bearing.
      // A caller passing an explicit `h-12` gets a *different* Tailwind
      // modifier than `pointer-coarse:h-11`, so tailwind-merge keeps both and
      // the media query wins -- which silently made such buttons *shorter* on
      // touch than the caller asked for. It clipped the guest sign-in button
      // in the mobile bottom nav from 48px to 44px. As `min-h-*` the rule can
      // only ever raise a height, never lower one, so an explicit `h-*` stays
      // in charge.
      //
      // globals.css sets the same 2.75rem floor on bare `button` elements that
      // never come through here; `min-h-10` below deliberately *lowers* it for
      // the compact sizes, which works because utilities beat `@layer base`.
      //
      // Only the icon sizes get `min-w-*`. The old global rule put
      // `min-width: 44px` on every button and link, which is what actually
      // broke layouts -- text buttons inflated and tight rows wrapped. For a
      // square icon target it is exactly right.
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3 pointer-coarse:min-h-11",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5 pointer-coarse:min-h-10",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4 pointer-coarse:min-h-12",
        icon: "size-9 pointer-coarse:min-h-11 pointer-coarse:min-w-11",
        "icon-sm": "size-8 pointer-coarse:min-h-10 pointer-coarse:min-w-10",
        "icon-lg": "size-10 pointer-coarse:min-h-12 pointer-coarse:min-w-12",
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
  variant,
  size,
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
