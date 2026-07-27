import { createElement } from "react";

import { iconFor } from "@/lib/content/icons";

/**
 * Renders a lucide icon by its stored *name*.
 *
 * Content stores icon names, not components (a component can't live in Mongo).
 * Resolving the name to a component and assigning it to a capitalised local —
 * `const Icon = iconFor(name)` — reads as "declare a component during render",
 * which resets state on every render and is exactly what the React compiler's
 * static-components rule warns about. Going through `createElement` keeps the
 * lookup a plain value, and this one component is the single place it happens.
 */
export function ContentIcon({
  name,
  size = 20,
  className,
}: {
  name: string | undefined | null;
  size?: number;
  className?: string;
}) {
  return createElement(iconFor(name), { size, className, "aria-hidden": "true" });
}
