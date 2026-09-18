import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';

// ─── Startup environment validation ──────────────────────────────────────────
// Fail fast with a clear message if critical configuration is missing.
const REQUIRED_ENV: string[] = [
  'DATABASE_URL',
  'JWT_SECRET',
  'REFRESH_TOKEN_SECRET',
  'REDIS_URL',
];

function validateEnvironment(): void {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error('\n❌ MISSING REQUIRED ENVIRONMENT VARIABLES:');
    missing.forEach((key) => console.error(`   - ${key}`));
    console.error(
      '\n   Copy backend/.env.example → backend/.env and fill in all values.',
    );
    console.error('   See the project README for setup instructions.\n');
    process.exit(1);
  }
}

async function bootstrap() {
  validateEnvironment();

  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  // Security
  app.use(helmet());
  app.use(cookieParser());

  // CORS — allows localhost, 127.0.0.1, and dynamic Cloudflare Quick Tunnel origins
  const rawCorsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
  const configuredOrigins = rawCorsOrigin.split(',').map((o) => o.trim());
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. server rewrites, mobile apps, curl)
      if (!origin) return callback(null, true);

      if (configuredOrigins.includes(origin)) return callback(null, true);

      try {
        const parsed = new URL(origin);
        if (
          parsed.hostname === 'localhost' ||
          parsed.hostname === '127.0.0.1' ||
          parsed.hostname === '[::1]' ||
          parsed.hostname.endsWith('.trycloudflare.com')
        ) {
          return callback(null, true);
        }
      } catch {
        // invalid URL
      }

      return callback(null, false);
    },
    credentials: true,
  });

  // Global validation pipeline
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3001;
  const host = process.env.HOST || '0.0.0.0';
  await app.listen(port, host);
  console.log(`🚀 BioTrack API running on ${host}:${port} (/api)`);
  console.log(`   NODE_ENV:    ${process.env.NODE_ENV}`);
  console.log(`   CORS origin: ${rawCorsOrigin}`);
}

bootstrap();
