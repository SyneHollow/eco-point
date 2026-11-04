"use client";

import { useActionState, useRef } from "react";
import { buttonClass, cx, inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/session";
import { askEcoPoints, draftChallenges, publishChallenges, type AskState, type ChallengeDraft, type DraftState } from "../ai-actions";

const SUGGESTIONS = [
  "Which class improved most this month, and why?",
  "What is our school's weakest habit right now?",
  "Which classes need a nudge this week?",
  "How do this month's AI bin checks compare with last month?",
];

export function AskBox() {
  const [state, action, pending] = useActionState<AskState, FormData>(askEcoPoints, null);
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <div className="space-y-4">
      <form action={action} className="space-y-3">
        <textarea
          ref={ref}
          name="question"
          rows={3}
          maxLength={500}
          required
          placeholder="Ask anything about your classes' eco data…"
          className={cx(inputClass, "text-base")}
        />
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => ref.current && (ref.current.value = q)}
              className="rounded-full bg-leaf-50 px-3 py-1.5 text-xs font-bold text-leaf-800 ring-1 ring-leaf-700/15 hover:bg-leaf-100"
            >
              {q}
            </button>
          ))}
        </div>
        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          {pending ? "Thinking…" : "Ask"}
        </button>
      </form>
      {state?.error && <p role="alert" className="text-sm font-bold text-red-700">{state.error}</p>}
      {state?.answer && (
        <div className="rounded-2xl bg-leaf-50 p-5 ring-1 ring-leaf-700/10">
          <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-leaf-700">{state.question}</p>
          <p className="whitespace-pre-line text-leaf-950">{state.answer}</p>
          <p className="mt-3 text-xs text-stone-500">Answered by AI from your EcoPoints data only. Check anything important against Daily records.</p>
        </div>
      )}
    </div>
  );
}

export function Challenges({ week, initial }: { week: string; initial: ChallengeDraft[] }) {
  const [drafts, draftAction, drafting] = useActionState<DraftState, FormData>(draftChallenges, null);
  const [published, publishAction, publishing] = useActionState<ActionState, FormData>(publishChallenges, null);
  const rows = drafts?.drafts ?? initial;
  // A new AI draft re-mounts the textareas so they show it.
  const formKey = drafts?.drafts ? JSON.stringify(drafts.drafts) : "initial";

  return (
    <div className="space-y-4">
      <form action={draftAction}>
        <button type="submit" disabled={drafting} className={buttonClass("secondary")}>
          {drafting ? "Drafting…" : "✨ Draft this week's challenges with AI"}
        </button>
        {drafts?.error && <p role="alert" className="mt-2 text-sm font-bold text-red-700">{drafts.error}</p>}
      </form>
      <form action={publishAction} className="space-y-3" key={formKey}>
        <input type="hidden" name="week_start" value={week} />
        {rows.map((r) => (
          <label key={r.class_id} className="flex items-start gap-3">
            <span className="w-12 pt-2 font-display text-xl font-bold text-leaf-900">{r.class_name}</span>
            <textarea name={`c_${r.class_id}`} defaultValue={r.text} rows={2} maxLength={200} placeholder="Leave empty for no challenge" className={inputClass} />
          </label>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={publishing} className={buttonClass("primary")}>
            {publishing ? "Publishing…" : "Publish to classes & corridor screen"}
          </button>
          {published?.error && <p role="alert" className="text-sm font-bold text-red-700">{published.error}</p>}
          {published?.ok && <p className="text-sm font-bold text-leaf-700">{published.message}</p>}
        </div>
        <p className="text-xs text-stone-500">Nothing goes to students until you publish. Edit anything the AI wrote first.</p>
      </form>
    </div>
  );
}
