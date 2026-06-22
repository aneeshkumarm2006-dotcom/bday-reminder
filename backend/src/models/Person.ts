import { Schema, model, models, type Model, type Types } from 'mongoose';

import { dateParts, FEB29_RULES, type DateParts, type Feb29Rule } from './common';

/**
 * Person (PRD §7.2, FR-17). The individual whose event is tracked — human or
 * pet. Scoped to an owner and, optionally, one or more shared lists (Stage 8).
 * `createdBy`/`updatedBy` back the "last edited by" attribution (FR-45).
 */
export interface PersonDoc {
  _id: Types.ObjectId;
  owner: Types.ObjectId;
  lists: Types.ObjectId[];
  fullName: string;
  type: 'human' | 'pet';
  relationshipTag?: string;
  photoUrl?: string;
  dob: DateParts;
  feb29Rule: Feb29Rule;
  phone?: string;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const personSchema = new Schema<PersonDoc>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    lists: { type: [{ type: Schema.Types.ObjectId, ref: 'SharedList' }], default: () => [] },
    fullName: { type: String, required: true, trim: true },
    type: { type: String, enum: ['human', 'pet'], default: 'human' },
    relationshipTag: { type: String, trim: true },
    photoUrl: { type: String },
    dob: { type: dateParts(true), required: true },
    feb29Rule: { type: String, enum: FEB29_RULES, default: 'feb28' },
    phone: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

personSchema.index({ lists: 1 });

export const Person: Model<PersonDoc> =
  (models.Person as Model<PersonDoc>) || model<PersonDoc>('Person', personSchema);
