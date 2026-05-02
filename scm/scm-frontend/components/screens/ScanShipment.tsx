"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Loader2,
  ScanBarcode,
  ShieldAlert,
  StopCircle,
} from "lucide-react";
import { toast } from "sonner";
import { buildGatewayUrl } from "../../utils/api";

type DetectedBarcode = {
  rawValue: string;
  format?: string;
};

type BarcodeDetectorConstructor = new (options?: {
  formats?: string[];
}) => {
  detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]>;
};

type ShipmentLookupResult = Record<string, unknown>;

const extractShipment = (payload: unknown): ShipmentLookupResult | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  if (Array.isArray(payload)) {
    return (payload[0] as ShipmentLookupResult | undefined) ?? null;
  }

  const record = payload as Record<string, unknown>;
  if (Array.isArray(record.data)) {
    return (record.data[0] as ShipmentLookupResult | undefined) ?? null;
  }

  if (record.data && typeof record.data === "object") {
    return record.data as ShipmentLookupResult;
  }

  if (record.shipment && typeof record.shipment === "object") {
    return record.shipment as ShipmentLookupResult;
  }

  return Object.keys(record).length > 0 ? record : null;
};

const barcodeFormats = [
  "code_128",
  "code_39",
  "code_93",
  "codabar",
  "ean_13",
  "ean_8",
  "itf",
  "upc_a",
  "upc_e",
  "qr_code",
  "pdf417",
  "data_matrix",
];

