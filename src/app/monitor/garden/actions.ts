"use server";

import { createClient } from "@/lib/supabase/server";
import { requireMonitor } from "@/lib/session";
import { errorMessage } from "@/lib/format";
import type { Garden } from "@/lib/rewards";

export type GardenResult = { ok: true; garden: Garden; grew?: boolean; name?: string } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function fresh(supabase: Awaited<ReturnType<typeof createClient>>): Promise<Garden | null> {
  const { data } = await supabase.rpc("my_garden");
  return (data as Garden) ?? null;
}

export async function buyItem(code: string): Promise<GardenResult> {
  await requireMonitor();
  if (!/^[a-z_]{2,30}$/.test(code)) return { ok: false, error: "That isn't in the garden shop." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("garden_buy", { p_item: code });
  if (error) return { ok: false, error: errorMessage(error) };
  const garden = await fresh(supabase);
  return garden ? { ok: true, garden, name: data?.name } : { ok: false, error: "Bought, but the garden didn't reload. Refresh the page." };
}

export async function waterPlant(id: string): Promise<GardenResult> {
  await requireMonitor();
  if (!UUID.test(id)) return { ok: false, error: "That plant isn't in your garden." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("garden_water", { p_plant: id });
  if (error) return { ok: false, error: errorMessage(error) };
  const garden = await fresh(supabase);
  return garden ? { ok: true, garden, grew: !!data?.grew, name: data?.name } : { ok: false, error: "Watered, but the garden didn't reload. Refresh the page." };
}

export async function movePlant(id: string, plot: number): Promise<GardenResult> {
  await requireMonitor();
  if (!UUID.test(id) || !Number.isInteger(plot) || plot < 0 || plot > 17) return { ok: false, error: "That spot isn't in the garden." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("garden_move", { p_plant: id, p_plot: plot });
  if (error) return { ok: false, error: errorMessage(error) };
  const garden = await fresh(supabase);
  return garden ? { ok: true, garden } : { ok: false, error: "Moved, but the garden didn't reload. Refresh the page." };
}
