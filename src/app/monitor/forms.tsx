"use client";

import { useActionState, useMemo, useState } from "react";
import { Stepper, YesNo } from "@/components/client";
import { buttonClass, SdgChips } from "@/components/ui";
import type { ActionState } from "@/lib/session";
import { submitAudit, submitEntry } from "./actions";

type SelfAction = { code: string; label: string; help: string | null; input_type: "count" | "check"; max_points: number; sdgs: number[] };
type PeerAction = { code: string; label: string; help: string | null; max_points: number; sdgs: number[] };

export function EntryForm({ actions, strength }: { actions: SelfAction[]; strength: number }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(submitEntry, null);
  const [present, setPresent] = useState(strength);
  const [values, setValues] = useState<Record<string, number | null>>(
    Object.fromEntries(actions.map((a) => [a.code, a.input_type === "count" ? 0 : null])),
  );
  const missing = actions.filter((a) => values[a.code] === null).map((a) => a.label);
  const clamped = useMemo(
    () => Object.fromEntries(actions.map((a) => [a.code, a.input_type === "count" ? Math.min(values[a.code] ?? 0, present) : values[a.code]])),
    [actions, values, present],
  );

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="values" value={JSON.stringify(clamped)} />
      <Question label="Students present today" help={`Class size: ${strength}`}>
        <Stepper name="present" min={1} max={strength} value={present} onChange={setPresent} label="Students present" />
      </Question>

      {actions.map((a) => (
        <Question key={a.code} label={a.label} help={a.help} sdgs={a.sdgs} points={a.max_points}>
          {a.input_type === "count" ? (
            <div className="flex flex-wrap items-center gap-3">
              <Stepper
                max={present}
                value={Math.min(values[a.code] ?? 0, present)}
                onChange={(v) => setValues((s) => ({ ...s, [a.code]: v }))}
                label={a.label}
              />
              <span className="text-sm font-bold text-stone-500">of {present}</span>
            </div>
          ) : (
            <YesNo value={values[a.code] as 0 | 1 | null} onChange={(v) => setValues((s) => ({ ...s, [a.code]: v }))} label={a.label} />
          )}
        </Question>
      ))}

      <div className="space-y-2">
        <button type="submit" disabled={pending || missing.length > 0} className={buttonClass("primary", "w-full py-4 text-lg")}>
          {pending ? "Saving…" : "Submit today's check"}
        </button>
        {missing.length > 0 && <p className="text-center text-sm text-stone-500">Answer: {missing.join(", ")}</p>}
        <p className="text-center text-xs text-stone-500">You can only submit once a day, so check your numbers first.</p>
        {state?.error && (
          <p role="alert" className="text-center text-sm font-bold text-red-700">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}

export function AuditForm({ actions, target }: { actions: PeerAction[]; target: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(submitAudit, null);
  const [values, setValues] = useState<Record<string, 0 | 1 | null>>(Object.fromEntries(actions.map((a) => [a.code, null])));
  const missing = actions.filter((a) => values[a.code] === null);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="values" value={JSON.stringify(values)} />
      {actions.map((a) => (
        <Question key={a.code} label={`${target}: ${a.label}`} help={a.help} sdgs={a.sdgs} points={a.max_points}>
          <YesNo value={values[a.code]} onChange={(v) => setValues((s) => ({ ...s, [a.code]: v }))} label={a.label} />
        </Question>
      ))}
      <button type="submit" disabled={pending || missing.length > 0} className={buttonClass("primary", "w-full py-4 text-lg")}>
        {pending ? "Saving…" : `Submit check of ${target}`}
      </button>
      {state?.error && (
        <p role="alert" className="text-center text-sm font-bold text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}

function Question({
  label,
  help,
  sdgs,
  points,
  children,
}: {
  label: string;
  help?: string | null;
  sdgs?: number[];
  points?: number;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="space-y-3 rounded-2xl bg-paper p-4">
      <legend className="sr-only">{label}</legend>
      <div className="space-y-1">
        <p className="text-lg font-extrabold text-leaf-900">{label}</p>
        {help && <p className="text-sm text-stone-600">{help}</p>}
        {(points !== undefined || !!sdgs?.length) && (
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {points !== undefined && <span className="text-xs font-bold text-leaf-700">up to {points} pts</span>}
            <SdgChips sdgs={sdgs} />
          </div>
        )}
      </div>
      {children}
    </fieldset>
  );
}
