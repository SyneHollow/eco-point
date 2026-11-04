"use client";

import { useActionState, useRef } from "react";
import { buttonClass, cx, inputClass, TeamTile } from "@/components/ui";
import { Icon } from "@/components/icons";
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
          className={inputClass}
        />
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => ref.current && (ref.current.value = q)}
              className="min-h-9 rounded-full border border-leaf-600/30 bg-white px-3 py-1 text-left text-sm font-bold text-leaf-700 hover:border-leaf-600 hover:bg-leaf-50"
            >
              {q}
            </button>
          ))}
        </div>
        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          <Icon name="chat" size={18} />
          {pending ? "Thinking…" : "Ask"}
        </button>
      </form>
      {state?.error && <p role="alert" className="font-bold text-red-700">{state.error}</p>}
      {state?.answer && (
        <div className="rounded-[10px] border-l-4 border-lagoon-500 bg-lagoon-100/60 p-4" role="status">
          <p className="mb-2 font-bold text-lagoon-700">{state.question}</p>
          <p className="whitespace-pre-line">{state.answer}</p>
          <p className="mt-3 text-sm text-stone-500">Answered by AI from your EcoPoints data only. Check anything important against Daily records.</p>
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
          <Icon name="scan" size={18} />
          {drafting ? "Drafting…" : "Draft this week's challenges with AI"}
        </button>
        {drafts?.error && <p role="alert" className="mt-2 font-bold text-red-700">{drafts.error}</p>}
      </form>
      <form action={publishAction} className="space-y-3" key={formKey}>
        <input type="hidden" name="week_start" value={week} />
        {rows.map((r) => (
          <label key={r.class_id} className="flex items-start gap-3">
            <TeamTile name={r.class_name} size="sm" className="mt-1 shrink-0" />
            <textarea name={`c_${r.class_id}`} defaultValue={r.text} rows={2} maxLength={200} placeholder="Leave empty for no challenge" className={inputClass} />
          </label>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={publishing} className={buttonClass("primary")}>
            {publishing ? "Publishing…" : "Publish to classes & corridor screen"}
          </button>
          {published?.error && <p role="alert" className="font-bold text-red-700">{published.error}</p>}
          {published?.ok && <p role="status" className="font-bold text-leaf-600">{published.message}</p>}
        </div>
        <p className="text-sm text-stone-500">Nothing goes to students until you publish. Edit anything the AI wrote first.</p>
      </form>
    </div>
  );
}
