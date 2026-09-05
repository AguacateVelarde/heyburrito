import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpsertBirthdayDto {
  @IsString()
  @IsNotEmpty()
  slackId: string;

  @IsInt()
  @Min(1)
  @Max(31)
  day: number;

  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsOptional()
  @IsInt()
  @Min(1900)
  year?: number;

  @IsOptional()
  @IsString()
  name?: string;

  /** Optional channel override for this person's greeting. */
  @IsOptional()
  @IsString()
  channelId?: string;
}
