// One icon family (Phosphor, "bold" weight) for the whole app. Per-file imports keep bundles small;
// the /ssr build has no React context, so it works in server and client components alike.
import type { Icon as PhosphorIcon } from "@phosphor-icons/react/dist/lib/types";
import { CheckIcon } from "@phosphor-icons/react/dist/ssr/Check";
import { XIcon } from "@phosphor-icons/react/dist/ssr/X";
import { FlagIcon } from "@phosphor-icons/react/dist/ssr/Flag";
import { CameraIcon } from "@phosphor-icons/react/dist/ssr/Camera";
import { TrophyIcon } from "@phosphor-icons/react/dist/ssr/Trophy";
import { PrinterIcon } from "@phosphor-icons/react/dist/ssr/Printer";
import { GearIcon } from "@phosphor-icons/react/dist/ssr/Gear";
import { SquaresFourIcon } from "@phosphor-icons/react/dist/ssr/SquaresFour";
import { ListChecksIcon } from "@phosphor-icons/react/dist/ssr/ListChecks";
import { ChatCircleTextIcon } from "@phosphor-icons/react/dist/ssr/ChatCircleText";
import { SignOutIcon } from "@phosphor-icons/react/dist/ssr/SignOut";
import { TelevisionIcon } from "@phosphor-icons/react/dist/ssr/Television";
import { CalendarCheckIcon } from "@phosphor-icons/react/dist/ssr/CalendarCheck";
import { UsersThreeIcon } from "@phosphor-icons/react/dist/ssr/UsersThree";
import { ScanIcon } from "@phosphor-icons/react/dist/ssr/Scan";
import { WarningIcon } from "@phosphor-icons/react/dist/ssr/Warning";
import { InfoIcon } from "@phosphor-icons/react/dist/ssr/Info";
import { PlusIcon } from "@phosphor-icons/react/dist/ssr/Plus";
import { MinusIcon } from "@phosphor-icons/react/dist/ssr/Minus";
import { ArrowClockwiseIcon } from "@phosphor-icons/react/dist/ssr/ArrowClockwise";
import { KeyIcon } from "@phosphor-icons/react/dist/ssr/Key";
import { ClipboardTextIcon } from "@phosphor-icons/react/dist/ssr/ClipboardText";
import { StarIcon } from "@phosphor-icons/react/dist/ssr/Star";
import { RankingIcon } from "@phosphor-icons/react/dist/ssr/Ranking";
import { ListIcon } from "@phosphor-icons/react/dist/ssr/List";
import { LockSimpleIcon } from "@phosphor-icons/react/dist/ssr/LockSimple";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr/CheckCircle";
import { ClockIcon } from "@phosphor-icons/react/dist/ssr/Clock";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr/ArrowLeft";

export type IconName = keyof typeof ICONS;

const ICONS = {
  check: CheckIcon,
  x: XIcon,
  flag: FlagIcon,
  camera: CameraIcon,
  trophy: TrophyIcon,
  printer: PrinterIcon,
  gear: GearIcon,
  dashboard: SquaresFourIcon,
  checklist: ListChecksIcon,
  chat: ChatCircleTextIcon,
  signOut: SignOutIcon,
  tv: TelevisionIcon,
  calendar: CalendarCheckIcon,
  users: UsersThreeIcon,
  scan: ScanIcon,
  warning: WarningIcon,
  info: InfoIcon,
  plus: PlusIcon,
  minus: MinusIcon,
  refresh: ArrowClockwiseIcon,
  key: KeyIcon,
  records: ClipboardTextIcon,
  star: StarIcon,
  ranking: RankingIcon,
  menu: ListIcon,
  lock: LockSimpleIcon,
  done: CheckCircleIcon,
  clock: ClockIcon,
  back: ArrowLeftIcon,
} satisfies Record<string, PhosphorIcon>;

/** Decorative by default (hidden from screen readers). Pass `label` when the icon carries meaning on its own. */
export function Icon({
  name,
  size = 20,
  label,
  weight = "bold",
  className,
}: {
  name: IconName;
  size?: number;
  label?: string;
  weight?: "regular" | "bold" | "fill" | "duotone";
  className?: string;
}) {
  const C = ICONS[name];
  return label ? (
    <C size={size} weight={weight} className={className} role="img" aria-label={label} />
  ) : (
    <C size={size} weight={weight} className={className} aria-hidden="true" focusable="false" />
  );
}
