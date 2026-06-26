import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Form inputs themed to the design tokens (DESIGN.md §8). Surface background,
 * subtle border, biro focus ring (the global :focus-visible outline handles the
 * ring). `TextField` wraps an input with a label + optional helper/error line.
 */

const fieldBase =
  "w-full rounded-md border border-border-strong bg-surface px-3.5 text-[15px] text-ink placeholder:text-ink-muted transition-colors focus:border-biro disabled:opacity-50 disabled:pointer-events-none";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(fieldBase, "h-11", className)} {...props} />;
  },
);

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(fieldBase, "min-h-[88px] py-2.5", className)} {...props} />;
});

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-sm font-medium text-ink-secondary", className)}
      {...props}
    />
  );
}

export function TextField({
  label,
  helper,
  error,
  id,
  className,
  children,
  ...props
}: {
  label: string;
  helper?: string;
  error?: string | null;
} & React.InputHTMLAttributes<HTMLInputElement> & { children?: React.ReactNode }) {
  const generatedId = React.useId();
  const fieldId = id ?? generatedId;
  return (
    <div className={cn("w-full", className)}>
      <Label htmlFor={fieldId}>{label}</Label>
      {children ?? (
        <Input id={fieldId} aria-invalid={!!error} aria-describedby={`${fieldId}-msg`} {...props} />
      )}
      {(error || helper) && (
        <p
          id={`${fieldId}-msg`}
          className={cn("mt-1.5 text-xs", error ? "text-danger-fg" : "text-ink-muted")}
        >
          {error || helper}
        </p>
      )}
    </div>
  );
}
