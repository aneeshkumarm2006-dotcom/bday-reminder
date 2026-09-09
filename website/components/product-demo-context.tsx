"use client";

import * as React from "react";

import { DEFAULT_SETTINGS } from "@/lib/content/defaults";
import type { ProductDemoConfig } from "@/lib/content/types";

/**
 * The sample data behind the rendered product shots.
 *
 * `AppPreview`, `ReminderPreview` and `WidgetPreview` are client components
 * rendered from a dozen places — the homepage hero, every feature row, every
 * keyword page's hero. Threading a config prop through all of that would touch
 * each of those call sites for no benefit, so the marketing shell provides it
 * once and the previews read it here.
 *
 * The default is the copy that shipped, so a preview rendered outside the shell
 * (an admin preview route, a Storybook-style page) looks exactly as it always
 * did rather than blank.
 */
const ProductDemoContext = React.createContext<ProductDemoConfig>(
  DEFAULT_SETTINGS.productDemo,
);

export function ProductDemoProvider({
  demo,
  children,
}: {
  demo: ProductDemoConfig;
  children: React.ReactNode;
}) {
  return <ProductDemoContext.Provider value={demo}>{children}</ProductDemoContext.Provider>;
}

export function useProductDemo(): ProductDemoConfig {
  const demo = React.useContext(ProductDemoContext);
  // An admin who deletes every row would otherwise ship an empty card. The demo
  // is decoration with a job — it has to show *something*.
  return demo.rows.length > 0 ? demo : DEFAULT_SETTINGS.productDemo;
}

/** The right-hand count for a row: "Today", or "in 3 days" from `inDaysLabel`. */
export function demoCount(demo: ProductDemoConfig, offset: number): string {
  if (offset <= 0) return demo.todayLabel;
  return demo.inDaysLabel.replace("{n}", String(offset));
}
