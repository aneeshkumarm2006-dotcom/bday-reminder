import { redirect } from "next/navigation";

/**
 * The Upcoming feed merged into Reminders (now the home). `/dashboard` is kept as
 * a permanent redirect so old bookmarks and the marketing "Open app" link still
 * land somewhere sensible.
 */
export default function DashboardPage() {
  redirect("/reminders");
}
