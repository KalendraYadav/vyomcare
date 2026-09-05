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

  // CORS — uses CORS_ORIGIN env var (falls back to localhost for convenience)
  // Development: http://localhost:3000
  // Production:  set CORS_ORIGIN to your production frontend URL (or comma-separated URLs)
  const rawCorsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
  const corsOrigin = rawCorsOrigin.includes(',')
    ? rawCorsOrigin.split(',').map((o) => o.trim())
    : rawCorsOrigin;
  app.enableCors({
    origin: corsOrigin,
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
  await app.listen(port);
  console.log(`🚀 BioTrack API running on http://localhost:${port}/api`);
  console.log(`   NODE_ENV:    ${process.env.NODE_ENV}`);
  console.log(`   CORS origin: ${corsOrigin}`);
}

bootstrap();
