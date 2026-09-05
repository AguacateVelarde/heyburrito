import {
  IsBoolean,
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

  /**
   * Post the greeting straight away when the birthday being saved is today.
   * The daily cron only fires once, so without this a birthday added after
   * that hour would go unnoticed until next year.
   */
  @IsOptional()
  @IsBoolean()
  announceIfToday?: boolean;
}
