import { Schema, model, models, type Model, type Types } from "mongoose";

import type { EntityType, LandingVariant, LegalDocKey, PageStatus } from "./types";

/**
 * Mongoose models for admin-managed site content. Same HMR-safe
 * `models.X || model(...)` pattern as `lib/blog/models.ts` (without it, dev hot
 * reload throws OverwriteModelError), on the same connection (`lib/blog/db.ts`).
 *
 * Polymorphic content — landing sections, page blocks — is stored as `Mixed`:
 * the shape varies by `type` and Zod (`lib/content/validation.ts`) is the real
 * gatekeeper on write, while `deepMerge` over the typed defaults is the
 * gatekeeper on read. Mongoose's own casting would only get in the way.
 *
 * Singletons carry a fixed `key: "singleton"` with a unique index and are
 * written through `findOneAndUpdate(..., { upsert: true })`.
 */

const SINGLETON = "singleton";

/* ------------------------------ SiteSettings ------------------------------ */

export interface SiteSettingsDoc {
  _id: Types.ObjectId;
  key: string;
  identity: Record<string, unknown>;
  seo: Record<string, unknown>;
  analytics: Record<string, unknown>;
  socials: unknown[];
  announcement: Record<string, unknown>;
  robotsExtraDisallows: string[];
  llmsTxtEnabled: boolean;
  structuredData: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const siteSettingsSchema = new Schema<SiteSettingsDoc>(
  {
    key: { type: String, required: true, unique: true, default: SINGLETON },
    identity: { type: Schema.Types.Mixed, default: () => ({}) },
    seo: { type: Schema.Types.Mixed, default: () => ({}) },
    analytics: { type: Schema.Types.Mixed, default: () => ({}) },
    socials: { type: [Schema.Types.Mixed], default: () => [] },
    announcement: { type: Schema.Types.Mixed, default: () => ({}) },
    robotsExtraDisallows: { type: [String], default: () => [] },
    llmsTxtEnabled: { type: Boolean, default: false },
    structuredData: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true, minimize: false },
);

export const SiteSettingsModel: Model<SiteSettingsDoc> =
  (models.SiteSettings as Model<SiteSettingsDoc>) ||
  model<SiteSettingsDoc>("SiteSettings", siteSettingsSchema);

/* -------------------------------- PageMeta -------------------------------- */

export interface PageMetaDoc {
  _id: Types.ObjectId;
  path: string;
  title: string;
  description: string;
  keywords: string[];
  canonical: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  twitterTitle: string;
  twitterDescription: string;
  noindex: boolean;
  nofollow: boolean;
  sitemap: Record<string, unknown>;
  customJsonLd: string;
  createdAt: Date;
  updatedAt: Date;
}

const pageMetaSchema = new Schema<PageMetaDoc>(
  {
    path: { type: String, required: true, unique: true, trim: true },
    title: { type: String, default: "", trim: true },
    description: { type: String, default: "", trim: true },
    keywords: { type: [String], default: () => [] },
    canonical: { type: String, default: "", trim: true },
    ogTitle: { type: String, default: "", trim: true },
    ogDescription: { type: String, default: "", trim: true },
    ogImage: { type: String, default: "", trim: true },
    twitterTitle: { type: String, default: "", trim: true },
    twitterDescription: { type: String, default: "", trim: true },
    noindex: { type: Boolean, default: false },
    nofollow: { type: Boolean, default: false },
    sitemap: { type: Schema.Types.Mixed, default: () => ({}) },
    customJsonLd: { type: String, default: "" },
  },
  { timestamps: true, minimize: false },
);

export const PageMetaModel: Model<PageMetaDoc> =
  (models.PageMeta as Model<PageMetaDoc>) ||
  model<PageMetaDoc>("PageMeta", pageMetaSchema);

/* ------------------------------ LandingContent ---------------------------- */

export interface LandingContentDoc {
  _id: Types.ObjectId;
  key: string;
  draft: LandingVariant;
  published: LandingVariant;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const landingContentSchema = new Schema<LandingContentDoc>(
  {
    key: { type: String, required: true, unique: true, default: SINGLETON },
    draft: { type: Schema.Types.Mixed, default: () => ({ sections: [] }) },
    published: { type: Schema.Types.Mixed, default: () => ({ sections: [] }) },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true, minimize: false },
);

export const LandingContentModel: Model<LandingContentDoc> =
  (models.LandingContent as Model<LandingContentDoc>) ||
  model<LandingContentDoc>("LandingContent", landingContentSchema);

/* -------------------------------- SitePage -------------------------------- */

export interface SitePageDoc {
  _id: Types.ObjectId;
  title: string;
  slug: string;
  status: PageStatus;
  publishedAt: Date | null;
  /** `Mixed[]` at the schema level — the real shape is `PageBlock[]`, enforced
   *  by Zod on write and by the block renderer's type map on read. */
  blocks: unknown[];
  showInSitemap: boolean;
  author: string;
  createdAt: Date;
  updatedAt: Date;
}

const sitePageSchema = new Schema<SitePageDoc>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    status: { type: String, enum: ["draft", "published"], default: "draft", index: true },
    publishedAt: { type: Date, default: null },
    blocks: { type: [Schema.Types.Mixed], default: () => [] },
    showInSitemap: { type: Boolean, default: true },
    author: { type: String, default: "", trim: true },
  },
  { timestamps: true, minimize: false },
);

