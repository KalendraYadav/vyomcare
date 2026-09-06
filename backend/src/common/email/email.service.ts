import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

export interface SendVerificationEmailOptions {
  email: string;
  name: string;
  rawToken: string;
  appBaseUrl?: string;
}

export function extractRequestBaseUrl(req?: any): string | undefined {
  if (!req || !req.headers) return undefined;

  // 1. Check Origin header (sent by browsers on POST)
  const origin = req.headers['origin'] as string;
  if (origin && !origin.includes('localhost:3001') && !origin.includes('127.0.0.1:3001')) {
    return origin.replace(/\/+$/, '');
  }

  // 2. Check X-Forwarded-Host + X-Forwarded-Proto (from Nginx / Cloudflare)
  const forwardedHost = req.headers['x-forwarded-host'] as string;
  const forwardedProto = (req.headers['x-forwarded-proto'] as string) || 'https';
  if (forwardedHost) {
    const host = forwardedHost.split(',')[0].trim();
    return `${forwardedProto}://${host}`.replace(/\/+$/, '');
  }

  // 3. Check Referer header
  const referer = req.headers['referer'] as string;
  if (referer) {
    try {
      const url = new URL(referer);
      if (!url.host.includes('localhost:3001') && !url.host.includes('127.0.0.1:3001')) {
        return `${url.protocol}//${url.host}`;
      }
    } catch {}
  }

  // 4. Check Host header
  const host = req.headers['host'] as string;
  if (host && !host.startsWith('127.0.0.1:3001') && !host.startsWith('localhost:3001') && !host.startsWith('backend:')) {
    const proto = host.includes('trycloudflare.com')
      ? 'https'
      : (req.headers['x-forwarded-proto'] as string) || (req.secure ? 'https' : 'http');
    return `${proto}://${host}`.replace(/\/+$/, '');
  }

  return undefined;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

  private getActiveTunnelUrl(): string | undefined {
    try {
      const candidates = [
        path.resolve(process.cwd(), '../tunnellink.txt'),
        path.resolve(process.cwd(), 'tunnellink.txt'),
        '/app/tunnellink.txt',
      ];
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          const content = fs.readFileSync(candidate, 'utf-8').trim();
          if (content.startsWith('http://') || content.startsWith('https://')) {
            return content.split('\n')[0].trim();
          }
        }
      }
    } catch {
      // Ignore
    }
    return undefined;
  }

  /**
   * Dispatches an account verification email.
   * In hackathon/local development, outputs clear console logs containing the cryptographic verification link.
   * In production, this can seamlessly route to an SMTP/SES/Resend transactional provider.
   */
  async sendVerificationEmail(options: SendVerificationEmailOptions): Promise<{ success: boolean; verificationUrl: string }> {
    const rawOrigin =
      options.appBaseUrl ||
      this.config.get<string>('APP_BASE_URL') ||
      this.config.get<string>('PUBLIC_APP_URL') ||
      this.getActiveTunnelUrl() ||
      this.config.get<string>('CORS_ORIGIN')?.split(',')[0] ||
      'http://localhost:3000';

    const baseUrl = rawOrigin.replace(/\/+$/, '');
    const verificationUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(options.rawToken)}`;

    // Controlled development & hackathon dispatch output
    this.logger.log(`
════════════════════════════════════════════════════════════════════════════
📧 [EMAIL DISPATCH] Account Verification Request
────────────────────────────────────────────────────────────────────────────
Recipient:   ${options.name} <${options.email}>
Subject:     Verify your BioTrack / VyomCare Account
Action:      Click the link below to verify email ownership:

${verificationUrl}

Expires:     24 hours
════════════════════════════════════════════════════════════════════════════
`);

    return {
      success: true,
      verificationUrl,
    };
  }
}
