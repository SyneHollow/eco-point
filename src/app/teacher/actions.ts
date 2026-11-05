"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, monitorEmail } from "@/lib/supabase/admin";
import { requireTeacher, type ActionState } from "@/lib/session";
import { errorMessage, pts } from "@/lib/format";
import { fmtMonth, isDate } from "@/lib/dates";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const done = (message: string): ActionState => {
  revalidatePath("/teacher", "layout");
  return { ok: true, message };
};

// ---------------------------------------------------------------- points ----

export async function awardPoints(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireTeacher();
  const classId = str(fd, "class_id");
  const kind = str(fd, "kind") || "bonus";
  const points = Number(str(fd, "points"));
  const reason = str(fd, "reason");
  if (!UUID.test(classId)) return { error: "Pick a class." };
  if (!Number.isFinite(points)) return { error: "Enter the points." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("award_points", { p_class_id: classId, p_kind: kind, p_points: points, p_reason: reason });
  if (error) return { error: errorMessage(error) };
  return done(`${kind === "bonus" ? "Bonus" : "Adjustment"} of ${pts(points)} points saved.`);
}

export async function voidEntry(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireTeacher();
  const id = str(fd, "id");
  const kind = str(fd, "kind");
  if (!UUID.test(id)) return { error: "Missing record." };
  const supabase = await createClient();
  const { error } = await supabase.rpc(kind === "audit" ? "void_peer_audit" : "void_entry", {
    ...(kind === "audit" ? { p_audit_id: id } : { p_entry_id: id }),
    p_reason: str(fd, "reason"),
  });
  if (error) return { error: errorMessage(error) };
  return done("Voided. Its points and leaves were taken back.");
}

export async function closeMonth(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireTeacher();
  const month = str(fd, "month");
  if (!isDate(month)) return { error: "Pick a month." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("close_month", { p_month: month });
  if (error) return { error: errorMessage(error) };
  return done(
    `${fmtMonth(month)} closed. Green Champion: ${data.champion} (${pts(data.points)} pts)${data.tie ? ". It was a tie, so it went to the class with more days submitted." : "."}`,
  );
}

// ------------------------------------------------------ classes & criteria ----

export async function saveClass(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireTeacher();
  const id = str(fd, "id");
  const supabase = await createClient();
  const { error } = await supabase.rpc("upsert_class", {
    p_id: UUID.test(id) ? id : null,
    p_grade: Number(str(fd, "grade")),
    p_section: str(fd, "section"),
    p_strength: Number(str(fd, "strength")),
    p_active: fd.has("id") ? fd.get("active") === "on" : true,
  });
  if (error) return { error: errorMessage(error) };
  return done("Saved.");
}

export async function saveAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireTeacher();
  const id = str(fd, "id");
  const sdgs = str(fd, "sdgs")
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
  if (sdgs.some((n) => !Number.isInteger(n))) return { error: "SDGs: whole numbers separated by commas, e.g. 12, 13" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("upsert_action", {
    p_id: UUID.test(id) ? id : null,
    p_code: str(fd, "code") || null,
    p_label: str(fd, "label"),
    p_help: str(fd, "help"),
    p_input_type: str(fd, "input_type") || null,
    p_entered_by: str(fd, "entered_by") || null,
    p_max_points: Number(str(fd, "max_points")),
    p_sdgs: sdgs,
    p_sort_order: Number(str(fd, "sort_order") || 0),
    p_active: UUID.test(id) ? fd.get("active") === "on" : true,
  });
  if (error) return { error: errorMessage(error) };
  return done("Saved. Changes apply from the next entry; past points stay as they were.");
}

export async function saveSettings(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireTeacher();
  const start = str(fd, "points_start_date");
  if (start && !isDate(start)) return { error: "Invalid date." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_school_settings", { p_name: str(fd, "name"), p_points_start_date: start || null });
  if (error) return { error: errorMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved." };
}

// --------------------------------------------------------------- accounts ----
// These use the secret key, so the teacher check MUST come first.

const WEAK_PINS = new Set(["123456", "654321", "123123", "112233", "121212"]);

export async function setMonitorPin(_p: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireTeacher();
  const classId = str(fd, "class_id");
  const pin = str(fd, "pin");
  if (!UUID.test(classId)) return { error: "Missing class." };
  if (!/^\d{6}$/.test(pin)) return { error: "PIN must be exactly 6 digits." };
  if (/^(\d)\1{5}$/.test(pin) || WEAK_PINS.has(pin)) return { error: "That PIN is too easy to guess. Pick another." };

  // Confirm the class belongs to this teacher's school (RLS-scoped read).
  const supabase = await createClient();
  const { data: classes, error: cErr } = await supabase.rpc("teacher_classes");
  if (cErr) return { error: errorMessage(cErr) };
  const cls = (classes as Array<{ id: string; name: string; monitor_user_id: string | null }>).find((c) => c.id === classId);
  if (!cls) return { error: "Class not found." };

  const admin = createAdminClient();
  if (cls.monitor_user_id) {
    const { error } = await admin.auth.admin.updateUserById(cls.monitor_user_id, { password: pin });
    if (error) return { error: `Could not update the PIN: ${error.message}` };
  } else {
    const { data, error } = await admin.auth.admin.createUser({ email: monitorEmail(classId), password: pin, email_confirm: true });
    if (error || !data.user) return { error: `Could not create the class login: ${error?.message ?? "unknown error"}` };
    const { error: linkErr } = await admin.rpc("svc_link_profile", {
      p_user_id: data.user.id,
      p_school_id: me.school_id,
      p_role: "monitor",
      p_class_id: classId,
      p_display_name: `${cls.name} Eco Monitors`,
      p_actor: me.user_id,
    });
    if (linkErr) {
      await admin.auth.admin.deleteUser(data.user.id);
      return { error: `Could not link the class login: ${linkErr.message}` };
    }
  }
  await admin.rpc("svc_log", {
    p_school_id: me.school_id,
    p_actor: me.user_id,
    p_action: "monitor.pin_set",
    p_entity: "class",
    p_entity_id: classId,
    p_details: { class: cls.name },
  });
  return done(`PIN for ${cls.name} saved. Write it down now; it can't be shown again.`);
}

export async function addTeacher(_p: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireTeacher();
  const email = str(fd, "email").toLowerCase();
  const name = str(fd, "display_name");
  const password = String(fd.get("password") ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email." };
  if (name.length < 2) return { error: "Enter the teacher's name." };
  if (password.length < 10) return { error: "Temporary password must be at least 10 characters." };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) return { error: `Could not create the account: ${error?.message ?? "unknown error"}` };
  const { error: linkErr } = await admin.rpc("svc_link_profile", {
    p_user_id: data.user.id,
    p_school_id: me.school_id,
    p_role: "teacher",
    p_class_id: null,
    p_display_name: name,
    p_actor: me.user_id,
  });
  if (linkErr) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { error: `Could not link the account: ${linkErr.message}` };
  }
  return done(`${name} can now log in as a teacher.`);
}
