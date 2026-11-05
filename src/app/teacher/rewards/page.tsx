import { ActionForm } from "@/components/client";
import { Card, cx, PageTitle, TeamTile, inputClass } from "@/components/ui";
import { BadgeEmblem } from "@/components/badges";
import { GardenScene, ItemThumb } from "@/components/garden-art";
import { pts } from "@/lib/format";
import { getGardens } from "@/lib/public-data";
import { requireTeacher } from "@/lib/session";
import { rewardsConfig, teacherGardens } from "@/lib/teacher-data";
import { saveBadgeTier, saveGardenItem } from "../rewards-actions";

export const metadata = { title: "Badges & gardens" };

const KIND: Record<string, string> = { plant: "Plant", flower: "Flower", tree: "Tree", decor: "Decoration", rare: "Badge reward" };

export default async function RewardsPage() {
  await requireTeacher();
  const [cfg, gardens, plots] = await Promise.all([rewardsConfig(), teacherGardens(), getGardens()]);

  return (
    <div className="space-y-6">
      <PageTitle
        title="Badges & gardens"
        sub="Each class grows a garden with the points it earns. Spending garden points never lowers a class's score or badges."
      />

      <Card title="Class gardens">
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {gardens.map((g) => (
            <li key={g.class_id} className="overflow-hidden rounded-xl border border-line">
              <GardenScene uid={`t-${g.class_id}`} still plants={plots.filter((p) => p.class_id === g.class_id).map((p) => ({ item: p.item_code, plot: p.plot, stage: p.stage }))}
                className="block w-full" label={`Class ${g.class_name}'s garden`} />
              <div className="flex items-center gap-3 p-3">
                <TeamTile name={g.class_name} size="sm" />
                <div className="min-w-0 text-sm">
                  <p><strong className="tabular">{pts(g.available)}</strong> to spend, {pts(g.spent)} spent</p>
                  <p className="text-stone-500">{g.plants} in the garden, {g.grown} fully grown</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Card title="Monthly badges">
          <p className="mb-4 text-stone-600">A class earns a badge when its points in one calendar month reach the target. Keep the targets in order.</p>
          <ul className="divide-y divide-line">
            {cfg.tiers.map((t) => (
              <li key={t.code} className="flex flex-wrap items-center gap-4 py-3 first:pt-0">
                <BadgeEmblem code={t.code} size={48} />
                <div className="min-w-40 flex-1">
                  <p className="font-bold">{t.name}</p>
                  <p className="text-sm text-stone-500">{t.reward_name ? `Wins a ${t.reward_name}` : t.tagline}</p>
                </div>
                <ActionForm action={saveBadgeTier} submitLabel="Save" variant="secondary" resetOnSuccess={false} className="flex items-center gap-2">
                  <input type="hidden" name="code" value={t.code} />
                  <input name="threshold" type="number" min={1} max={100000} defaultValue={t.threshold} required aria-label={`${t.name} points`} className={cx(inputClass, "w-28")} />
                </ActionForm>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Garden shop prices">
          <ul className="divide-y divide-line">
            {cfg.items.map((i) => (
              <li key={i.code} className={cx("flex flex-wrap items-center gap-3 py-3 first:pt-0", !i.active && "opacity-60")}>
                <ItemThumb item={i.code} size={48} />
                <div className="min-w-36 flex-1">
                  <p className="font-bold">{i.name}</p>
                  <p className="text-sm text-stone-500">{KIND[i.kind] ?? i.kind}</p>
                </div>
                {i.cost === null ? (
                  <span className="text-sm text-stone-500">Won with a badge</span>
                ) : (
                  <ActionForm action={saveGardenItem} submitLabel="Save" variant="secondary" resetOnSuccess={false} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="code" value={i.code} />
                    <input name="cost" type="number" min={1} max={100000} defaultValue={i.cost} required aria-label={`${i.name} price in points`} className={cx(inputClass, "w-28")} />
                    <label className="flex min-h-11 items-center gap-2 font-semibold">
                      <input type="checkbox" name="active" defaultChecked={i.active} className="h-5 w-5 accent-leaf-600" /> In the shop
                    </label>
                  </ActionForm>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
