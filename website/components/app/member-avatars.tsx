import { Avatar } from "@/components/ui/avatar";
import type { ListMember } from "@/lib/api";

/** Overlapping avatar stack for a list's members (DESIGN.md §8). Caps at `max`. */
export function MemberAvatars({ members, max = 4 }: { members: ListMember[]; max?: number }) {
  const shown = members.slice(0, max);
  const overflow = members.length - shown.length;
  return (
    <div className="flex items-center">
      {shown.map((m, i) => (
        <span
          key={m.id}
          className="rounded-full ring-2 ring-surface"
          style={{ marginLeft: i === 0 ? 0 : -8 }}
          title={m.name}
        >
          <Avatar name={m.name} size={28} />
        </span>
      ))}
      {overflow > 0 && (
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-sunken text-xs font-medium text-ink-secondary ring-2 ring-surface"
          style={{ marginLeft: -8 }}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
