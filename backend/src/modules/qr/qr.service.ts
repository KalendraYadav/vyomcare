import { Injectable } from '@nestjs/common';
import * as QRCode from 'qrcode';

@Injectable()
export class QrService {
  async generateDataUrl(codeValue: string): Promise<string> {
    return QRCode.toDataURL(codeValue, {
      errorCorrectionLevel: 'H',
      width: 400,
      margin: 2,
    });
  }

  async generateSvg(codeValue: string): Promise<string> {
    return QRCode.toString(codeValue, {
      type: 'svg',
      errorCorrectionLevel: 'H',
    });
  }
}
