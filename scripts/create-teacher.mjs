// Creates a teacher login for EcoPoints. Run from the repo folder:
//   node scripts/create-teacher.mjs
// Checks .env.local and the school first, then asks for the name, email and password.
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Set an exit code instead of calling process.exit(): on Windows, exiting
// while the keyboard reader is closing crashes Node with a libuv assertion.
function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

async function main() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  const slug = process.env.NEXT_PUBLIC_SCHOOL_SLUG ?? "school";
  if (!url || !secret) return fail("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local");
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) {
    return fail(
      `NEXT_PUBLIC_SCHOOL_SLUG in .env.local is "${slug}". It must be the short school code from supabase/seed.sql ` +
        `(default: school), not the school's name. Set the school's name in the app under Teacher → Settings.`,
    );
  }

  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: school, error: sErr } = await admin.rpc("public_school", { p_slug: slug });
  if (sErr) return fail(`Could not reach the database: ${sErr.message}`);
  if (!school) return fail(`No school with code "${slug}". Run supabase/seed.sql in the Supabase SQL editor first.`);
  console.log(`School: ${school.name}`);

  const rl = createInterface({ input, output });
  const lines = rl[Symbol.asyncIterator]();
  const ask = async (q) => {
    output.write(q);
    const { value } = await lines.next();
    return value ?? "";
  };
  let name, email, password;
  try {
    name = (await ask("Teacher's name: ")).trim();
    email = (await ask("Teacher's email: ")).trim().toLowerCase();
    password = await ask("Password (min 10 characters, visible as you type): ");
  } finally {
    rl.close();
  }

  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 10) {
    return fail("Need a name, a valid email and a password of at least 10 characters.");
  }

  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) return fail(`Could not create the login: ${error?.message}`);
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
    return fail(`Could not link the teacher to ${school.name}: ${linkErr.message}`);
  }
  console.log(`OK: ${name} <${email}> is a teacher at ${school.name}. Log in at /login?as=teacher`);
}

main().catch((e) => fail(`Unexpected error: ${e?.message ?? e}`));
