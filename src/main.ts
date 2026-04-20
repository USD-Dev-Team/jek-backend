import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Request, Response, NextFunction, urlencoded, json } from 'express';
import express from 'express';
import { join } from 'path';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
async function bootstrap(): Promise<void> {
  // BigInt serialization fix
  (BigInt.prototype as any).toJSON = function () {
    return this.toString();
  };

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // main.ts
  app.use(json({ limit: '10kb' })); // Жуда катта JSON-ларни тақиқлаш
  app.use(urlencoded({ limit: '10kb', extended: true }));

  // Static files serving
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

  app.useGlobalFilters(new AllExceptionsFilter());

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3000);
  const nodeEnv = config.get<string>('NODE_ENV', 'development');

  const httpLogger = new Logger('HTTP');
  const appLogger = new Logger('Bootstrap');

  // CORS sozlamalari
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      skipMissingProperties: false,
    }),
  );

  // HTTP so'rovlarni log qilish uchun middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const color =
        res.statusCode >= 500
          ? '\x1b[31m' // Qizil
          : res.statusCode >= 400
            ? '\x1b[33m' // Sariq
            : res.statusCode >= 300
              ? '\x1b[36m' // Havorang
              : '\x1b[32m'; // Yashil

      httpLogger.log(
        `${color}${req.method}\x1b[0m ${req.originalUrl} → ${res.statusCode} (${duration}ms)`,
      );
    });

    next();
  });

  // Swagger sozlamalari
  const swaggerConfig = new DocumentBuilder()
    .setTitle('JEK Swagger API')
    .setDescription('JEK loyihasi uchun backend tizimi API hujjatlari')
    .setVersion('1.0.0')
    .addServer('https://api.usdsoft.uz/jek', 'Production')
    .addServer(`http://localhost:${port}`, 'Local')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Tokenni kiriting',
        in: 'header',
      },
      'token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('swagger', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
    },
  });

  appLogger.log(`📚 Swagger: http://localhost:${port}/swagger`);

  await app.listen(port);
  appLogger.log(`🚀 JEK [${nodeEnv}] started on port ${port}`);
}

bootstrap().catch((err: unknown) => {
  const logger = new Logger('Bootstrap');
  logger.error('❌ Failed to start application', err);
  process.exit(1);
});
