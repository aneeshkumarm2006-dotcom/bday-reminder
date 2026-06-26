import { Schema, model, models, type Model, type Types } from 'mongoose';

/**
 * Shared list (PRD §7.5, §8.11). Members see the same people/events and can all
 * edit them; everyone keeps their own notification settings (FR-44). The owner
 * administers the list (invites, renaming, removing members, deletion).
 */

export interface ListMember {
  user: Types.ObjectId;
}

export interface SharedListDoc {
  _id: Types.ObjectId;
  name: string;
  owner: Types.ObjectId;
  members: ListMember[];
  createdAt: Date;
  updatedAt: Date;
}

const memberSchema = new Schema<ListMember>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { _id: false },
);

const sharedListSchema = new Schema<SharedListDoc>(
  {
    name: { type: String, required: true, trim: true },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    members: { type: [memberSchema], default: () => [] },
  },
  { timestamps: true },
);

sharedListSchema.index({ 'members.user': 1 });

export const SharedList: Model<SharedListDoc> =
  (models.SharedList as Model<SharedListDoc>) ||
  model<SharedListDoc>('SharedList', sharedListSchema);
