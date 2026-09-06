'use client';

import * as React from 'react';
import { Html5Qrcode, Html5QrcodeCameraScanConfig } from 'html5-qrcode';
import {
  Camera,
  CameraOff,
  ShieldAlert,
  HelpCircle,
  RefreshCw,
  SwitchCamera,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';

export interface QRScannerProps {
  onScan: (decodedText: string) => void;
  onError?: (errorMsg: string) => void;
  disabled?: boolean;
  className?: string;
}

export interface CameraDeviceInfo {
  id: string;
  label: string;
  facing: 'environment' | 'user' | 'unknown';
}

const SCANNER_ELEMENT_ID = 'biotrack-qr-reader-viewport';

/**
 * Format a human-readable and accurate camera label from device information.
 */
function formatCameraLabel(
  device: { id: string; label: string },
  index: number,
  activeDeviceId?: string | null
): CameraDeviceInfo {
  const rawLabel = (device.label || '').trim();
  const lower = rawLabel.toLowerCase();

  let facing: 'environment' | 'user' | 'unknown' = 'unknown';
  if (
    lower.includes('back') ||
    lower.includes('rear') ||
    lower.includes('environment') ||
    lower.includes('world') ||
    lower.includes('facing back') ||
    lower.includes('camera2 0')
  ) {
    facing = 'environment';
  } else if (
    lower.includes('front') ||
    lower.includes('user') ||
    lower.includes('selfie') ||
    lower.includes('facing front') ||
    lower.includes('camera2 1')
  ) {
    facing = 'user';
  }

  let friendlyName = rawLabel;
  if (!rawLabel) {
    if (index === 0) {
      friendlyName = 'Primary Camera';
    } else {
      friendlyName = `Camera ${index + 1}`;
    }
  } else {
    // Enhance ambiguous labels
    if (facing === 'environment' && !lower.includes('rear') && !lower.includes('back')) {
      friendlyName = `${rawLabel} (Rear / Environment)`;
    } else if (facing === 'user' && !lower.includes('front')) {
      friendlyName = `${rawLabel} (Front / Selfie)`;
    }
  }

  return {
    id: device.id,
    label: friendlyName,
    facing,
  };
}

export function QRScanner({ onScan, onError, disabled = false, className = '' }: QRScannerProps) {
  const [isScanning, setIsScanning] = React.useState(false);
  const [isInitializing, setIsInitializing] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [isSecure, setIsSecure] = React.useState(true);
  const [hasMediaDevices, setHasMediaDevices] = React.useState(true);
  const [cameras, setCameras] = React.useState<CameraDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = React.useState<string | null>(null);
  const [activeFacing, setActiveFacing] = React.useState<string | null>(null);
  const [lastScannedText, setLastScannedText] = React.useState<string | null>(null);
  const [showInsecureHelp, setShowInsecureHelp] = React.useState(false);

  const scannerRef = React.useRef<Html5Qrcode | null>(null);
  const isMountedRef = React.useRef(true);
  const isStartingRef = React.useRef(false);
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
      }
    }

    // Force release all active MediaStream tracks on any video element
    if (typeof document !== 'undefined') {
      const videoEl = document.querySelector(
        `#${SCANNER_ELEMENT_ID} video`
      ) as HTMLVideoElement | null;
      if (videoEl && videoEl.srcObject) {
        try {
          const stream = videoEl.srcObject as MediaStream;
          stream.getTracks().forEach((track) => {
            track.stop();
          });
          videoEl.srcObject = null;
        } catch (e) {
          console.warn('Track cleanup error:', e);
        }
      }
    }

    if (isMountedRef.current) {
      setIsScanning(false);
      setIsInitializing(false);
      setActiveFacing(null);
    }
  };

  /**
   * Start camera scanner with resilient camera target selection and track inspection.
   */
  const startScanning = async (
    targetCamera?: string | MediaTrackConstraints,
    retryCount = 0
  ) => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;

    setErrorMsg(null);
    setIsInitializing(true);

    // Verify secure context & media devices
    if (!isSecure && !hasMediaDevices) {
      setIsInitializing(false);
      isStartingRef.current = false;
      setErrorMsg(
        'Browser Security Restriction: Camera API (getUserMedia) is only accessible in Secure Contexts (HTTPS or localhost). To use the camera on this device, serve via HTTPS or use the manual barcode entry below.'
      );
      return;
    }

    try {
      // Ensure any prior instance is completely stopped
      if (scannerRef.current) {
        await stopScanning();
      }

      // Pre-render container with non-zero dimensions to avoid black-screen zero-dimension issue
      if (isMountedRef.current) {
        setIsScanning(true);
        setIsInitializing(true);
      }

      // Small DOM flush pause
      await new Promise((resolve) => setTimeout(resolve, 80));

      const html5QrCode = new Html5Qrcode(SCANNER_ELEMENT_ID, {
        verbose: false,
      });
      scannerRef.current = html5QrCode;

      // Determine optimal camera configuration:
      // If targetCamera is explicitly provided, use it.
      // Otherwise, prioritize environment / rear facing mode.
      let cameraConfig: string | MediaTrackConstraints;

      if (targetCamera) {
        cameraConfig = targetCamera;
      } else if (selectedCameraId) {
        cameraConfig = { deviceId: { exact: selectedCameraId } };
      } else {
        // Default to environment facing mode for rear camera barcode scanning
        cameraConfig = { facingMode: 'environment' };
      }

      const config: Html5QrcodeCameraScanConfig = {
        fps: 15,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const edgeSize = Math.max(Math.floor(minEdge * 0.78), 200);
          return { width: edgeSize, height: edgeSize };
        },
      };

      try {
        await html5QrCode.start(
          cameraConfig,
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

            // Mobile haptic vibration feedback
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
              navigator.vibrate(80);
            }

            onScan(decodedText);
          },
          (_errorMessage) => {
            // Continuous frame parsing missed barcode — expected frame-by-frame
          }
        );
      } catch (startErr: unknown) {
        // Fallback strategy: If explicit deviceId failed, retry with environment or user facing mode
        if (typeof targetCamera === 'object' && 'deviceId' in targetCamera && retryCount === 0) {
          console.warn('Specific deviceId start failed, falling back to facingMode: environment', startErr);
          isStartingRef.current = false;
          return startScanning({ facingMode: 'environment' }, 1);
        } else if (retryCount === 0 && cameraConfig !== undefined) {
          console.warn('FacingMode environment failed, attempting generic camera fallback', startErr);
          isStartingRef.current = false;
          return startScanning({ facingMode: 'user' }, 1);
        }
        throw startErr;
      }

      // Post-start inspection and video element setup
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

        // Inspect the active MediaStreamTrack to verify actual physical camera & deviceId
        if (videoEl.srcObject) {
          const stream = videoEl.srcObject as MediaStream;
          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack) {
            const settings = videoTrack.getSettings ? videoTrack.getSettings() : null;
            if (settings) {
              if (settings.deviceId && isMountedRef.current) {
                setSelectedCameraId(settings.deviceId);
              }
              if (settings.facingMode && isMountedRef.current) {
                setActiveFacing(settings.facingMode);
              }
            }
          }
        }
      }

      // Enumerate available cameras now that permission is active to populate clear labels
      try {
        const rawDevices = await Html5Qrcode.getCameras();
        if (rawDevices && rawDevices.length > 0 && isMountedRef.current) {
          const formatted = rawDevices.map((d, i) => formatCameraLabel(d, i));
          setCameras(formatted);

          // If no selectedCameraId was set, or if it was matched, verify consistency
          if (!selectedCameraId && formatted.length > 0) {
            const rearCam = formatted.find((c) => c.facing === 'environment');
            if (rearCam) {
              setSelectedCameraId(rearCam.id);
            } else {
              setSelectedCameraId(formatted[0].id);
            }
          }
        }
      } catch (enumErr) {
        console.warn('Camera enumeration warning:', enumErr);
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
    } finally {
      isStartingRef.current = false;
    }
  };

  /**
   * Handle dropdown camera selection with direct argument passing (no stale state lag).
   */
  const handleCameraChange = async (cameraId: string) => {
    setSelectedCameraId(cameraId);
    if (isScanning) {
      await stopScanning();
      // Pass the specific deviceId directly to bypass React state asynchronous updates
      await startScanning({ deviceId: { exact: cameraId } });
    }
  };

  /**
   * Toggle between front and rear cameras (Flip camera button).
   */
  const handleFlipCamera = async () => {
    if (cameras.length <= 1) return;
    const currentIndex = cameras.findIndex((c) => c.id === selectedCameraId);
    const currentCam = cameras[currentIndex];

    let nextCamera: CameraDeviceInfo | undefined;
    if (currentCam && currentCam.facing !== 'unknown') {
      const targetFacing = currentCam.facing === 'environment' ? 'user' : 'environment';
      nextCamera = cameras.find((c) => c.facing === targetFacing);
    }

    if (!nextCamera) {
      const nextIndex = (currentIndex + 1) % cameras.length;
      nextCamera = cameras[nextIndex];
    }

    if (nextCamera && nextCamera.id !== selectedCameraId) {
      await handleCameraChange(nextCamera.id);
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
                  <strong>Cloudflare HTTPS Tunnel (Zero Setup):</strong> Open the HTTPS tunnel URL on your phone for full camera permissions.
                </li>
                <li>
                  <strong>Manual Barcode Entry:</strong> Use the manual input form below to test all workflows.
                </li>
                <li>
                  <strong>Android Chrome Flag:</strong> On mobile Chrome, open <code className="bg-neutral-100 px-1 py-0.5 rounded text-primary">chrome://flags/#unsafely-treat-insecure-origin-as-secure</code>, add origin, enable, and relaunch Chrome.
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
                Tap below to activate device camera and scan adhesive thermal barcode labels.
              </p>
            </div>

            <Button
              variant="primary"
              size="touch"
              className="gap-2 font-bold px-6 shadow-sm"
              disabled={disabled || isInitializing}
              isLoading={isInitializing}
              onClick={() => startScanning()}
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
            <div className="p-3 bg-neutral-900/95 backdrop-blur-xs border-t border-neutral-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <span className="text-xs font-semibold text-neutral-200">
                  {activeFacing === 'environment'
                    ? 'Rear Camera Active'
                    : activeFacing === 'user'
                    ? 'Front Camera Active'
                    : 'Camera Live'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {cameras.length > 1 && (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="text-xs gap-1 bg-neutral-800 border-neutral-700 text-neutral-200 hover:bg-neutral-700 h-8 px-2.5"
                      onClick={handleFlipCamera}
                      title="Flip camera"
                    >
                      <SwitchCamera className="w-3.5 h-3.5 text-primary" />
                      <span className="hidden sm:inline">Flip</span>
                    </Button>

                    <select
                      value={selectedCameraId || ''}
                      onChange={(e) => handleCameraChange(e.target.value)}
                      aria-label="Select camera"
                      className="bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary max-w-[150px] truncate"
                    >
                      {cameras.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </>
                )}

                <Button
                  variant="secondary"
                  size="sm"
                  className="text-xs gap-1.5 bg-neutral-800 border-neutral-700 text-neutral-200 hover:bg-neutral-700 hover:text-white h-8"
                  onClick={stopScanning}
                >
                  <CameraOff className="w-3.5 h-3.5 text-red-400" />
                  <span>Close</span>
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

