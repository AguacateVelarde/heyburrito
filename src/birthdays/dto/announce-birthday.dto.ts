import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class AnnounceBirthdayDto {
  /** Overrides the configured birthday channel. */
  @IsOptional()
  @IsString()
  channel?: string;

  /** Greets again even if the greeting was already sent this year. */
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
