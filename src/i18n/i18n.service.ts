import { Injectable } from '@nestjs/common';
import { en } from './translations/en';
import { es } from './translations/es';
import { ConfigService } from 'src/config/config.service';

type TranslationKey = string;
type TranslationParams = Record<string, string | number>;

@Injectable()
export class I18nService {
  private translations = {
    en,
    es,
  };

  constructor(private readonly configService: ConfigService) {}

  private get defaultLanguage(): string {
    return this.configService.defaultLanguage;
  }

  translate(
    key: TranslationKey,
    params?: TranslationParams,
    language?: string,
  ): string {
    const lang = language || this.defaultLanguage;
    const translation = this.getNestedTranslation(this.translations[lang], key);

    if (!translation) {
      return key;
    }

    return this.interpolateParams(translation, params || {});
  }

  private getNestedTranslation(obj: any, path: string): string | undefined {
    return path.split('.').reduce((prev, curr) => {
      return prev ? prev[curr] : undefined;
    }, obj);
  }

  private interpolateParams(text: string, params: TranslationParams): string {
    return Object.entries(params).reduce((result, [key, value]) => {
      return result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
    }, text);
  }
}
