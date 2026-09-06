'use client';

import * as React from 'react';
import { Html5Qrcode, Html5QrcodeCameraScanConfig } from 'html5-qrcode';
import {
  Camera,
  CameraOff,
  ShieldAlert,
  HelpCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';

export interface QRScannerProps {
  onScan: (decodedText: string) => void;
  onError?: (errorMsg: string) => void;
  disabled?: boolean;
  className?: string;
}

const SCANNER_ELEMENT_ID = 'biotrack-qr-reader-viewport';

export function QRScanner({ onScan, onError, disabled = false, className = '' }: QRScannerProps) {
  const [isScanning, setIsScanning] = React.useState(false);
  const [isInitializing, setIsInitializing] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [isSecure, setIsSecure] = React.useState(true);
  const [hasMediaDevices, setHasMediaDevices] = React.useState(true);
  const [cameras, setCameras] = React.useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = React.useState<string | null>(null);
  const [lastScannedText, setLastScannedText] = React.useState<string | null>(null);
  const [showInsecureHelp, setShowInsecureHelp] = React.useState(false);

  const scannerRef = React.useRef<Html5Qrcode | null>(null);
  const isMountedRef = React.useRef(true);
  const lastScannedTimeRef = React.useRef<number>(0);

  // Check browser capabilities & security context on mount
  React.useEffect(() => {
    isMountedRef.current = true;

    const secure =
      typeof window !== 'undefined' &&
      (window.isSecureContext ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1');
    setIsSecure(Boolean(secure));

    const mediaSupported =
      typeof navigator !== 'undefined' &&
      Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    setHasMediaDevices(Boolean(mediaSupported));

    if (!secure && !mediaSupported) {
      setErrorMsg(
        'Insecure Context: Camera access is blocked by mobile browsers over plain HTTP LAN. HTTPS or localhost is required by browser security policies.'
      );
    }

    return () => {
      isMountedRef.current = false;
      stopScanning();
    };
  }, []);

  const stopScanning = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (err) {
        console.warn('QRScanner stop error:', err);
      } finally {
        scannerRef.current = null;
        if (isMountedRef.current) {
          setIsScanning(false);
          setIsInitializing(false);
        }
      }
    }
  };

  const startScanning = async () => {
    setErrorMsg(null);
    setIsInitializing(true);

    // Verify secure context & media devices
    if (!isSecure && !hasMediaDevices) {
      setIsInitializing(false);
      setErrorMsg(
        'Browser Security Restriction: Camera API (getUserMedia) is only accessible in Secure Contexts (HTTPS or localhost). To use the camera on this device, serve via HTTPS or use the manual barcode entry below.'
      );
      return;
    }

    try {
      // Ensure any previous instance is stopped
      if (scannerRef.current) {
        await stopScanning();
      }

      // Set scanning/initializing states so the container has valid non-zero dimensions
      if (isMountedRef.current) {
        setIsScanning(true);
        setIsInitializing(true);
      }

      // Small delay to ensure React commits DOM update and container has real dimensions
      await new Promise((resolve) => setTimeout(resolve, 80));

      const html5QrCode = new Html5Qrcode(SCANNER_ELEMENT_ID, {
        verbose: false,
      });
      scannerRef.current = html5QrCode;

      // Query available video devices
      let targetCameraParam: string | MediaTrackConstraints = {
        facingMode: 'environment',
      };

      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          setCameras(devices);
          if (selectedCameraId) {
            targetCameraParam = { deviceId: { exact: selectedCameraId } };
          } else {
            // Find back/environment camera
            const backCamera = devices.find(
              (d) =>
                d.label.toLowerCase().includes('back') ||
                d.label.toLowerCase().includes('rear') ||
                d.label.toLowerCase().includes('environment')
            );
            if (backCamera) {
              setSelectedCameraId(backCamera.id);
              targetCameraParam = { deviceId: { exact: backCamera.id } };
            } else {
              setSelectedCameraId(devices[0].id);
              targetCameraParam = { deviceId: { exact: devices[0].id } };
            }
          }
        }
      } catch {
        // Camera enumeration might fail before permission is granted; fallback to facingMode
        targetCameraParam = { facingMode: 'environment' };
      }

      const config: Html5QrcodeCameraScanConfig = {
        fps: 15,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const edgeSize = Math.max(Math.floor(minEdge * 0.78), 200);
          return { width: edgeSize, height: edgeSize };
        },
      };

      await html5QrCode.start(
        targetCameraParam,
        config,
        (decodedText) => {
          // Prevent rapid duplicate scans within 1.5s
          const now = Date.now();
          if (now - lastScannedTimeRef.current < 1500) {
            return;
          }
          lastScannedTimeRef.current = now;

          if (isMountedRef.current) {
            setLastScannedText(decodedText);
            setTimeout(() => {
              if (isMountedRef.current) setLastScannedText(null);
            }, 3000);
          }

          // Haptic feedback if supported on mobile
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(80);
          }

          onScan(decodedText);
        },
        (_errorMessage) => {
          // Continuous frame parsing message — ignore transient misses
        }
      );

      // Post-start enforcement: ensure video element is playing, unmuted, playsinline, and visible
      const videoEl = document.querySelector(
        `#${SCANNER_ELEMENT_ID} video`
      ) as HTMLVideoElement | null;
      if (videoEl) {
        videoEl.setAttribute('playsinline', 'true');
        videoEl.setAttribute('webkit-playsinline', 'true');
        videoEl.muted = true;
        videoEl.style.width = '100%';
        videoEl.style.height = '100%';
        videoEl.style.objectFit = 'cover';
        videoEl.style.display = 'block';
        videoEl.style.visibility = 'visible';
        videoEl.style.opacity = '1';
        if (videoEl.paused) {
          videoEl.play().catch(() => {});
        }
      }

      if (isMountedRef.current) {
        setIsScanning(true);
        setIsInitializing(false);
      }
    } catch (err: unknown) {
      console.error('Failed to start QR scanner:', err);
      if (isMountedRef.current) {
        setIsInitializing(false);
        setIsScanning(false);

        let userError = 'Unable to start camera.';
        if (err instanceof Error) {
          const msg = err.message || '';
          if (
            msg.includes('NotAllowedError') ||
            msg.includes('Permission') ||
            msg.includes('denied')
          ) {
            userError =
              'Camera access permission denied. Please allow camera permissions in your browser address bar/settings.';
          } else if (msg.includes('NotFoundError') || msg.includes('DevicesNotFoundError')) {
            userError = 'No optical camera device found on this system.';
          } else if (msg.includes('NotReadableError') || msg.includes('TrackStartError')) {
            userError = 'Camera is in use by another application or tab. Please close other apps and try again.';
          } else if (msg.includes('isSecureContext') || msg.includes('getUserMedia')) {
            userError =
              'Insecure HTTP Origin: Camera API blocked by mobile browser. HTTPS or localhost is required.';
          } else {
            userError = `Camera Initialization Error: ${msg}`;
          }
        }
        setErrorMsg(userError);
        onError?.(userError);
      }
    }
  };

  const handleCameraChange = async (cameraId: string) => {
    setSelectedCameraId(cameraId);
    if (isScanning) {
      await stopScanning();
      setTimeout(() => {
        startScanning();
      }, 100);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Insecure Context Banner */}
      {!isSecure && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 space-y-2 shadow-2xs">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-amber-950">
                HTTP LAN Environment Detected
              </p>
              <p className="text-amber-800 leading-relaxed">
                Modern mobile browsers (Chrome, Safari) require a <strong>Secure Context (HTTPS or localhost)</strong> to grant camera permissions. Over plain HTTP on LAN IP addresses, the browser automatically restricts hardware camera access.
              </p>
            </div>
          </div>

          <div className="pt-1 flex items-center justify-between border-t border-amber-200">
            <button
              type="button"
              onClick={() => setShowInsecureHelp(!showInsecureHelp)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-900 hover:underline cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>{showInsecureHelp ? 'Hide instructions' : 'How to test camera on phone'}</span>
            </button>
            <span className="text-[11px] text-amber-700 font-mono font-medium">
              Manual code entry works 100%
            </span>
          </div>

          {showInsecureHelp && (
            <div className="p-3 bg-white/80 rounded-lg border border-amber-200 text-[11px] text-neutral-800 space-y-2 animate-in fade-in duration-150">
              <p className="font-bold text-neutral-900">Options for Mobile Camera Testing:</p>
              <ol className="list-decimal list-inside space-y-1 text-neutral-700">
                <li>
                  <strong>Manual Barcode Entry (Zero Setup):</strong> Use the manual input form below. Fill sample codes or type batch IDs to verify end-to-end custody workflows.
                </li>
                <li>
                  <strong>Android Chrome Flag (No Certs Needed):</strong> On mobile Chrome, open <code className="bg-neutral-100 px-1 py-0.5 rounded text-primary">chrome://flags/#unsafely-treat-insecure-origin-as-secure</code>, add <code className="bg-neutral-100 px-1 py-0.5 rounded text-primary">http://192.168.1.20:3000</code>, enable, and relaunch Chrome.
                </li>
                <li>
                  <strong>Chrome USB Port Forwarding:</strong> Connect phone via USB, run <code className="bg-neutral-100 px-1 py-0.5 rounded text-primary">adb reverse tcp:3000 tcp:3000</code>, then open <code className="bg-neutral-100 px-1 py-0.5 rounded text-primary">http://localhost:3000</code> on phone (treated as secure).
                </li>
                <li>
                  <strong>HTTPS Tunnel / Next.js HTTPS:</strong> Run dev server with HTTPS (e.g. Next.js experimental HTTPS, ngrok, or Cloudflare tunnel).
                </li>
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Error Alert */}
      {errorMsg && (
        <Alert
          variant="danger"
          title="Camera Error"
          onDismiss={() => setErrorMsg(null)}
        >
          {errorMsg}
        </Alert>
      )}

      {/* Viewport Frame */}
      <div className="relative rounded-2xl border-2 border-neutral-800 bg-neutral-950 text-white overflow-hidden shadow-md">
        {/* html5-qrcode target container */}
        <div
          id={SCANNER_ELEMENT_ID}
          className={`w-full ${isScanning || isInitializing ? 'min-h-[300px] sm:min-h-[360px] block' : 'hidden'}`}
          style={{ width: '100%' }}
        />

        {/* Placeholder / Off-state view */}
        {!isScanning && !isInitializing && (
          <div className="p-8 flex flex-col items-center justify-center text-center gap-4 min-h-[260px]">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-primary">
                <Camera className="w-8 h-8" />
              </div>
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
            </div>

            <div className="space-y-1 max-w-xs">
              <p className="text-sm font-semibold text-white">
                Optical QR Scanner
              </p>
              <p className="text-xs text-neutral-400">
                Tap below to open device camera and scan adhesive thermal barcode labels.
              </p>
            </div>

            <Button
              variant="primary"
              size="touch"
              className="gap-2 font-bold px-6 shadow-sm"
              disabled={disabled || isInitializing}
              isLoading={isInitializing}
              onClick={startScanning}
            >
              <Camera className="w-5 h-5" />
              <span>{isInitializing ? 'Activating Camera...' : 'Open Camera Scanner'}</span>
            </Button>
          </div>
        )}

        {/* Live Overlay Controls when Scanning */}
        {isScanning && (
          <>
            {lastScannedText && (
              <div className="absolute top-3 left-3 right-3 z-20 bg-emerald-600/95 text-white text-xs font-semibold px-3 py-2 rounded-xl backdrop-blur-xs flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-top-2 duration-150">
                <span className="truncate">✓ Decoded: {lastScannedText}</span>
                <span className="text-[10px] bg-emerald-800 px-1.5 py-0.5 rounded font-mono uppercase">
                  Active
                </span>
              </div>
            )}
            <div className="p-3 bg-neutral-900/90 backdrop-blur-xs border-t border-neutral-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <span className="text-xs font-semibold text-neutral-200">
                  Camera Live
                </span>
              </div>

            <div className="flex items-center gap-2">
              {cameras.length > 1 && (
                <select
                  value={selectedCameraId || ''}
                  onChange={(e) => handleCameraChange(e.target.value)}
                  aria-label="Select camera"
                  className="bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {cameras.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label || `Camera ${c.id.slice(0, 6)}`}
                    </option>
                  ))}
                </select>
              )}

              <Button
                variant="secondary"
                size="sm"
                className="text-xs gap-1.5 bg-neutral-800 border-neutral-700 text-neutral-200 hover:bg-neutral-700 hover:text-white h-8"
                onClick={stopScanning}
              >
                <CameraOff className="w-3.5 h-3.5 text-red-400" />
                <span>Close Camera</span>
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  </div>
  );
}
