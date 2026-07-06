/**
 * Users source — a read-only view of the app's real `users` collection (backend-
 * owned; the website shares the Mongo cluster). Registers a guarded model pointed
 * at `users` (same pattern as lib/sms/stats.ts) and reports zero-filled daily
 * signups, the overall total, and the 10 most-recent signups. No credential is
 * needed: it is "connected" whenever MONGODB_URI is set.
 */
import mongoose, { Schema, type Model } from "mongoose";

import { connectDb } from "@/lib/blog/db";
import { addDays, parseDay, previousRange, zeroFillSeries, type DateRange } from "../dates";
import type { DetailTable, SourceResult } from "../types";

interface UserView {
  name?: string;
  email?: string;
  createdAt: Date;
}

// `strict: false` lets us read the real documents while only declaring the few
// fields we touch; `collection: "users"` binds to the backend-owned collection.
const userViewSchema = new Schema<UserView>(
  { name: String, email: String },
  { timestamps: true, collection: "users", strict: false },
);

const AnalyticsHubUser: Model<UserView> =
  (mongoose.models.AnalyticsHubUser as Model<UserView>) ||
  mongoose.model<UserView>("AnalyticsHubUser", userViewSchema);

export async function fetchUsers(range: DateRange): Promise<SourceResult> {
  await connectDb();
  const prev = previousRange(range);
  const start = parseDay(range.from);
  const end = parseDay(addDays(range.to, 1)); // exclusive upper bound
  const prevStart = parseDay(prev.from);
  const prevEnd = parseDay(addDays(prev.to, 1));

  const [dailyRows, total, prevCount, recent] = await Promise.all([
    AnalyticsHubUser.aggregate<{ _id: string; n: number }>([
      { $match: { createdAt: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" } },
          n: { $sum: 1 },
        },
      },
    ]),
    AnalyticsHubUser.estimatedDocumentCount(),
    AnalyticsHubUser.countDocuments({ createdAt: { $gte: prevStart, $lt: prevEnd } }),
    AnalyticsHubUser.find({}, { name: 1, email: 1, createdAt: 1 })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean<Array<{ name?: string; email?: string; createdAt?: Date }>>(),
  ]);

  const byDay = new Map<string, number>();
  for (const row of dailyRows) byDay.set(row._id, row.n);
  const series = zeroFillSeries("users", "signups", range, byDay);
  const rangeSignups = Array.from(byDay.values()).reduce((a, b) => a + b, 0);

  const recentTable: DetailTable = {
    key: "recentSignups",
    title: "Recent signups",
    columns: [
      { key: "name", label: "Name" },
      { key: "email", label: "Email" },
      { key: "createdAt", label: "Joined", format: "date", numeric: true },
    ],
    rows: recent.map((u) => ({
      name: u.name ?? "—",
      email: u.email ?? "—",
      createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : "",
    })),
  };

  return {
    source: "users",
    status: "ok",
    series,
    totals: { signups: rangeSignups, totalUsers: total },
    previous: { signups: prevCount },
    detail: [recentTable],
  };
}
