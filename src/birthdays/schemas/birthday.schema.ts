import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Birthday extends Document {
  @Prop({ required: true, unique: true, index: true })
  slackId: string;

  @Prop({ required: false })
  name: string;

  @Prop({ required: true, min: 1, max: 31 })
  day: number;

  @Prop({ required: true, min: 1, max: 12 })
  month: number;

  /** Optional: only stored when the user shares the birth year, used to show the age. */
  @Prop({ required: false, min: 1900 })
  year: number;

  /** Optional per-user channel override. Falls back to the configured birthday channel. */
  @Prop({ required: false })
  channelId: string;

  @Prop({ default: true })
  active: boolean;

  /** Year of the last greeting, used to avoid greeting the same person twice. */
  @Prop({ required: false })
  lastGreetedYear: number;

  @Prop({ required: false })
  lastGreetedAt: Date;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const BirthdaySchema = SchemaFactory.createForClass(Birthday);

BirthdaySchema.index({ month: 1, day: 1 });
