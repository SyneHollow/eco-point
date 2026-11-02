"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ActionState } from "@/lib/session";
import { buttonClass, cx, type BtnVariant } from "@/components/ui";

type ServerAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/** A form wired to a server action, showing pending / error / success states. */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = "Saving…",
  variant = "primary",
  className,
  buttonClassName,
  resetOnSuccess = true,
  confirmText,
}: {
  action: ServerAction;
  children?: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  variant?: BtnVariant;
  className?: string;
  buttonClassName?: string;
  resetOnSuccess?: boolean;
  confirmText?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
      }}
    >
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass(variant, buttonClassName)}>
          {pending ? pendingLabel : submitLabel}
        </button>
        {state?.error && (
          <p role="alert" className="text-sm font-semibold text-red-700">
            {state.error}
          </p>
        )}
        {state?.ok && state.message && <p className="text-sm font-semibold text-leaf-700">{state.message}</p>}
      </div>
    </form>
  );
}

/** Big − / + counter for counting students. */
export function Stepper({
  name,
  min = 0,
  max,
  value,
  onChange,
  label,
}: {
  name?: string;
  min?: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const set = (v: number) => onChange(Math.max(min, Math.min(max, Number.isFinite(v) ? Math.round(v) : min)));
  return (
    <div className="flex items-center gap-2">
      <button type="button" aria-label={`Decrease ${label}`} onClick={() => set(value - 1)}
        className="h-12 w-12 rounded-xl bg-leaf-100 text-2xl font-bold text-leaf-800 active:scale-95">
        −
      </button>
      <input
        name={name}
        aria-label={label}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(e) => set(Number(e.target.value))}
        className="tabular h-12 w-20 rounded-xl border-0 text-center text-2xl font-extrabold ring-1 ring-stone-300 focus:ring-2 focus:ring-leaf-500 outline-none"
      />
      <button type="button" aria-label={`Increase ${label}`} onClick={() => set(value + 1)}
        className="h-12 w-12 rounded-xl bg-leaf-100 text-2xl font-bold text-leaf-800 active:scale-95">
        +
      </button>
    </div>
  );
}

export function YesNo({ value, onChange, label }: { value: 0 | 1 | null; onChange: (v: 0 | 1) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-2">
      {([1, 0] as const).map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cx(
            "h-12 min-w-24 rounded-xl px-4 text-base font-extrabold ring-1 transition",
            value === v
              ? v === 1
                ? "bg-leaf-600 text-white ring-leaf-600"
                : "bg-red-600 text-white ring-red-600"
              : "bg-white text-stone-600 ring-stone-300",
          )}
        >
          {v === 1 ? "Yes" : "No"}
        </button>
      ))}
    </div>
  );
}

export function PrintButton({ label = "Print / save as PDF" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass("primary", "no-print")}>
      {label}
    </button>
  );
}

/** Re-fetches server data every `seconds` (corridor screen). */
export function AutoRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}

export function Clock({ timeZone }: { timeZone: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);
  if (!now) return null;
  return (
    <span className="tabular">
      {new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" }).format(now)}
    </span>
  );
}
