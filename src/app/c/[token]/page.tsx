import { notFound, redirect } from "next/navigation";
import { getMe } from "@/lib/session";

// Printed QR codes point here (short URL = a simpler, easier-to-scan code).
export const dynamic = "force-dynamic";

export default async function QrLanding({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-z0-9]{10}$/i.test(token)) notFound();
  const t = token.toLowerCase();
  const me = await getMe();
  if (!me) redirect(`/login?next=/c/${t}`);
  if (me.role === "monitor") redirect(`/monitor/challenges/${t}`);
  redirect("/teacher/challenges");
}
