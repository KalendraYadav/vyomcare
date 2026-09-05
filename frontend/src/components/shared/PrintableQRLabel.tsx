'use client';

import * as React from 'react';
import QRCode from 'qrcode';
import { WasteBatch } from '@/types/models';

interface PrintableQRLabelProps {
  batch: WasteBatch;
  codeValue: string;
  className?: string;
}

export function PrintableQRLabel({ batch, codeValue, className = '' }: PrintableQRLabelProps) {
  const [qrSrc, setQrSrc] = React.useState<string | null>(null);

  React.useEffect(() => {
    let isMounted = true;
    QRCode.toDataURL(codeValue, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 250,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (isMounted) setQrSrc(url);
      })
      .catch((err) => {
        console.error('Failed to generate QR sticker code', err);
      });

    return () => {
      isMounted = false;
    };
  }, [codeValue]);

  return (
    <div
      className={`print-label-container bg-white text-black border-2 border-black rounded-lg p-3 w-full max-w-[420px] shadow-sm select-none ${className}`}
      style={{
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      {/* Statutory Header */}
      <div className="border-b-2 border-black pb-1.5 mb-2 text-center">
        <div className="flex items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-black">
          <svg
            className="w-4 h-4 text-black flex-shrink-0"
            viewBox="0 0 24 24"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
          <span>BIOMEDICAL WASTE — CPCB 2016</span>
        </div>
      </div>

      {/* Main Body: QR Code + Identification Grid */}
      <div className="grid grid-cols-[120px_1fr] gap-3 items-center">
        {/* Crisp QR Code Image */}
        <div className="flex flex-col items-center justify-center border border-neutral-300 p-1 bg-white">
          {qrSrc ? (
            <img
              src={qrSrc}
              alt={`QR code for batch ${batch.wasteId}`}
              className="w-[110px] h-[110px] object-contain block"
            />
          ) : (
            <div className="w-[110px] h-[110px] bg-neutral-100 flex items-center justify-center text-[10px] text-neutral-400">
              Generating...
            </div>
          )}
          <span className="font-mono text-[9px] font-bold text-center tracking-tight text-neutral-600 truncate max-w-[110px] mt-0.5">
            {codeValue}
          </span>
        </div>

        {/* Batch Particulars */}
        <div className="space-y-1 text-xs">
          <div>
            <span className="text-[9px] uppercase font-bold text-neutral-500 block leading-tight">
              Batch Manifest ID
            </span>
            <span className="font-mono text-sm font-black tracking-tight text-black">
              {batch.wasteId}
            </span>
          </div>

          <div>
            <span className="text-[9px] uppercase font-bold text-neutral-500 block leading-tight">
              Category
            </span>
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block w-2.5 h-2.5 rounded-xs border border-black"
                style={{ backgroundColor: batch.category?.colorCode || '#000000' }}
              />
              <span className="font-bold text-black uppercase">
                {batch.category?.name || 'Biomedical Waste'} ({batch.category?.code || 'BMW'})
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1 pt-0.5">
            <div>
              <span className="text-[9px] uppercase font-bold text-neutral-500 block leading-tight">
                Net Weight
              </span>
              <span className="font-black text-black text-xs">
                {batch.quantity} {batch.unit}
              </span>
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold text-neutral-500 block leading-tight">
                Ward / Dept
              </span>
              <span className="font-semibold text-black truncate block text-xs">
                {batch.department}
              </span>
            </div>
          </div>

          <div>
            <span className="text-[9px] uppercase font-bold text-neutral-500 block leading-tight">
              Origin Facility
            </span>
            <span className="font-semibold text-black text-[11px] truncate block">
              {batch.hospital?.name || 'Healthcare Facility'}
            </span>
          </div>
        </div>
      </div>

      {/* Footer Statutory Warning */}
      <div className="mt-2 pt-1 border-t-2 border-black flex items-center justify-between text-[9px] font-bold text-neutral-700">
        <span>GEN: {new Date(batch.createdAt).toLocaleDateString('en-IN')}</span>
        <span className="uppercase tracking-wide text-black">DO NOT TAMPER / BIOHAZARD</span>
      </div>

      {/* Embedded print CSS for 100mm x 50mm adhesive roll compatibility */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-label-container,
          .print-label-container * {
            visibility: visible;
          }
          .print-label-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100mm !important;
            max-width: 100mm !important;
            border: 2px solid black !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 8px !important;
            page-break-after: avoid;
            page-break-inside: avoid;
          }
          header,
          nav,
          aside,
          button,
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
