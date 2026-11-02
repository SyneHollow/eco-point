import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { addDays, isDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  // Quote everything; neutralise spreadsheet formulas.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: me } = await supabase.rpc("whoami");
  if (!me || me.role !== "teacher") return NextResponse.json({ error: "Teachers only" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const to = isDate(sp.get("to")) ? sp.get("to")! : me.today;
  const from = isDate(sp.get("from")) ? sp.get("from")! : addDays(to, -30);

  const [entries, audits, actions] = await Promise.all([
    supabase.rpc("teacher_entries", { p_from: from, p_to: to }),
    supabase.rpc("teacher_peer_audits", { p_from: from, p_to: to }),
    supabase.rpc("teacher_actions"),
  ]);
  const err = entries.error ?? audits.error ?? actions.error;
  if (err) return NextResponse.json({ error: err.message }, { status: 400 });

  const codes: string[] = (actions.data as Array<{ code: string }>).map((a) => a.code);
  const header = ["record", "date", "class", "checked_by", "present", ...codes, "points", "measuring_week", "voided", "void_reason", "submitted_at"];
  const lines = [header.map(cell).join(",")];
  for (const e of entries.data as Array<Record<string, unknown> & { vals: Record<string, number> }>) {
    lines.push(
      [
        "class check", e.entry_date, e.class_name, "", e.present,
        ...codes.map((c) => e.vals[c] ?? ""),
        e.points, e.baseline ? "yes" : "no", e.voided ? "yes" : "no", e.void_reason ?? "", e.submitted_at,
      ].map(cell).join(","),
    );
  }
  for (const a of audits.data as Array<Record<string, unknown> & { vals: Record<string, number> }>) {
    lines.push(
      [
        "peer check", a.audit_date, a.target_name, a.auditor_name, "",
        ...codes.map((c) => a.vals[c] ?? ""),
        a.points, a.baseline ? "yes" : "no", a.voided ? "yes" : "no", a.void_reason ?? "", a.submitted_at,
      ].map(cell).join(","),
    );
  }

  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="ecopoints-${from}-to-${to}.csv"`,
      "cache-control": "no-store",
    },
  });
}
