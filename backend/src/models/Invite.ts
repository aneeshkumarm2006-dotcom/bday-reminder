import { Schema, model, models, type Model, type Types } from 'mongoose';

/**
 * Invite to a shared list (PRD FR-41/42). Members must explicitly accept before
 * gaining access - no silent adds. The token is the accept link's secret.
 */

export type InviteStatus = 'pending' | 'accepted';

export interface InviteDoc {
  _id: Types.ObjectId;
  list: Types.ObjectId;
  invitedEmailOrPhone: string;
  token: string;
  status: InviteStatus;
  invitedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const inviteSchema = new Schema<InviteDoc>(
  {
    list: { type: Schema.Types.ObjectId, ref: 'SharedList', required: true, index: true },
    invitedEmailOrPhone: { type: String, required: true, trim: true },
    token: { type: String, required: true, unique: true },
    status: { type: String, enum: ['pending', 'accepted'], default: 'pending' },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

export const Invite: Model<InviteDoc> =
  (models.Invite as Model<InviteDoc>) || model<InviteDoc>('Invite', inviteSchema);