// Public read-gate: published pages, newest first.
sitePageSchema.index({ status: 1, publishedAt: -1 });

export const SitePageModel: Model<SitePageDoc> =
  (models.SitePage as Model<SitePageDoc>) ||
  model<SitePageDoc>("SitePage", sitePageSchema);

/* ----------------------------- NavigationConfig --------------------------- */

export interface NavigationConfigDoc {
  _id: Types.ObjectId;
  key: string;
  header: Record<string, unknown>;
  footer: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const navigationConfigSchema = new Schema<NavigationConfigDoc>(
  {
    key: { type: String, required: true, unique: true, default: SINGLETON },
    header: { type: Schema.Types.Mixed, default: () => ({}) },
    footer: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true, minimize: false },
);

export const NavigationConfigModel: Model<NavigationConfigDoc> =
  (models.NavigationConfig as Model<NavigationConfigDoc>) ||
  model<NavigationConfigDoc>("NavigationConfig", navigationConfigSchema);

/* -------------------------------- LegalDoc -------------------------------- */

export interface LegalDocDoc {
  _id: Types.ObjectId;
  key: LegalDocKey;
  title: string;
  intro: string;
  updated: string;
  html: string;
  createdAt: Date;
  updatedAt: Date;
}

const legalDocSchema = new Schema<LegalDocDoc>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      enum: ["privacy", "terms", "contact"],
    },
    title: { type: String, default: "", trim: true },
    intro: { type: String, default: "", trim: true },
    updated: { type: String, default: "", trim: true },
    html: { type: String, default: "" },
  },
  { timestamps: true, minimize: false },
);

export const LegalDocModel: Model<LegalDocDoc> =
  (models.LegalDoc as Model<LegalDocDoc>) ||
  model<LegalDocDoc>("LegalDoc", legalDocSchema);

/* -------------------------------- Redirect -------------------------------- */

export interface RedirectDoc {
  _id: Types.ObjectId;
  from: string;
  to: string;
  type: 301 | 302;
  enabled: boolean;
  note: string;
  hits: number;
  lastHitAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const redirectSchema = new Schema<RedirectDoc>(
  {
    from: { type: String, required: true, unique: true, trim: true },
    to: { type: String, required: true, trim: true },
    type: { type: Number, enum: [301, 302], default: 301 },
    enabled: { type: Boolean, default: true },
    note: { type: String, default: "", trim: true },
    hits: { type: Number, default: 0 },
    lastHitAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const RedirectModel: Model<RedirectDoc> =
  (models.Redirect as Model<RedirectDoc>) ||
  model<RedirectDoc>("Redirect", redirectSchema);

/* ------------------------------ NotFoundHit ------------------------------- */

export interface NotFoundHitDoc {
  _id: Types.ObjectId;
  path: string;
  count: number;
  lastSeenAt: Date;
  referrer: string;
}

const notFoundHitSchema = new Schema<NotFoundHitDoc>({
  path: { type: String, required: true, unique: true, trim: true },
  count: { type: Number, default: 1 },
  lastSeenAt: { type: Date, default: () => new Date() },
  referrer: { type: String, default: "", trim: true },
});

notFoundHitSchema.index({ count: -1 });

export const NotFoundHitModel: Model<NotFoundHitDoc> =
  (models.NotFoundHit as Model<NotFoundHitDoc>) ||
  model<NotFoundHitDoc>("NotFoundHit", notFoundHitSchema);

/* ----------------------------- ContentRevision ---------------------------- */

export interface ContentRevisionDoc {
  _id: Types.ObjectId;
  entityType: EntityType;
  entityId: string;
  snapshot: unknown;
  savedBy: string;
  createdAt: Date;
}

const contentRevisionSchema = new Schema<ContentRevisionDoc>({
  entityType: { type: String, required: true, index: true },
  entityId: { type: String, required: true, default: "singleton" },
  snapshot: { type: Schema.Types.Mixed, default: null },
  savedBy: { type: String, default: "", trim: true },
  createdAt: { type: Date, default: () => new Date() },
});

// Newest-first per entity — the revision browser and the prune-to-50 both use it.
contentRevisionSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

export const ContentRevisionModel: Model<ContentRevisionDoc> =
  (models.ContentRevision as Model<ContentRevisionDoc>) ||
  model<ContentRevisionDoc>("ContentRevision", contentRevisionSchema);

/* --------------------------------- AuditLog ------------------------------- */

export interface AuditLogDoc {
  _id: Types.ObjectId;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  editor: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<AuditLogDoc>({
  action: { type: String, required: true, trim: true },
  entityType: { type: String, required: true, trim: true },
  entityId: { type: String, default: "", trim: true },
  summary: { type: String, default: "", trim: true },
  editor: { type: String, default: "", trim: true },
  createdAt: { type: Date, default: () => new Date(), index: true },
});

export const AuditLogModel: Model<AuditLogDoc> =
  (models.AuditLog as Model<AuditLogDoc>) ||
  model<AuditLogDoc>("AuditLog", auditLogSchema);

export { SINGLETON };
