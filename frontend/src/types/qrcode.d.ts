declare module 'qrcode' {
  export interface QRCodeRenderersOptions {
    margin?: number;
    scale?: number;
    width?: number;
    errorCorrectionLevel?: 'low' | 'medium' | 'quartile' | 'high' | 'L' | 'M' | 'Q' | 'H';
    color?: {
      dark?: string;
      light?: string;
    };
  }

  export interface QRCodeToStringOptions extends QRCodeRenderersOptions {
    type?: 'utf8' | 'svg' | 'terminal';
  }

  export interface QRCodeToDataURLOptions extends QRCodeRenderersOptions {
    type?: 'image/png' | 'image/jpeg' | 'image/webp';
    rendererOpts?: {
      quality?: number;
    };
  }

  export function toDataURL(
    text: string | Buffer,
    options?: QRCodeToDataURLOptions
  ): Promise<string>;

  export function toDataURL(
    text: string | Buffer,
    options: QRCodeToDataURLOptions,
    callback: (error: Error | null, url: string) => void
  ): void;

  export function toString(
    text: string | Buffer,
    options?: QRCodeToStringOptions
  ): Promise<string>;

  export function toString(
    text: string | Buffer,
    options: QRCodeToStringOptions,
    callback: (error: Error | null, string: string) => void
  ): void;
}
