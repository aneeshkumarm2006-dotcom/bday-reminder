import { Schema, model, models, type Model, type Types } from "mongoose";

import type {
  KeywordRel,
  LinkOccurrences,
  PostStatus,
  TemplateKey,
} from "./types";

export interface KeywordSub {
  keyword: string;
  url: string;
  rel: KeywordRel;
}

export interface PostDoc {
  _id: Types.ObjectId;
  title: string;
  slug: string;
  template: TemplateKey;
  body: string;
  excerpt: string;
  metaTitle: string;
  coverImage: string;
  coverImageAlt: string;
  keywords: KeywordSub[];
  linkOccurrences: LinkOccurrences;
  status: PostStatus;
  author: string;
  views: number;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const keywordSchema = new Schema<KeywordSub>(
  {
    keyword: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    rel: {
      type: String,
      enum: ["dofollow", "nofollow", "sponsored"],
      default: "dofollow",
    },
  },
  { _id: false },
);

const postSchema = new Schema<PostDoc>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    template: {
      type: String,
      enum: ["how-to", "listicle", "comparison", "review", "news", "generic"],
      default: "generic",
    },
    body: { type: String, default: "" },
    excerpt: { type: String, default: "", trim: true },
    metaTitle: { type: String, default: "", trim: true },
    coverImage: { type: String, default: "" },
    coverImageAlt: { type: String, default: "", trim: true },
    keywords: { type: [keywordSchema], default: () => [] },
    linkOccurrences: { type: String, enum: ["first", "all"], default: "first" },
    status: { type: String, enum: ["draft", "published"], default: "draft", index: true },
    author: { type: String, default: "", trim: true },
    views: { type: Number, default: 0 },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Published feed, newest first.
postSchema.index({ status: 1, publishedAt: -1 });

export const Post: Model<PostDoc> =
  (models.Post as Model<PostDoc>) || model<PostDoc>("Post", postSchema);

/**
 * A Cloudinary image asset tracked for the Media library. Populated by a Sync
 * (Admin-API list of the upload folder) and by new uploads. Usage/alt are NOT
 * stored here — they're derived live from posts (alt lives in the post HTML).
 */
export interface BlogImageDoc {
  _id: Types.ObjectId;
  publicId: string;
  secureUrl: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
  tags: string[];
  cloudinaryCreatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const blogImageSchema = new Schema<BlogImageDoc>(
  {
    publicId: { type: String, required: true, unique: true, trim: true },
    secureUrl: { type: String, required: true, trim: true },
    format: { type: String, default: "", trim: true },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    bytes: { type: Number, default: 0 },
    tags: { type: [String], default: () => [] },
    cloudinaryCreatedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const BlogImage: Model<BlogImageDoc> =
  (models.BlogImage as Model<BlogImageDoc>) ||
  model<BlogImageDoc>("BlogImage", blogImageSchema);
