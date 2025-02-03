import { Module } from '@nestjs/common';
import { I18nService } from './i18n.service';
import { ConfigModule } from 'src/config/config.module';

@Module({
  providers: [I18nService],
  exports: [I18nService],
  imports: [ConfigModule],
})
export class I18nModule {}
