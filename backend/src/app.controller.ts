import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('tunnel-url')
  getTunnelUrl() {
    let tunnelUrl = process.env.CLOUDFLARE_TUNNEL_URL || '';
    if (!tunnelUrl) {
      try {
        const fs = require('fs');
        const path = require('path');
        const candidatePaths = [
          path.resolve(process.cwd(), 'tunnellink.txt'),
          path.resolve(process.cwd(), '../tunnellink.txt'),
        ];
        for (const p of candidatePaths) {
          if (fs.existsSync(p)) {
            const content = fs.readFileSync(p, 'utf8').trim();
            if (content.startsWith('http')) {
              tunnelUrl = content;
              break;
            }
          }
        }
      } catch {
        // Ignore file read error
      }
    }
    return { status: 'ok', tunnelUrl };
  }
}

