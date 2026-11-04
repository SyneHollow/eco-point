"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ActionState } from "@/lib/session";
import { buttonClass, cx, type BtnVariant } from "@/components/ui";
import { Icon } from "@/components/icons";

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
          <p role="alert" className="inline-flex items-start gap-1.5 text-[15px] font-semibold text-red-700">
            <Icon name="warning" size={18} className="mt-0.5 shrink-0" />
            {state.error}
          </p>
        )}
        {state?.ok && state.message && (
          <p role="status" className="inline-flex items-start gap-1.5 text-[15px] font-semibold text-leaf-600">
            <Icon name="done" size={18} className="mt-0.5 shrink-0" />
            {state.message}
          </p>
        )}
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
  const btn =
    "flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-leaf-100 text-pitch transition-colors hover:bg-leaf-200 active:translate-y-px disabled:opacity-40";
  return (
    <div className="flex items-center gap-2">
      <button type="button" aria-label={`Decrease ${label}`} onClick={() => set(value - 1)} disabled={value <= min} className={btn}>
        <Icon name="minus" size={24} />
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
        className="font-display tabular h-14 w-20 rounded-xl border-[1.5px] border-stone-400 bg-white text-center text-4xl font-extrabold text-pitch focus:border-pitch"
      />
      <button type="button" aria-label={`Increase ${label}`} onClick={() => set(value + 1)} disabled={value >= max} className={btn}>
        <Icon name="plus" size={24} />
      </button>
    </div>
  );
}

export function YesNo({ value, onChange, label }: { value: 0 | 1 | null; onChange: (v: 0 | 1) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid max-w-sm grid-cols-2 gap-2">
      {([1, 0] as const).map((v) => {
        const on = value === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(v)}
            className={cx(
              "flex h-14 items-center justify-center gap-2 rounded-xl border-[1.5px] text-lg font-bold transition-colors active:translate-y-px",
              on
                ? v === 1
                  ? "border-leaf-600 bg-leaf-600 text-white shadow-[inset_0_-3px_0_rgb(0_0_0/0.25)]"
                  : "border-red-700 bg-red-700 text-white shadow-[inset_0_-3px_0_rgb(0_0_0/0.25)]"
                : "border-stone-300 bg-white text-stone-600 hover:border-stone-500",
            )}
          >
            <Icon name={v === 1 ? "check" : "x"} size={20} />
            {v === 1 ? "Yes" : "No"}
          </button>
        );
      })}
    </div>
  );
}

export function PrintButton({ label = "Print / save as PDF" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass("primary", "no-print")}>
      <Icon name="printer" size={18} />
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
