import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const logger = new Logger('HTTP');

  app.useGlobalPipes(new ValidationPipe());

  // Add HTTP request logging middleware
  app.use((req, res, next) => {
    const startTime = Date.now();
    const oldEnd = res.end;

    res.end = function (...args) {
      const responseTime = Date.now() - startTime;
      const statusCode = res.statusCode;
      logger.log(
        `${req.method} ${req.originalUrl} ${statusCode} ${responseTime}ms`,
      );
      oldEnd.apply(res, args);
    };

    next();
  });

  // Serve static files from the admin UI directory
  app.useStaticAssets(path.join(__dirname, '..', 'ui'));

  await app.listen(3000);
}
bootstrap();
