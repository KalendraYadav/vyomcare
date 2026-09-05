import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // ConfigService reads JWT_SECRET after .env is loaded; no fallback —
      // startup validation in main.ts guarantees the variable exists.
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: {
    sub: string;
    role: string;
    facilityId: string | null;
  }) {
    return {
      userId: payload.sub,
      role: payload.role,
      facilityId: payload.facilityId,
    };
  }
}
