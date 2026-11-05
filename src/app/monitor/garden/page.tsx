import { createClient } from "@/lib/supabase/server";
import { requireMonitor } from "@/lib/session";
import type { Garden } from "@/lib/rewards";
import { GardenApp } from "./garden-app";

export const dynamic = "force-dynamic";
export const metadata = { title: "Class garden" };

export default async function GardenPage() {
  await requireMonitor();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_garden");
  if (error || !data) throw new Error(error?.message ?? "Could not load the garden");
  const g = data as Garden;
  // Remount when the garden changes on the server (new points, other tabs), so the view never goes stale.
  return <GardenApp key={`${g.earned}-${g.spent}-${g.plants.length}`} initial={g} />;
}
