import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import helmet from 'helmet';
import * as compression from 'compression';
import { join } from 'path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { winstonConfig } from './common/config/logger.config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: WinstonModule.createLogger(winstonConfig),
  });
  const config = app.get(ConfigService);
  const env = config.get<string>('NODE_ENV', 'development');
  const uploadDir = config.get<string>('UPLOAD_DIR', 'uploads');

  app.use(
    helmet({
      contentSecurityPolicy: env === 'production',
    }),
  );
  app.use(compression());

  app.useStaticAssets(join(process.cwd(), uploadDir), { prefix: '/uploads/' });

  app.setGlobalPrefix('v1', {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'ready', method: RequestMethod.GET },
    ],
  });

  const origins = config.get<string>('CORS_ORIGINS', '*');
  app.enableCors({
    origin: origins === '*' ? true : origins.split(',').map((s) => s.trim()),
  });

  app.enableShutdownHooks();
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  if (env !== 'production') {
    const swagger = new DocumentBuilder()
      .setTitle('Moveitz API')
      .setDescription('Client + trainer marketplace backend')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));
  }

  const host = config.get<string>('HOST', '0.0.0.0');
  const port = config.get<number>('PORT', 3000);
  await app.listen(port, host);
}

bootstrap();
