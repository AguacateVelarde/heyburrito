import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class BurritoConfigSchema {
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Transform(({ value }) => (value ? parseInt(value, 10) : 0))
  MONTHLY_BURRITO_LIMIT?: number = 0; // 0 means no limit

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  ENABLE_LEADERBOARD?: boolean = true;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  ENABLE_MONTHLY_RESET?: boolean = false;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  SHOW_MONTHLY_LEADER?: boolean = false;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === '')
  SLACK_DEFAULT_CHANNEL?: string = '';

  @IsOptional()
  DEFAULT_LANGUAGE?: string = 'en';

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value !== 'false')
  ENABLE_BIRTHDAYS?: boolean = true;

  @IsString()
  @IsOptional()
  BIRTHDAY_CHANNEL?: string = '';

  @IsString()
  @IsOptional()
  BIRTHDAY_CRON?: string = '0 9 * * *';

  @IsString()
  @IsOptional()
  BIRTHDAY_TIMEZONE?: string = 'UTC';
}
