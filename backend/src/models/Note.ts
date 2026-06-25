import { Schema, model, models, type Model, type Types } from 'mongoose';

/**
 * Gift note (PRD §8.9, FR-36). A running list of separate, timestamped entries -
 * not one overwritable field. Private to the user/list (FR-37).
 */
export interface NoteDoc {
  _id: Types.ObjectId;
  person: Types.ObjectId;
  author: Types.ObjectId;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

const noteSchema = new Schema<NoteDoc>(
  {
    person: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

// Newest-first listing per person.
noteSchema.index({ person: 1, createdAt: -1 });

export const Note: Model<NoteDoc> =
  (models.Note as Model<NoteDoc>) || model<NoteDoc>('Note', noteSchema);