export function ScanShipment() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const lookupRequestRef = useRef(0);
  const detectorRef = useRef<InstanceType<BarcodeDetectorConstructor> | null>(
    null,
  );

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [barcodeSupported, setBarcodeSupported] = useState(true);
  const [scanError, setScanError] = useState("");
  const [detectedCode, setDetectedCode] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [shipmentLookup, setShipmentLookup] =
    useState<ShipmentLookupResult | null>(null);
  const [shipmentLookupError, setShipmentLookupError] = useState("");
  const [shipmentLookupLoading, setShipmentLookupLoading] = useState(false);

  const stopCamera = useCallback(() => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraActive(false);
  }, []);

  const lookupShipment = useCallback(async (trackingNumber: string) => {
    const requestId = lookupRequestRef.current + 1;
    lookupRequestRef.current = requestId;

    setShipmentLookup(null);
    setShipmentLookupError("");
    setShipmentLookupLoading(true);

    try {
      const response = await fetch(
        buildGatewayUrl(
          `/shipments?trackingNumber=${encodeURIComponent(trackingNumber)}`,
        ),
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
        },
      );

      if (requestId !== lookupRequestRef.current) {
        return;
      }

      if (response.status === 404) {
        setShipmentLookupError("Shipment not found");
        return;
      }

      if (!response.ok) {
        setShipmentLookupError("Unable to look up shipment. Try again.");
        return;
      }

      const payload = (await response.json()) as unknown;
      const shipment = extractShipment(payload);

      if (!shipment) {
        setShipmentLookupError("Shipment not found");
        return;
      }

      setShipmentLookup(shipment);
    } catch {
      if (requestId === lookupRequestRef.current) {
        setShipmentLookupError("Unable to look up shipment. Try again.");
      }
    } finally {
      if (requestId === lookupRequestRef.current) {
        setShipmentLookupLoading(false);
      }
    }
  }, []);

  const captureTrackingCode = useCallback(
    (value: string) => {
      setDetectedCode(value);
      setManualCode(value);
      toast.success("Shipment barcode captured", {
        description: value,
      });
      void lookupShipment(value);
    },
    [lookupShipment],
  );

  const scanFrame = useCallback(async () => {
    const detector = detectorRef.current;
    const video = videoRef.current;

    if (!streamRef.current) {
      return;
    }

    if (!detector || !video || video.readyState < 2) {
      frameRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    try {
      const results = await detector.detect(video);
      const firstResult = results[0];

      if (firstResult?.rawValue) {
        const value = firstResult.rawValue.trim();
        captureTrackingCode(value);
        stopCamera();
        return;
      }
    } catch (error) {
      setScanError(
        error instanceof Error
          ? error.message
          : "Barcode scan failed. Try again or enter the code manually.",
      );
    }

    if (streamRef.current) {
      frameRef.current = requestAnimationFrame(scanFrame);
    }
  }, [captureTrackingCode, stopCamera]);

  const startCamera = useCallback(async () => {
    setScanError("");
    setDetectedCode("");

    const barcodeDetector = (
      window as Window & {
        BarcodeDetector?: BarcodeDetectorConstructor;
      }
    ).BarcodeDetector;

    if (!barcodeDetector) {
      setBarcodeSupported(false);
      setScanError(
        "This browser does not support automatic barcode detection. You can still enter the tracking barcode manually.",
      );
      return;
    }

    setBarcodeSupported(true);
    setCameraStarting(true);

    try {
      detectorRef.current = new barcodeDetector({
        formats: barcodeFormats,
      });

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraActive(true);
      frameRef.current = requestAnimationFrame(scanFrame);
    } catch (error) {
      setScanError(
        error instanceof Error
          ? error.message
          : "Camera permission was denied or the camera could not start.",
      );
      stopCamera();
    } finally {
      setCameraStarting(false);
    }
  }, [scanFrame, stopCamera]);

  const confirmManualCode = () => {
    const value = manualCode.trim();

    if (!value) {
      toast.error("Tracking barcode is required");
      return;
    }

    captureTrackingCode(value);
  };

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const shipmentStatus =
    typeof shipmentLookup?.status === "string" ? shipmentLookup.status : null;
  const shipmentSupplier =
    typeof shipmentLookup?.supplier_name === "string"
      ? shipmentLookup.supplier_name
      : null;

  return (
    <div className="min-h-full bg-[#F8FAFC] p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl bg-gradient-to-br from-[#12304A] via-[#174766] to-[#00A3AD] p-6 text-white shadow-xl md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">
                Shipment Intake
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
                Scan Shipment
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80 md:text-base">
                Activate the device camera and capture inbound tracking
                barcodes before the shipment moves into receiving.
              </p>
            </div>

            <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
              <ScanBarcode className="h-12 w-12 text-white" />
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">
                  Camera Barcode Detection
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Point the camera at a shipment tracking barcode.
                </p>
              </div>

              <div className="flex gap-2">
                {!cameraActive ? (
                  <button
                    type="button"
                    onClick={() => void startCamera()}
                    disabled={cameraStarting}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#00A3AD] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#008C95] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {cameraStarting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                    {cameraStarting ? "Starting..." : "Start Camera"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
                  >
                    <StopCircle className="h-4 w-4" />
                    Stop
                  </button>
                )}
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-slate-950">
              <div className="relative aspect-video">
                <video
                  ref={videoRef}
                  className="h-full w-full object-cover"
                  muted
                  playsInline
                />

                {!cameraActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950 text-center text-white">
                    <div className="rounded-full bg-white/10 p-4">
                      <Camera className="h-10 w-10" />
                    </div>
                    <p className="text-sm text-white/70">
                      Camera preview appears here after permission is granted.
                    </p>
                  </div>
                )}

                {cameraActive && (
                  <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-dashed border-cyan-300 shadow-[0_0_0_999px_rgba(15,23,42,0.35)]" />
                )}
              </div>
            </div>

            {scanError && (
              <div className="mt-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">Scanner notice</p>
                  <p className="mt-1">{scanError}</p>
                </div>
              </div>
            )}

            {!barcodeSupported && (
              <p className="mt-3 text-sm text-slate-500">
                Tip: automatic scanning works best in Chromium-based browsers
                on HTTPS or localhost.
              </p>
            )}
          </section>

          <aside className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">
                Captured Tracking Barcode
              </h2>

              {detectedCode ? (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                  <div className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="h-5 w-5" />
                    Barcode captured
                  </div>
                  <p className="mt-3 break-all rounded-lg bg-white px-3 py-2 font-mono text-sm">
                    {detectedCode}
                  </p>

                  {shipmentLookupLoading && (
                    <div className="mt-3 flex items-center gap-2 text-sm font-medium text-emerald-900">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Looking up shipment...
                    </div>
                  )}

                  {shipmentLookupError && (
                    <div className="mt-3 flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{shipmentLookupError}</span>
                    </div>
                  )}

                  {shipmentLookup && !shipmentLookupLoading && (
                    <div className="mt-3 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-emerald-900">
                      <div className="flex items-center gap-2 font-semibold">
                        <CheckCircle2 className="h-4 w-4" />
                        Shipment found
                      </div>
                      {(shipmentStatus || shipmentSupplier) && (
                        <p className="mt-1 text-emerald-800">
                          {[shipmentSupplier, shipmentStatus]
                            .filter(Boolean)
                            .join(" - ")}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">
                  No barcode captured yet.
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">
                Manual Fallback
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Use this if the barcode is damaged or browser scanning is not
                available.
              </p>

              <label className="mt-4 block text-sm font-medium text-slate-700">
                Tracking Barcode
              </label>
              <input
                value={manualCode}
                onChange={(event) => {
                  setManualCode(event.target.value);
                  setShipmentLookupError("");
                }}
                placeholder="Enter or paste tracking barcode"
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#00A3AD] focus:ring-2 focus:ring-[#00A3AD]/20"
              />

              <button
                type="button"
                onClick={confirmManualCode}
                disabled={shipmentLookupLoading}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1A2B47] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#263F64] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {shipmentLookupLoading && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Confirm Barcode
              </button>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
