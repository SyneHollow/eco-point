import { Banner, Card } from "@/components/ui";
import { aiConfig } from "@/lib/ai";
import { fmtDay, weekStart } from "@/lib/dates";
import { getChallenges } from "@/lib/public-data";
import { requireTeacher } from "@/lib/session";
import { teacherClasses } from "@/lib/teacher-data";
import { AskBox, Challenges } from "./assistant";

export const metadata = { title: "Ask EcoPoints" };

export default async function AssistantPage() {
  const me = await requireTeacher();
  const week = weekStart(me.today);
  const [classes, published] = await Promise.all([teacherClasses(), getChallenges(week)]);
  const byClass = new Map(published.map((p) => [p.class_id, p.text]));
  const initial = classes.filter((c) => c.active).map((c) => ({ class_id: c.id, class_name: c.name, text: byClass.get(c.id) ?? "" }));
  const cfg = aiConfig();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-5xl font-extrabold">Ask EcoPoints</h1>
        <p className="mt-2 max-w-2xl text-stone-600">
          Ask questions about your classes in plain English, and let AI draft each class&apos;s weekly challenge from its weakest habit. Only
          class-level numbers are sent to the AI: there&apos;s no student data to send.
        </p>
      </div>
      {!cfg.ready && <Banner>AI isn&apos;t set up yet: the API key for {cfg.provider} is missing from the app&apos;s settings.</Banner>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Ask a question">
          <AskBox />
        </Card>
        <Card title={`Challenges for the week of ${fmtDay(week)}`}>
          <Challenges week={week} initial={initial} />
        </Card>
      </div>
    </div>
  );
}
