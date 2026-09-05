/**
 * BioTrack / VyomCare — Scan State Store (Zustand)
 * Source of truth: design.md §15, §18.2
 */

'use client';

import { create } from 'zustand';
import { WasteBatch, QrCode } from '@/types/models';

interface ScanState {
  lastScannedCode: string | null;
  scannedBatch: (WasteBatch & { qrCode?: QrCode | null }) | null;
  validActions: string[];
  isScanning: boolean;
  isProcessing: boolean;
  error: string | null;

  // Actions
  setScanning: (isScanning: boolean) => void;
  setProcessing: (isProcessing: boolean) => void;
  setScanResult: (
    code: string,
    batch: WasteBatch & { qrCode?: QrCode | null },
    validActions: string[],
  ) => void;
  setError: (error: string | null) => void;
  clearScan: () => void;
}

export const useScanStore = create<ScanState>((set) => ({
  lastScannedCode: null,
  scannedBatch: null,
  validActions: [],
  isScanning: false,
  isProcessing: false,
  error: null,

  setScanning: (isScanning) => set({ isScanning }),
  setProcessing: (isProcessing) => set({ isProcessing }),
  setScanResult: (code, batch, validActions) =>
    set({
      lastScannedCode: code,
      scannedBatch: batch,
      validActions,
      error: null,
      isProcessing: false,
    }),
  setError: (error) => set({ error, isProcessing: false }),
  clearScan: () =>
    set({
      lastScannedCode: null,
      scannedBatch: null,
      validActions: [],
      error: null,
      isProcessing: false,
    }),
}));
