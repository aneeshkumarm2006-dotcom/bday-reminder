import { Schema, model, models, type Model, type Types } from 'mongoose';

/**
 * Refresh token record (auth implementation detail - not a PRD §7 entity).
 * The refresh JWT carries a `jti`; we persist that id so a token can be rotated
 * (deleted + reissued on refresh) and revoked (deleted on logout). A TTL index
 * lets Mongo reap expired rows automatically.
 */
export interface RefreshTokenDoc {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  jti: string;
  expiresAt: Date;
  createdAt: Date;
}

const refreshTokenSchema = new Schema<RefreshTokenDoc>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    jti: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken: Model<RefreshTokenDoc> =
  (models.RefreshToken as Model<RefreshTokenDoc>) ||
  model<RefreshTokenDoc>('RefreshToken', refreshTokenSchema);
