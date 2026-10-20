"use client";

import clsx from "clsx";
import * as RadixSwitch from "@radix-ui/react-switch";

export function Card({
  children,
  className,
  pink,
}: {
  children: React.ReactNode;
  className?: string;
  pink?: boolean;
}) {
  return (
    <div className={clsx(pink ? "card-hard-pink" : "card-hard", "relative p-5", className)}>
      {children}
    </div>
  );
}

export function MonoBadge({
  children,
  variant = "default",
  className,
  title,
}: {
  children: React.ReactNode;
  variant?: "default" | "pink" | "blue" | "black";
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={clsx(
        "badge-mono inline-flex items-center justify-center",
        variant === "pink" && "badge-mono-pink",
        variant === "blue" && "badge-mono-blue",
        variant === "black" && "badge-mono-black",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StickyTag({
  children,
  color = "pink",
  className,
}: {
  children: React.ReactNode;
  color?: "pink" | "yellow" | "black";
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "sticky-tag",
        color === "yellow" && "sticky-tag-yellow",
        color === "black" && "sticky-tag-black",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Switch({
  checked,
  onCheckedChange,
  label,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <label className="inline-flex items-center gap-3 cursor-pointer select-none">
      <RadixSwitch.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={clsx(
          "relative w-12 h-7 rounded-full border-2 border-[var(--color-ink)] transition-colors",
          "shadow-[2px_2px_0_#0a0a0a]",
          checked ? "bg-[var(--color-pink)]" : "bg-[var(--color-cream-200)]",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        <RadixSwitch.Thumb
          className={clsx(
            "block w-5 h-5 rounded-full bg-white border-2 border-[var(--color-ink)]",
            "transition-transform translate-x-0.5",
            "data-[state=checked]:translate-x-5",
          )}
        />
      </RadixSwitch.Root>
      {label && <span className="text-sm font-medium">{label}</span>}
    </label>
  );
}

export function WavyUnderline({ className }: { className?: string }) {
  return (
    <svg
      className={clsx("absolute -bottom-2 left-0 w-full", className)}
      viewBox="0 0 200 8"
      preserveAspectRatio="none"
      height="8"
    >
      <path
        d="M0,4 Q10,0 20,4 T40,4 T60,4 T80,4 T100,4 T120,4 T140,4 T160,4 T180,4 T200,4"
        stroke="#2e5bff"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Pentagon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" width="20" height="20">
      <polygon
        points="10,1 19,7.5 15.5,18 4.5,18 1,7.5"
        fill="#2e5bff"
        stroke="#0a0a0a"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function DashedDivider({ className }: { className?: string }) {
  return <div className={clsx("divider-dashed w-full", className)} />;
}

export function StatusPill({ status }: { status: string | null }) {
  if (!status) return <span className="mono text-xs text-[var(--color-ink-mute)]">—</span>;
  const variant: "pink" | "blue" | "black" | "default" =
    status === "offer" ? "pink" :
    status === "rejected" ? "black" :
    status === "saved" ? "default" : "blue";
  return (
    <MonoBadge variant={variant} className="uppercase">
      {status}
    </MonoBadge>
  );
}

export function ConfidenceBar({ value }: { value: number | null }) {
  if (value == null) return <span className="mono text-xs text-[var(--color-ink-mute)]">—</span>;
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const ok = value >= 0.7;
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="relative flex-1 h-3 border-2 border-[var(--color-ink)] bg-[var(--color-cream-200)]">
        <div
          className="absolute inset-y-0 left-0"
          style={{
            width: `${pct}%`,
            backgroundColor: ok ? "var(--color-pink)" : "var(--color-blue)",
          }}
        />
        {/* 0.7 threshold marker */}
        <div
          className="absolute inset-y-0 w-px bg-[var(--color-ink)]/40"
          style={{ left: "70%" }}
        />
      </div>
      <span className="mono text-xs w-9 text-right">{value.toFixed(2)}</span>
    </div>
  );
}
