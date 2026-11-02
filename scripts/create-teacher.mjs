// Creates a teacher login for EcoPoints. Run from the repo folder:
//   node scripts/create-teacher.mjs
// It asks for the name, email and password. Reads keys from .env.local.
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const slug = process.env.NEXT_PUBLIC_SCHOOL_SLUG ?? "school";
if (!url || !secret) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local");
  process.exit(1);
}

const rl = createInterface({ input, output });
const lines = rl[Symbol.asyncIterator]();
const ask = async (q) => {
  output.write(q);
  const { value } = await lines.next();
  return value ?? "";
};
const name = (await ask("Teacher's name: ")).trim();
const email = (await ask("Teacher's email: ")).trim().toLowerCase();
const password = await ask("Password (min 10 characters, visible as you type): ");
rl.close();

if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 10) {
  console.error("Need a name, a valid email and a password of at least 10 characters.");
  process.exit(1);
}

const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: school, error: sErr } = await admin.rpc("public_school", { p_slug: slug });
if (sErr || !school) {
  console.error(`School "${slug}" not found. Did you run supabase/seed.sql? ${sErr?.message ?? ""}`);
  process.exit(1);
}

const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (error || !data.user) {
  console.error(`Could not create the login: ${error?.message}`);
  process.exit(1);
}
const { error: linkErr } = await admin.rpc("svc_link_profile", {
  p_user_id: data.user.id,
  p_school_id: school.id,
  p_role: "teacher",
  p_class_id: null,
  p_display_name: name,
  p_actor: null,
});
if (linkErr) {
  await admin.auth.admin.deleteUser(data.user.id);
  console.error(`Could not link the teacher to ${school.name}: ${linkErr.message}`);
  process.exit(1);
}
console.log(`OK: ${name} <${email}> is a teacher at ${school.name}. Log in at /login?as=teacher`);
