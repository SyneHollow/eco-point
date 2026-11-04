"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { buttonClass, cx } from "@/components/ui";
import { runBinCheck, runRoomCheck, type PhotoState } from "./ai-actions";

type Done = { summary?: string | null; flagged?: boolean; flag_reason?: string | null; line: string } | null;

const MAX_EDGE = 1288; // multiple of 28: keeps AI image cost low without losing detail

/** Shrink on the device before upload: smaller, faster, and the original never leaves the phone. */
async function shrink(file: File): Promise<{ blob: Blob; url: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((ok, bad) => canvas.toBlob((b) => (b ? ok(b) : bad(new Error("encode"))), "image/jpeg", 0.82));
  return { blob, url: URL.createObjectURL(blob) };
}

const BOX_COLOUR: Record<string, string> = {
  plastic: "border-red-500 bg-red-500/10",
  wrong_bin: "border-amber-400 bg-amber-400/10",
  litter: "border-red-500 bg-red-500/10",
  light: "border-sun-300 bg-sun-300/20",
};

export function PhotoCheck({ kind, done, intro }: { kind: "bin" | "room"; done: Done; intro: string }) {
  const [state, action, pending] = useActionState<PhotoState, FormData>(kind === "bin" ? runBinCheck : runRoomCheck, null);
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);

  const result = state?.ok ? state : null;

  if (done && !result) {
    return (
      <div className="space-y-2 text-sm">
        <p className="font-bold text-leaf-700">✓ {done.line}</p>
        {done.summary && <p className="text-stone-600">AI: “{done.summary}”</p>}
        {done.flagged && <FlagNote reason={done.flag_reason} />}
      </div>
    );
  }

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setLocalError(null);
    try {
      setPhoto(await shrink(f));
    } catch {
      setLocalError("Couldn't open that photo. Try again.");
    }
  }

  function send() {
    if (!photo) return;
    const fd = new FormData();
    fd.append("photo", photo.blob, "photo.jpg");
    startTransition(() => action(fd));
  }

  return (
    <div className="space-y-4">
      {!result && <p className="text-sm text-stone-600">{intro}</p>}
      <input ref={input} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} aria-label="Take photo" />

      {photo && (
        <div className="relative overflow-hidden rounded-2xl bg-stone-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.url} alt="Your photo" className="block w-full" />
          {result?.items?.map((it, i) =>
            it.box ? (
              <span
                key={i}
                title={it.label}
                className={cx("absolute rounded-md border-2", BOX_COLOUR[it.kind] ?? "border-red-500")}
                style={{ top: `${it.box[0] / 10}%`, left: `${it.box[1] / 10}%`, height: `${(it.box[2] - it.box[0]) / 10}%`, width: `${(it.box[3] - it.box[1]) / 10}%` }}
              />
            ) : null,
          )}
          {pending && (
            <div className="absolute inset-0 flex items-center justify-center bg-leaf-950/60 text-lg font-bold text-white">AI is checking…</div>
          )}
        </div>
      )}

      {result ? (
        <div className="space-y-2">
          <p className="text-lg font-extrabold text-leaf-800">{result.message}</p>
          {result.summary && <p className="text-sm text-stone-600">AI: “{result.summary}”</p>}
          {result.flagged && <FlagNote reason={result.flagReason} />}
          <p className="text-xs text-stone-500">The photo wasn&apos;t saved anywhere. Only the result was.</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => input.current?.click()} disabled={pending} className={buttonClass(photo ? "secondary" : "primary", "py-3")}>
            {photo ? "Retake photo" : kind === "bin" ? "📷 Photograph the bin" : "📷 Photograph the room"}
          </button>
          {photo && (
            <button type="button" onClick={send} disabled={pending} className={buttonClass("primary", "py-3")}>
              {pending ? "Checking…" : "Check with AI"}
            </button>
          )}
        </div>
      )}
      {(localError || state?.error) && (
        <p role="alert" className="text-sm font-bold text-red-700">
          {localError ?? state?.error}
        </p>
      )}
    </div>
  );
}

function FlagNote({ reason }: { reason?: string | null }) {
  return (
    <p className="rounded-xl bg-sun-100 px-3 py-2 text-sm font-semibold text-sun-700">
      ⚑ Sent to your teacher to look at: {reason ?? "the photo and the class's answers don't match."}
    </p>
  );
}
