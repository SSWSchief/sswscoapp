import * as React from "react";
import { cn } from "@/lib/utils";
import { Icon } from "./Icon";

const baseControl =
  "w-full h-11 rounded border border-brand-ice bg-white px-3 text-sm text-brand-charcoal placeholder:text-brand-silver focus:outline-none focus:ring-2 focus:ring-brand-skyline/40 focus:border-brand-blue";

export function Label({
  children,
  required,
  htmlFor,
}: {
  children: React.ReactNode;
  required?: boolean;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-xs font-semibold text-brand-charcoal mb-1.5"
    >
      {children}
      {required && (
        <span className="text-red-500" aria-hidden="true">
          {" "}
          *
        </span>
      )}
    </label>
  );
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(baseControl, className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(baseControl, "h-auto py-2 min-h-[80px] resize-none", className)}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
          className={cn(baseControl, "appearance-none pr-9 text-brand-charcoal", className)}
        {...props}
      >
        {children}
      </select>
      <Icon
        name="chevron-down"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-brand-steel"
        width={16}
        height={16}
      />
    </div>
  );
}

/**
 * Labeled field wrapper. Generates an id and wires the label to the control via
 * `htmlFor`/`id` so clicks focus the input and screen readers announce it.
 */
export function FormField({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactElement;
}) {
  const generatedId = React.useId();
  const id = (children.props as { id?: string }).id ?? generatedId;
  const control = React.cloneElement(
    children as React.ReactElement<Record<string, unknown>>,
    {
      id,
      "aria-invalid": error ? true : undefined,
      "aria-describedby": hint || error ? `${id}-desc` : undefined,
    }
  );

  return (
    <div>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      {control}
      {(hint || error) && (
        <p
          id={`${id}-desc`}
          className={cn(
            "text-xs mt-1",
            error ? "text-red-600" : "text-brand-steel"
          )}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
