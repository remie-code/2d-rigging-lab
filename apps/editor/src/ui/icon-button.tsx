import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "../lib/class-name";
import { Tooltip } from "./tooltip";

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  children: ReactNode;
  label: string;
  pressed?: boolean;
  tooltipSide?: "top" | "right" | "bottom" | "left";
};

export function IconButton({
  children,
  className,
  label,
  pressed,
  tooltipSide = "right",
  type = "button",
  ...buttonProps
}: IconButtonProps) {
  const button = (
    <button
      aria-label={label}
      aria-pressed={pressed}
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-md border text-neutral-300 transition",
        "border-neutral-800 bg-neutral-950 hover:border-teal-600/70 hover:bg-teal-950/30 hover:text-teal-100",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400",
        pressed === true && "border-teal-500/70 bg-teal-950/50 text-teal-100",
        className
      )}
      type={type}
      {...buttonProps}
    >
      {children}
    </button>
  );

  return (
    <Tooltip label={label} side={tooltipSide}>
      {button}
    </Tooltip>
  );
}
