import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  ScanBarcode,
  CheckCircle,
  Package,
  Plus,
  Trash2,
  SendHorizonal,
  RefreshCw,
  Download,
  Truck,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  blockInvalidNumberKeys,
  isPhoneValid,
  sanitizeIntegerInput,
  sanitizePhoneInput,
} from "../../lib/inputSanitizers";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { SearchableProductSelect } from "../shared/SearchableProductSelect";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  RadioGroup,
  RadioGroupItem,
} from "../ui/radio-group";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";
import { toast } from "sonner";
import { notifyDashboardDataChanged } from "@/lib/dashboardInvalidation";
import { postGRN } from "@/utils/postGRN";
import {
  supabaseFulfillment,
  supabaseQuality,
} from "@/lib/supabase";
import {
  fetchBackorderAlerts,
  fetchInventoryItems,
  receiveInventoryScan,
} from "@/lib/inventoryService";
import {
  saveGrnDraft,
  scheduleWarehouseDelivery,
} from "@/lib/warehouseReceivingService";
import { fetchSuppliers, type SupplierRecord } from "@/lib/supplierService";
import {
  listCatalogProducts,
  type ProductCatalogRecord,
} from "@/lib/productCatalogService";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface InventoryItem {
  id: string;
  productUuid: string | null;
  sku: string;
  barcode: string;
  name: string;
  unit: string;
  reservedStock: number;
  lastUpdated: string | null;
  systemCount: number;
  status: "normal" | "low" | "zero";
}

interface GrnLine {
  lineId: string;
  productId: string;
  qtyExpected: string;
  qtyReceived: string;
  discrepancyReason: string;
  otherReason: string;
  batchNumber: string;
  expiryDate: string;
}

interface BackorderAlertRow {
  id: string;
  sku: string;
  message: string | null;
  grn_reference: string | null;
  pending_backorder_count: number | null;
  created_at: string;
}

const MIN_STOCK_THRESHOLD = 500;
const warehouseRowsPerPage = 10;

const getTodayLocalDate = (): string => {
  const now = new Date();
  const localTime = new Date(
    now.getTime() - now.getTimezoneOffset() * 60000,
  );
  return localTime.toISOString().slice(0, 10);
};

const createEmptyLine = (): GrnLine => ({
  lineId: crypto.randomUUID(),
  productId: "",
  qtyExpected: "",
  qtyReceived: "",
  discrepancyReason: "",
  otherReason: "",
  batchNumber: "",
  expiryDate: "",
});

const toReasonCode = (value: string) =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();

const deriveSeverity = (units: number) => {
  if (units >= 20) return "Critical";
  if (units >= 5) return "Major";
  return "Minor";
};

export function WarehouseReceiving() {
  const [showGrnForm, setShowGrnForm] = useState(false);
  const [receivedDate, setReceivedDate] = useState(
    getTodayLocalDate(),
  );
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<GrnLine[]>([
    createEmptyLine(),
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [savedGrnId, setSavedGrnId] = useState<string | null>(
    null,
  );
  const [savedGrnNumber, setSavedGrnNumber] = useState<
    string | null
  >(null);
  const [isPosted, setIsPosted] = useState(false);
  const [supplierName, setSupplierName] = useState("");
  const [supplierContact, setSupplierContact] = useState("");
  const [supplierAddress, setSupplierAddress] = useState("");
  
  // Pharma checks state
  const [grnCheckPhoto, setGrnCheckPhoto] = useState<File | null>(null);
  const [grnCheckNotes, setGrnCheckNotes] = useState("");
  const [grnChecks, setGrnChecks] = useState<Record<string, string>>({
    packaging_intact: "",
    correct_label: "",
    temperature_ok: "",
    expiry_ok: "",
  });
  const [qcDiscrepancies, setQcDiscrepancies] = useState<Record<string, { reason_code: string; severity: string }>>({
    packaging_intact: { reason_code: "", severity: "" },
    correct_label: { reason_code: "", severity: "" },
    temperature_ok: { reason_code: "", severity: "" },
    expiry_ok: { reason_code: "", severity: "" },
  });
  const [savingGrnChecks, setSavingGrnChecks] = useState(false);

  const [inventory, setInventory] = useState<InventoryItem[]>(
    [],
  );
  const [loadingInventory, setLoadingInventory] =
    useState(false);
  const [stockSearch, setStockSearch] = useState("");
  const [inventoryPage, setInventoryPage] = useState(1);
  const [isScanListening, setIsScanListening] = useState(false);
  const [scanInput, setScanInput] = useState("");
  const [showCameraScanner, setShowCameraScanner] =
    useState(false);
  const [cameraError, setCameraError] = useState<string | null>(
    null,
  );
  const [isCameraScanning, setIsCameraScanning] =
    useState(false);
  const [backorderAlerts, setBackorderAlerts] = useState<
    BackorderAlertRow[]
  >([]);
  const [showDeliveryScheduleDialog, setShowDeliveryScheduleDialog] = useState(false);
  const [schedulingDelivery, setSchedulingDelivery] = useState(false);
  const [deliveryFormErrors, setDeliveryFormErrors] = useState({
    expected_items_count: "",
    contact_phone: "",
  });
  const [deliveryForm, setDeliveryForm] = useState({
    delivery_datetime: "",
    supplier_name: "",
    expected_items_count: "",
    warehouse_location: "",
    contact_person_name: "",
    contact_phone: "",
    notes: "",
  });
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [warehouseLocations, setWarehouseLocations] = useState<string[]>([]);
  const scanInputRef = useRef<HTMLInputElement | null>(null);
  const scanVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraScanTimerRef = useRef<number | null>(null);

  const filteredInventory = useMemo(() => {
    const keyword = stockSearch.trim().toLowerCase();
    if (!keyword) return inventory;
    return inventory.filter((item) => {
      return (
        item.name.toLowerCase().includes(keyword) ||
        item.sku.toLowerCase().includes(keyword)
      );
    });
  }, [inventory, stockSearch]);

  const lowStockCount = useMemo(
    () =>
      inventory.filter((item) => item.status === "low").length,
    [inventory],
  );

  const outOfStockCount = useMemo(
    () =>
      inventory.filter((item) => item.status === "zero").length,
    [inventory],
  );

  useEffect(() => {
    let isMounted = true;

    const loadReferenceLists = async () => {
      try {
        const [supplierRows, productRows] = await Promise.all([
          fetchSuppliers(),
          listCatalogProducts({ limit: 1000 }),
        ]);

        if (!isMounted) return;

        setSuppliers(supplierRows);
        setWarehouseLocations(
          Array.from(
            new Set(
              (productRows as ProductCatalogRecord[])
                .map((product) => product.warehouse_location?.trim())
                .filter((location): location is string => Boolean(location)),
            ),
          ).sort((a, b) => a.localeCompare(b)),
        );
      } catch (error) {
        console.error("Failed to load warehouse reference lists:", error);
        if (isMounted) {
          setSuppliers([]);
          setWarehouseLocations([]);
        }
      }
    };

    void loadReferenceLists();

    return () => {
      isMounted = false;
    };
  }, []);

  const pagedInventory = useMemo(() => {
    const start = (inventoryPage - 1) * warehouseRowsPerPage;
    return filteredInventory.slice(
      start,
      start + warehouseRowsPerPage,
    );
  }, [filteredInventory, inventoryPage]);

  const inventoryTotalPages = useMemo(() => {
    return Math.max(
      1,
      Math.ceil(
        filteredInventory.length / warehouseRowsPerPage,
      ),
    );
  }, [filteredInventory.length]);

  useEffect(() => {
    setInventoryPage(1);
  }, [stockSearch]);

  useEffect(() => {
    if (inventoryPage > inventoryTotalPages) {
      setInventoryPage(inventoryTotalPages);
    }
  }, [inventoryPage, inventoryTotalPages]);

  const fetchInventory = useCallback(async () => {
    setLoadingInventory(true);
    try {
      const items = await fetchInventoryItems({ limit: 500 });
      setInventory(items as InventoryItem[]);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : String(err);
      console.error("fetchInventory error:", msg);
      toast.error("Could not load inventory", {
        description: msg,
      });
    } finally {
      setLoadingInventory(false);
    }
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  useEffect(() => {
    let isMounted = true;

    const loadBackorderAlerts = async () => {
      try {
        const data = await fetchBackorderAlerts(5);
        if (!isMounted) return;
        setBackorderAlerts(data as BackorderAlertRow[]);
      } catch {
        if (!isMounted) return;
      }
    };

    void loadBackorderAlerts();

    const channel = supabaseFulfillment
      .channel("warehouse-backorder-alerts")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "backorder_alerts",
        },
        (payload) => {
          const nextAlert = payload.new as BackorderAlertRow;
          setBackorderAlerts((prev) => [
            nextAlert,
            ...prev,
          ].slice(0, 5));
          toast.success("Backorder Match Found", {
            description:
              nextAlert.message ||
              `${nextAlert.sku} has pending retailer demand waiting for this inbound stock.`,
          });
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      void supabaseFulfillment.removeChannel(channel);
    };
  }, []);

  const incrementReceivedForItem = (
    item: InventoryItem,
  ): void => {
    setLines((prev) => {
      if (prev.length === 1 && !prev[0].productId) {
        return [
          {
            ...prev[0],
            productId: item.id,
            qtyExpected: "",
            qtyReceived: "1",
          },
        ];
      }

      const existingIndex = prev.findIndex(
        (line) => line.productId === item.id,
      );
      if (existingIndex >= 0) {
        return prev.map((line, index) => {
          if (index !== existingIndex) return line;
          const currentReceived = Number(line.qtyReceived);
          const nextReceived =
            Number.isFinite(currentReceived) &&
            currentReceived > 0
              ? currentReceived + 1
              : 1;
          return {
            ...line,
            qtyReceived: String(nextReceived),
          };
        });
      }

      return [
        ...prev,
        {
          lineId: crypto.randomUUID(),
          productId: item.id,
          qtyExpected: "",
          qtyReceived: "1",
          discrepancyReason: "",
          otherReason: "",
          batchNumber: "",
          expiryDate: "",
        },
      ];
    });
  };

  const processScannedCode = useCallback(
    async (rawValue: string) => {
      const trimmed = rawValue.trim();
      if (!trimmed) return;
      if (inventory.length === 0) {
        toast.error("No products found", {
          description: "Please refresh inventory first.",
        });
        return;
      }

      const digitsOnly = trimmed.replace(/\D/g, "");
      const lowerValue = trimmed.toLowerCase();
      const matchedItem =
        inventory.find(
          (item) =>
            item.barcode === trimmed ||
            (digitsOnly.length > 0 &&
              item.barcode === digitsOnly),
        ) ||
        inventory.find(
          (item) => item.sku.toLowerCase() === lowerValue,
        );

      if (!matchedItem) {
        toast.error("Barcode not found", {
          description: `No SKU matched scan: ${trimmed}`,
        });
        return;
      }

      setSavedGrnId(null);
      setSavedGrnNumber(null);
      setShowGrnForm(true);
      incrementReceivedForItem(matchedItem);
      setInventory((prev) =>
        prev.map((entry) => {
          if (entry.id !== matchedItem.id) return entry;
          const nextCount = entry.systemCount + 1;
          return {
            ...entry,
            systemCount: nextCount,
            lastUpdated: new Date().toISOString(),
            status:
              nextCount === 0
                ? "zero"
                : nextCount < MIN_STOCK_THRESHOLD
                  ? "low"
                  : "normal",
          };
        }),
      );

      try {
        const syncedItem = await receiveInventoryScan({
          product_id: matchedItem.id,
          product_uuid: matchedItem.productUuid,
          reserved_stock: matchedItem.reservedStock,
          increment: 1,
        });
        const nextOnHand = Number(syncedItem.systemCount ?? 0);

        setInventory((prev) =>
          prev.map((entry) => {
            if (entry.id !== matchedItem.id) return entry;
            return {
              ...entry,
              systemCount: nextOnHand,
              lastUpdated:
                syncedItem.lastUpdated || new Date().toISOString(),
              status:
                nextOnHand === 0
                  ? "zero"
                  : nextOnHand < MIN_STOCK_THRESHOLD
                    ? "low"
                    : "normal",
            };
          }),
        );

        toast.success("Barcode scanned", {
          description: `${matchedItem.sku} - Received +1 (stock synced)`,
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Realtime stock sync failed";
        toast.error(
          "Scan saved to GRN, but stock sync failed",
          {
            description: message,
          },
        );
      }
    },
    [inventory],
  );

  useEffect(() => {
    if (!isScanListening) return;
    let buffer = "";
    let clearTimer: ReturnType<typeof setTimeout> | null = null;

    const clearBufferSoon = () => {
      if (clearTimer) clearTimeout(clearTimer);
      clearTimer = setTimeout(() => {
        buffer = "";
      }, 120);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.key === "Enter") {
        if (buffer.trim()) {
          processScannedCode(buffer);
          buffer = "";
        }
        return;
      }
      if (event.key === "Escape") {
        buffer = "";
        return;
      }
      if (event.key.length === 1) {
        buffer += event.key;
        clearBufferSoon();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (clearTimer) clearTimeout(clearTimer);
    };
  }, [isScanListening, processScannedCode]);

  useEffect(() => {
    if (!isScanListening) return;
    scanInputRef.current?.focus();
  }, [isScanListening]);

  const handleScan = () => {
    if (isScanListening) {
      setIsScanListening(false);
      setScanInput("");
      toast.info("Scanner stopped");
      return;
    }
    if (inventory.length === 0) {
      toast.error("No products found", {
        description: "Please refresh inventory first.",
      });
      return;
    }

    setIsScanListening(true);
    setScanInput("");
    toast.success("Scanner ready", {
      description: "Enter Barcode/SKU in Scanner Input.",
    });
  };

  const stopCameraScanner = useCallback(() => {
    if (cameraScanTimerRef.current !== null) {
      window.clearTimeout(cameraScanTimerRef.current);
      cameraScanTimerRef.current = null;
    }
    if (cameraStreamRef.current) {
      cameraStreamRef.current
        .getTracks()
        .forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    if (scanVideoRef.current) {
      scanVideoRef.current.srcObject = null;
    }
    setIsCameraScanning(false);
  }, []);

  const startCameraScanner = useCallback(async () => {
    setCameraError(null);
    stopCameraScanner();
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError(
          "Camera API not available on this browser.",
        );
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
        },
        audio: false,
      });
      cameraStreamRef.current = stream;

      const video = scanVideoRef.current;
      if (!video) {
        setCameraError("Camera preview failed to initialize.");
        return;
      }
      video.srcObject = stream;
      await video.play();
      setIsCameraScanning(true);

      const BarcodeDetectorCtor = (window as any)
        .BarcodeDetector as
        | (new (opts?: { formats?: string[] }) => {
            detect: (
              source: HTMLVideoElement,
            ) => Promise<Array<{ rawValue?: string }>>;
          })
        | undefined;

      if (!BarcodeDetectorCtor) {
        setCameraError(
          "Auto-detect is not supported on this browser. Use scanner input below.",
        );
        return;
      }

      const detector = new BarcodeDetectorCtor({
        formats: [
          "ean_13",
          "upc_a",
          "upc_e",
          "code_128",
          "code_39",
        ],
      });

      const detectLoop = async () => {
        if (!scanVideoRef.current || !cameraStreamRef.current) {
          return;
        }
        try {
          const results = await detector.detect(
            scanVideoRef.current,
          );
          const nextValue = results?.[0]?.rawValue?.trim();
          if (nextValue) {
            processScannedCode(nextValue);
            if (navigator.vibrate) navigator.vibrate(60);
            setShowCameraScanner(false);
            return;
          }
        } catch {
          // Keep polling for next frame.
        }

        cameraScanTimerRef.current = window.setTimeout(
          detectLoop,
          180,
        );
      };

      detectLoop();
    } catch (error) {
      setCameraError(
        error instanceof Error
          ? error.message
          : "Unable to open camera.",
      );
    }
  }, [processScannedCode, stopCameraScanner]);

  useEffect(() => {
    if (showCameraScanner) {
      startCameraScanner();
      return;
    }
    stopCameraScanner();
  }, [
    showCameraScanner,
    startCameraScanner,
    stopCameraScanner,
  ]);

  useEffect(() => {
    return () => {
      stopCameraScanner();
    };
  }, [stopCameraScanner]);

  const handleViewGrn = () => {
    setShowGrnForm(true);
  };

  const uploadGrnCheckPhoto = async (grnId: string) => {
    if (!grnCheckPhoto) return null;

    const filePath = `${grnId}/${Date.now()}-${grnCheckPhoto.name}`;
    const { error: uploadError } = await supabaseQuality.storage
      .from("qc_evidence_photos")
      .upload(filePath, grnCheckPhoto, { upsert: true });

    if (uploadError) {
      toast.error("Upload failed", { description: uploadError.message });
      return null;
    }

    const { data } = supabaseQuality.storage
      .from("qc_evidence_photos")
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const handleSaveGrnChecks = async () => {
    if (!savedGrnId) {
      toast.error("Please save the GRN first before adding checks");
      return;
    }

    // Validate failed items have required discrepancy details
    const hasFailWithoutContext = Object.entries(grnChecks).some(([key, val]) => {
      if (val !== "fail") return false;
      const d = qcDiscrepancies[key];
      return !d?.reason_code || !d?.severity;
    });

    if (hasFailWithoutContext) {
      toast.error("Failed QC items require reason and severity.");
      return;
    }

    setSavingGrnChecks(true);

    const photoUrl = await uploadGrnCheckPhoto(savedGrnId);

    const { error } = await supabaseQuality
      .from("grn_quality_checks")
      .insert({
        grn_id: savedGrnId,
        checks: grnChecks,
        discrepancies: qcDiscrepancies,
        notes: grnCheckNotes || null,
        photo_url: photoUrl,
      });

    setSavingGrnChecks(false);

    if (error) {
      toast.error("Failed to save checks", { description: error.message });
      return;
    }

    try {
      const firstLine = lines[0];
      const firstProduct = inventory.find(
        (item) => item.id === firstLine?.productId,
      );
      const qcRows = Object.entries(grnChecks)
        .filter(([, value]) => value === "fail")
        .map(([checkKey]) => {
          const discrepancy = qcDiscrepancies[checkKey];
          const reasonCode = discrepancy?.reason_code
            ? toReasonCode(discrepancy.reason_code)
            : toReasonCode(checkKey);
          const severity = (discrepancy?.severity ||
            "Major") as "Minor" | "Major" | "Critical";

          return {
            shipment_reference: savedGrnNumber,
            product_sku: firstProduct?.sku || "QC-GRN",
            product_name:
              firstProduct?.name || "GRN Quality Check",
            batch_number:
              firstLine?.batchNumber?.trim() || "QC-CHECK",
            system_count: Number(firstLine?.qtyExpected || 0),
            physical_count: Number(firstLine?.qtyReceived || 0),
            discrepancy_units: 0,
            reason_code: reasonCode,
            status: "pending" as const,
            reported_by: "warehouse_operator",
            review_notes: grnCheckNotes || null,
            severity,
            evidence_urls: photoUrl ? [photoUrl] : [],
            supplier_name: supplierName.trim() || null,
          };
        });

      await syncShipmentDiscrepancies(
        savedGrnNumber || savedGrnId,
        qcRows,
      );
    } catch (syncError) {
      toast.error("QC saved but discrepancy sync failed", {
        description:
          syncError instanceof Error
            ? syncError.message
            : "Unknown discrepancy sync error",
      });
      return;
    }

    toast.success("GRN checks saved");
    // Reset form
    setGrnChecks({
      packaging_intact: "",
      correct_label: "",
      temperature_ok: "",
      expiry_ok: "",
    });
    setQcDiscrepancies({
      packaging_intact: { reason_code: "", severity: "" },
      correct_label: { reason_code: "", severity: "" },
      temperature_ok: { reason_code: "", severity: "" },
      expiry_ok: { reason_code: "", severity: "" },
    });
    setGrnCheckNotes("");
    setGrnCheckPhoto(null);
  };

  const addLine = () =>
    setLines((prev) => [...prev, createEmptyLine()]);
  const removeLine = (lineId: string) => {
    setSavedGrnId(null);
    setSavedGrnNumber(null);
    setLines((prev) => {
      if (prev.length === 1) {
        return [createEmptyLine()];
      }
      const next = prev.filter((l) => l.lineId !== lineId);
      return next.length > 0 ? next : [createEmptyLine()];
    });
  };
  const updateLine = (
    lineId: string,
    field: keyof GrnLine,
    value: string,
  ) => {
    setSavedGrnId(null);
    setSavedGrnNumber(null);
    const nextValue =
      field === "qtyExpected" || field === "qtyReceived"
        ? sanitizeIntegerInput(value)
        : value;
    setLines((prev) =>
      prev.map((l) =>
        l.lineId === lineId
          ? { ...l, [field]: nextValue }
          : l,
      ),
    );
  };

  const validateLines = (): boolean => {
    if (!receivedDate) {
      toast.error("Missing received date");
      return false;
    }

    if (
      lines.length === 0 ||
      (lines.length === 1 && !lines[0].productId)
    ) {
      toast.error("At least one line item is required");
      return false;
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const expected = Number(line.qtyExpected);
      const received = Number(line.qtyReceived);

      if (!line.productId) {
        toast.error(`Line ${i + 1}: Product is required`);
        return false;
      }
      if (
        line.qtyExpected === "" ||
        !Number.isFinite(expected) ||
        expected < 0
      ) {
        toast.error(
          `Line ${i + 1}: Qty expected must be 0 or higher`,
        );
        return false;
      }
      if (
        line.qtyReceived === "" ||
        !Number.isFinite(received) ||
        received < 1
      ) {
        toast.error(
          `Line ${i + 1}: Qty received must be 1 or higher`,
        );
        return false;
      }
      if (!line.batchNumber.trim()) {
        toast.error(`Line ${i + 1}: Batch/Lot # is required`);
        return false;
      }
      if (!line.expiryDate) {
        toast.error(`Line ${i + 1}: Expiry date is required`);
        return false;
      }

      const mismatch = expected !== received;
      if (mismatch && !line.discrepancyReason) {
        toast.error(
          `Line ${i + 1}: Discrepancy reason is required`,
        );
        return false;
      }
      if (
        mismatch &&
        line.discrepancyReason === "other" &&
        !line.otherReason.trim()
      ) {
        toast.error(`Line ${i + 1}: Please type Other reason`);
        return false;
      }
    }
    return true;
  };

  const buildPayloads = () => {
    const grnId = crypto.randomUUID();
    const dateStamp = receivedDate.replace(/-/g, "");
    const timeStamp = new Date()
      .toISOString()
      .slice(11, 19)
      .replace(/:/g, "");
    const grnNumber = `GRN-${dateStamp}-${timeStamp}`;
    const hasDiscrepancy = lines.some((line) => {
      const expected = Number(line.qtyExpected);
      const received = Number(line.qtyReceived);
      return (
        Number.isFinite(expected) &&
        Number.isFinite(received) &&
        expected !== received
      );
    });

    const headerPayload = {
      id: grnId,
      grn_number: grnNumber,
      received_date: receivedDate,
      notes: notes.trim() || null,
      status: "draft",
    };

    const linePayload = lines.map((line, idx) => {
      const product = inventory.find(
        (item) => item.id === line.productId,
      );
      const expected = Number(line.qtyExpected);
      const received = Number(line.qtyReceived);
      const mismatch = expected !== received;
      const reason = mismatch
        ? line.discrepancyReason === "other"
          ? line.otherReason.trim()
          : line.discrepancyReason
        : null;
      return {
        id: crypto.randomUUID(),
        grn_draft_id: grnId,
        line_no: idx + 1,
        product_id: product?.productUuid ?? line.productId,
        product_name: product?.name ?? "Unknown",
        sku: product?.sku ?? "N/A",
        qty_expected: expected,
        qty_received: received,
        variance: received - expected,
        discrepancy_reason: reason,
        batch_number: line.batchNumber.trim(),
        expiry_date: line.expiryDate || null,
      };
    });

    return { grnId, grnNumber, headerPayload, linePayload };
  };

  const syncShipmentDiscrepancies = useCallback(
    async (
      grnReference: string,
      rows: Array<{
        shipment_reference: string | null;
        product_sku: string;
        product_name: string;
        batch_number: string;
        system_count: number;
        physical_count: number;
        discrepancy_units: number;
        reason_code: string;
        status: "pending";
        reported_by: string;
        review_notes: string | null;
        severity: "Minor" | "Major" | "Critical";
        evidence_urls: string[];
        supplier_name: string | null;
      }>,
    ) => {
      if (!rows.length) return;

      const { data: existingRows, error: existingError } =
        await supabaseQuality
          .from("shipment_discrepancies")
          .select(
            "grn_reference,product_sku,batch_number,reason_code",
          )
          .eq("grn_reference", grnReference);

      if (existingError) {
        throw new Error(existingError.message);
      }

      const existingKeys = new Set(
        (existingRows || []).map(
          (row: any) =>
            [
              row.grn_reference,
              row.product_sku,
              row.batch_number,
              row.reason_code,
            ].join("|"),
        ),
      );

      const payload = rows
        .filter((row) => {
          const key = [
            grnReference,
            row.product_sku,
            row.batch_number,
            row.reason_code,
          ].join("|");
          return !existingKeys.has(key);
        })
        .map((row) => ({
          id: crypto.randomUUID(),
          grn_reference: grnReference,
          shipment_reference: row.shipment_reference,
          product_sku: row.product_sku,
          product_name: row.product_name,
          batch_number: row.batch_number,
          system_count: row.system_count,
          physical_count: row.physical_count,
          discrepancy_units: row.discrepancy_units,
          reason_code: row.reason_code,
          status: row.status,
          reported_by: row.reported_by,
          reported_at: new Date().toISOString(),
          review_notes: row.review_notes,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          severity: row.severity,
          evidence_urls: row.evidence_urls,
          supplier_name: row.supplier_name,
        }));

      if (!payload.length) return;

      const { error } = await supabaseQuality
        .from("shipment_discrepancies")
        .insert(payload);

      if (error) {
        throw new Error(error.message);
      }
    },
    [supabaseQuality, supplierName],
  );

  const saveToDatabase = async (
    headerPayload: object,
    linePayload: object[],
  ) => {
    await saveGrnDraft(headerPayload, linePayload);
  };

  const handleSaveGrn = async () => {
    if (!validateLines()) return;
    const { grnId, grnNumber, headerPayload, linePayload } =
      buildPayloads();
    setIsSaving(true);
    try {
      await saveToDatabase(headerPayload, linePayload);
      setSavedGrnId(grnId);
      setSavedGrnNumber(grnNumber);
      setIsPosted(false);
      toast.success(`GRN ${grnNumber} saved`, {
        description: `${linePayload.length} line item(s) recorded`,
      });
    } catch (error) {
      toast.error("Save failed", {
        description:
          error instanceof Error
            ? error.message
            : "Unknown error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePostGrn = async () => {
    if (!validateLines()) return;
    setIsPosting(true);
    try {
      let grnId = savedGrnId;
      let grnNumber = savedGrnNumber;

      if (!grnId) {
        const p = buildPayloads();
        grnId = p.grnId;
        grnNumber = p.grnNumber;
        await saveToDatabase(p.headerPayload, p.linePayload);
      }

      const result = await postGRN(
        grnId!,
        "warehouse_operator",
      );

      const lineDiscrepancyRows = lines
        .map((line) => {
          const product = inventory.find(
            (item) => item.id === line.productId,
          );
          const systemCount = Number(line.qtyExpected);
          const physicalCount = Number(line.qtyReceived);
          const discrepancyUnits = Math.abs(
            physicalCount - systemCount,
          );

          if (
            !Number.isFinite(systemCount) ||
            !Number.isFinite(physicalCount) ||
            discrepancyUnits === 0
          ) {
            return null;
          }

          const reason = line.discrepancyReason === "other"
            ? line.otherReason.trim()
            : line.discrepancyReason;

          return {
            shipment_reference: grnNumber || grnId,
            product_sku: product?.sku || "N/A",
            product_name: product?.name || "Unknown",
            batch_number: line.batchNumber.trim() || "N/A",
            system_count: systemCount,
            physical_count: physicalCount,
            discrepancy_units: discrepancyUnits,
            reason_code: toReasonCode(reason || "COUNT_MISMATCH"),
            status: "pending" as const,
            reported_by: "warehouse_operator",
            review_notes: notes.trim() || null,
            severity: deriveSeverity(discrepancyUnits),
            evidence_urls: [],
            supplier_name: supplierName.trim() || null,
          };
        })
        .filter(
          (
            row,
          ): row is NonNullable<typeof row> => Boolean(row),
        );

      if (lineDiscrepancyRows.length > 0) {
        await syncShipmentDiscrepancies(
          grnNumber || grnId,
          lineDiscrepancyRows,
        );
      }

      setIsPosted(true);
      setSavedGrnId(grnId);
      setSavedGrnNumber(grnNumber);

      toast.success(`GRN ${grnNumber} posted!`, {
        description: `${result.lines_processed} line(s) - ${result.products_updated} product(s) updated`,
      });
      notifyDashboardDataChanged("operations:grn-posted");

      await new Promise((r) => setTimeout(r, 600));
      await fetchInventory();

      setTimeout(() => {
        setReceivedDate(getTodayLocalDate());
        setNotes("");
        setLines([createEmptyLine()]);
        setShowGrnForm(false);
        setSavedGrnId(null);
        setSavedGrnNumber(null);
        setIsPosted(false);
      }, 2500);
    } catch (error) {
      console.error("handlePostGrn error:", error);
      toast.error("Post failed", {
        description:
          error instanceof Error
            ? error.message
            : String(error),
      });
    } finally {
      setIsPosting(false);
    }
  };

  const handleScheduleDelivery = async () => {
    // Validation
    if (!deliveryForm.delivery_datetime || !deliveryForm.supplier_name || 
        !deliveryForm.expected_items_count || !deliveryForm.warehouse_location) {
      toast.error("Validation Error", {
        description: "Please fill in all required fields marked with *",
      });
      return;
    }

    const expectedItemsCount = Number.parseInt(
      deliveryForm.expected_items_count,
      10,
    );
    if (
      !Number.isFinite(expectedItemsCount) ||
      expectedItemsCount < 1
    ) {
      setDeliveryFormErrors((prev) => ({
        ...prev,
        expected_items_count:
          "Expected items count must be 1 or more.",
      }));
      toast.error("Validation Error", {
        description: "Expected items count must be 1 or more.",
      });
      return;
    }

    if (
      deliveryForm.contact_phone &&
      !isPhoneValid(deliveryForm.contact_phone)
    ) {
      setDeliveryFormErrors((prev) => ({
        ...prev,
        contact_phone:
          "Phone number must be up to 10 digits.",
      }));
      toast.error("Validation Error", {
        description: "Phone number must be up to 10 digits.",
      });
      return;
    }

    setSchedulingDelivery(true);
    try {
      await scheduleWarehouseDelivery({
        delivery_datetime: deliveryForm.delivery_datetime,
        supplier_name: deliveryForm.supplier_name,
        expected_items_count: expectedItemsCount,
        warehouse_location: deliveryForm.warehouse_location,
        contact_person_name:
          deliveryForm.contact_person_name || null,
        contact_phone: deliveryForm.contact_phone || null,
        notes: deliveryForm.notes || null,
      });

      toast.success("Delivery scheduled successfully", {
        description: "The warehouse is now expecting this delivery.",
      });

      // Reset form and close dialog
      setDeliveryForm({
        delivery_datetime: "",
        supplier_name: "",
        expected_items_count: "",
        warehouse_location: "",
        contact_person_name: "",
        contact_phone: "",
        notes: "",
      });
      setDeliveryFormErrors({
        expected_items_count: "",
        contact_phone: "",
      });
      setShowDeliveryScheduleDialog(false);
    } catch (error) {
      toast.error("Failed to schedule delivery", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setSchedulingDelivery(false);
    }
  };

  const loadImage = (src: string): Promise<HTMLImageElement | null> =>
    new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });

  const handleDownloadGrn = useCallback(async () => {
    const validLines = lines.filter(
      (line) =>
        line.productId &&
        line.qtyExpected !== "" &&
        line.qtyReceived !== "",
    );

    if (validLines.length === 0) {
      toast.error("No GRN line items to export");
      return;
    }

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const logo = await loadImage("/logo.png");

    if (logo) {
      doc.addImage(logo, "PNG", 40, 30, 56, 56);
    }

    const grnNo = savedGrnNumber ?? `GRN-${receivedDate.replace(/-/g, "")}`;

    doc.setFontSize(16);
    doc.text("GOODS RECEIPT NOTE (GRN)", 110, 50);

    doc.setFontSize(10);
    doc.text(`GRN No: ${grnNo}`, 110, 70);
    doc.text(`Received Date: ${receivedDate}`, 110, 86);

    doc.setFontSize(11);
    doc.text("Supplier Information", 40, 120);
    doc.setFontSize(10);
    doc.text(`Name: ${supplierName || "N/A"}`, 40, 140);
    doc.text(`Contact: ${supplierContact || "N/A"}`, 40, 156);
    doc.text(`Address: ${supplierAddress || "N/A"}`, 40, 172);

    const bodyRows = validLines.map((line, idx) => {
      const item = inventory.find((i) => i.id === line.productId);
      const expected = Number(line.qtyExpected);
      const received = Number(line.qtyReceived);
      const variance = received - expected;

      return [
        String(idx + 1),
        item?.sku ?? "-",
        item?.name ?? "-",
        String(expected),
        String(received),
        String(variance),
      ];
    });

    autoTable(doc, {
      startY: 192,
      head: [["#", "SKU", "Product", "Qty Expected", "Qty Received", "Variance"]],
      body: bodyRows,
      theme: "grid",
      headStyles: { fillColor: [0, 163, 173] },
      styles: { fontSize: 9, cellPadding: 6 },
    });

    const finalY = (doc as any).lastAutoTable?.finalY ?? 220;

    doc.setFontSize(10);
    doc.text(`Notes: ${notes || "-"}`, 40, finalY + 24);
    doc.text("Generated by Pharma Distribution Management System", 40, finalY + 40);
    doc.text("Page 1", pageWidth - 60, pageHeight - 24);

    doc.save(`${grnNo}.pdf`);
  }, [
    lines,
    inventory,
    notes,
    receivedDate,
    savedGrnNumber,
    supplierName,
    supplierContact,
    supplierAddress,
  ]);

  return (
    <div className="p-4 space-y-6 bg-white pb-24 lg:pb-8">
      <div>
        <h1 className="text-2xl lg:text-4xl font-semibold mb-2 text-[#111827]">
          Warehouse Receiving & GRN
        </h1>
        <p className="text-sm lg:text-base text-[#6B7280]">
          Scan barcode and process GRN lines
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Button
          onClick={handleScan}
          className="h-20 bg-[#00A3AD] hover:bg-[#0891B2] text-white flex flex-col gap-2 shadow-md"
        >
          <ScanBarcode className="w-8 h-8" />
          <span className="font-semibold">
            {isScanListening ? "Stop Scanner" : "Scan Barcode"}
          </span>
        </Button>
        <Button
          onClick={handleViewGrn}
          variant="outline"
          className="h-20 border-[#00A3AD] text-[#00A3AD] hover:bg-[#00A3AD]/10 flex flex-col gap-2"
        >
          <Package className="w-8 h-8" />
          <span className="font-semibold">View GRN</span>
        </Button>
      </div>
      {isScanListening && (
        <Card className="bg-white border-[#00A3AD]/30 shadow-sm">
          <CardContent className="pt-4 space-y-2">
            <Label className="text-[#0F766E]">
              Scanner Input
            </Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                ref={scanInputRef}
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    processScannedCode(scanInput);
                    setScanInput("");
                  }
                }}
                placeholder="Scan or type barcode/SKU then press Enter"
                className="border-[#00A3AD]/30"
              />
              <Button
                type="button"
                onClick={() => {
                  processScannedCode(scanInput);
                  setScanInput("");
                }}
                className="bg-[#00A3AD] hover:bg-[#0891B2] text-white sm:min-w-32"
              >
                Submit Scan
              </Button>
            </div>
            <p className="text-xs text-[#6B7280]">
              Every valid scan increments matching line's Qty
              Received by 1.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Delivery Scheduling Dialog */}
      <Dialog open={showDeliveryScheduleDialog} onOpenChange={setShowDeliveryScheduleDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#111827] flex items-center gap-2">
              <Truck className="w-5 h-5" />
              Schedule Delivery
            </DialogTitle>
            <DialogDescription className="text-[#6B7280]">
              Schedule a delivery for warehouse receiving. Fill in the details below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-[#6B7280]">Delivery Date & Time *</Label>
              <Input
                type="datetime-local"
                value={deliveryForm.delivery_datetime}
                onChange={(e) => setDeliveryForm({ ...deliveryForm, delivery_datetime: e.target.value })}
                className="mt-2 border-[#111827]/10"
                disabled={schedulingDelivery}
              />
            </div>

            <div>
              <Label className="text-[#6B7280]">Supplier *</Label>
              <Select
                value={deliveryForm.supplier_name}
                onValueChange={(value) => {
                  const supplier = suppliers.find(
                    (row) => row.supplier_name === value,
                  );
                  setDeliveryForm({
                    ...deliveryForm,
                    supplier_name: value,
                    contact_person_name:
                      supplier?.contact_person ??
                      deliveryForm.contact_person_name,
                    contact_phone:
                      supplier?.phone ?? deliveryForm.contact_phone,
                  });
                }}
                disabled={schedulingDelivery || suppliers.length === 0}
              >
                <SelectTrigger className="mt-2 border-[#111827]/10">
                  <SelectValue
                    placeholder={
                      suppliers.length === 0
                        ? "No active suppliers found"
                        : "Select supplier"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem
                      key={supplier.id}
                      value={supplier.supplier_name}
                    >
                      {supplier.supplier_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-[#6B7280]">Expected Items Count *</Label>
              <Input
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                pattern="[0-9]*"
                value={deliveryForm.expected_items_count}
                onChange={(e) => {
                  setDeliveryForm({
                    ...deliveryForm,
                    expected_items_count: sanitizeIntegerInput(
                      e.target.value,
                    ),
                  });
                  setDeliveryFormErrors((prev) => ({
                    ...prev,
                    expected_items_count: "",
                  }));
                }}
                onKeyDown={(e) =>
                  blockInvalidNumberKeys(e)
                }
                placeholder="Enter expected number of items"
                className="mt-2 border-[#111827]/10"
                disabled={schedulingDelivery}
              />
              {deliveryFormErrors.expected_items_count && (
                <p className="mt-2 text-xs text-[#DC2626]">
                  {deliveryFormErrors.expected_items_count}
                </p>
              )}
            </div>

            <div>
              <Label className="text-[#6B7280]">Warehouse Location *</Label>
              <Select
                value={deliveryForm.warehouse_location}
                onValueChange={(value) => setDeliveryForm({ ...deliveryForm, warehouse_location: value })}
                disabled={schedulingDelivery || warehouseLocations.length === 0}
              >
                <SelectTrigger className="mt-2 border-[#111827]/10">
                  <SelectValue
                    placeholder={
                      warehouseLocations.length === 0
                        ? "No Product Master locations found"
                        : "Select warehouse location"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {warehouseLocations.map((location) => (
                    <SelectItem key={location} value={location}>
                      {location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-[#6B7280]">Contact Person Name</Label>
              <Input
                value={deliveryForm.contact_person_name}
                onChange={(e) => setDeliveryForm({ ...deliveryForm, contact_person_name: e.target.value })}
                placeholder="Enter contact person name"
                className="mt-2 border-[#111827]/10"
                disabled={schedulingDelivery}
              />
            </div>

            <div>
              <Label className="text-[#6B7280]">Contact Phone</Label>
              <Input
                value={deliveryForm.contact_phone}
                onChange={(e) => {
                  setDeliveryForm({
                    ...deliveryForm,
                    contact_phone: sanitizePhoneInput(
                      e.target.value,
                    ),
                  });
                  setDeliveryFormErrors((prev) => ({
                    ...prev,
                    contact_phone: "",
                  }));
                }}
                inputMode="numeric"
                maxLength={10}
                placeholder="Enter contact phone number"
                className="mt-2 border-[#111827]/10"
                disabled={schedulingDelivery}
              />
              {deliveryFormErrors.contact_phone && (
                <p className="mt-2 text-xs text-[#DC2626]">
                  {deliveryFormErrors.contact_phone}
                </p>
              )}
            </div>

            <div>
              <Label className="text-[#6B7280]">Notes</Label>
              <Input
                value={deliveryForm.notes}
                onChange={(e) => setDeliveryForm({ ...deliveryForm, notes: e.target.value })}
                placeholder="Additional notes (optional)"
                className="mt-2 border-[#111827]/10"
                disabled={schedulingDelivery}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowDeliveryScheduleDialog(false)}
                className="border-[#111827]/20 text-[#111827]"
                disabled={schedulingDelivery}
              >
                Cancel
              </Button>
              <Button
                onClick={handleScheduleDelivery}
                disabled={schedulingDelivery}
                className="bg-[#059669] hover:bg-[#047857] text-white"
              >
                {schedulingDelivery ? "Scheduling..." : "Schedule Delivery"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {showGrnForm && (
        <Accordion
          type="multiple"
          defaultValue={["grn-header", "pharma-checks", "line-items"]}
          className="space-y-4"
        >
          <AccordionItem value="grn-header" className="border-0">
          <Card className="bg-white border-[#111827]/10 shadow-lg">
            <CardHeader>
              <AccordionTrigger className="py-0 hover:no-underline">
                <CardTitle className="text-[#111827] font-semibold">
                  GRN Header
                </CardTitle>
              </AccordionTrigger>
            </CardHeader>
            <AccordionContent className="pb-0">
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-[#6B7280]">Received Date</Label>
                <Input
                  type="date"
                  value={receivedDate}
                  onChange={(e) => setReceivedDate(e.target.value)}
                  className="mt-2 border-[#111827]/10"
                  disabled={isPosted}
                />
              </div>

              <div>
                <Label className="text-[#6B7280]">Supplier</Label>
                <Select
                  value={supplierName}
                  onValueChange={(value) => {
                    const supplier = suppliers.find(
                      (row) => row.supplier_name === value,
                    );
                    setSupplierName(value);
                    setSupplierContact(
                      supplier?.phone || supplier?.email || "",
                    );
                    setSupplierAddress(supplier?.address || "");
                  }}
                  disabled={isPosted || suppliers.length === 0}
                >
                  <SelectTrigger className="mt-2 border-[#111827]/10">
                    <SelectValue
                      placeholder={
                        suppliers.length === 0
                          ? "No active suppliers found"
                          : "Select supplier"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier) => (
                      <SelectItem
                        key={supplier.id}
                        value={supplier.supplier_name}
                      >
                        {supplier.supplier_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[#6B7280]">Supplier Contact</Label>
                <Input
                  value={supplierContact}
                  onChange={(e) => setSupplierContact(e.target.value)}
                  placeholder="Phone or email"
                  className="mt-2 border-[#111827]/10"
                  disabled={isPosted}
                />
              </div>

              <div>
                <Label className="text-[#6B7280]">Notes (Optional)</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Supplier delivery note, issue summary, etc."
                  className="mt-2 border-[#111827]/10"
                  disabled={isPosted}
                />
              </div>

              <div className="md:col-span-2">
                <Label className="text-[#6B7280]">Supplier Address</Label>
                <Input
                  value={supplierAddress}
                  onChange={(e) => setSupplierAddress(e.target.value)}
                  placeholder="Supplier address"
                  className="mt-2 border-[#111827]/10"
                  disabled={isPosted}
                />
              </div>
            </CardContent>
            </AccordionContent>
          </Card>
          </AccordionItem>

          {/* Pharma Checks Section */}
          <AccordionItem value="pharma-checks" className="border-0">
          <Card className="bg-white border-[#111827]/10 shadow-lg">
            <CardHeader>
              <AccordionTrigger className="py-0 hover:no-underline">
                <CardTitle className="text-[#111827] font-semibold">
                  Pharma Checks
                </CardTitle>
              </AccordionTrigger>
              <p className="text-sm text-[#6B7280]">
                Complete the checklist and upload proof if needed.
              </p>
            </CardHeader>
            <AccordionContent className="pb-0">
            <CardContent>
              <div className="rounded-lg border border-[#E5E7EB] p-4 bg-[#F8FAFC] space-y-4">
                {[
                  { key: "packaging_intact", label: "Packaging Intact" },
                  { key: "correct_label", label: "Correct Labeling" },
                  { key: "temperature_ok", label: "Temperature OK" },
                  { key: "expiry_ok", label: "Expiry Date Valid" },
                ].map((check) => (
                  <div key={check.key} className="space-y-2">
                    <Label className="text-sm text-[#111827] font-medium">{check.label}</Label>
                    <RadioGroup
                      value={grnChecks[check.key]}
                      onValueChange={(val) =>
                        setGrnChecks((prev) => ({ ...prev, [check.key]: val }))
                      }
                      className="grid grid-cols-1 gap-3 sm:grid-cols-3"
                    >
                      <div className={`rounded-lg border px-3 py-3 transition-colors ${
                        grnChecks[check.key] === "pass"
                          ? "border-[#00A3AD] bg-[#ECFEFF] shadow-sm"
                          : "border-[#CBD5E1] bg-white hover:border-[#00A3AD]/50"
                      }`}>
                        <Label htmlFor={`${check.key}-pass`} className="flex cursor-pointer items-center gap-3 font-medium text-[#111827]">
                          <RadioGroupItem
                            value="pass"
                            id={`${check.key}-pass`}
                            className="size-5 border-[#64748B] text-[#00A3AD]"
                          />
                          <span>Pass</span>
                        </Label>
                      </div>
                      <div className={`rounded-lg border px-3 py-3 transition-colors ${
                        grnChecks[check.key] === "fail"
                          ? "border-[#DC2626] bg-[#FEF2F2] shadow-sm"
                          : "border-[#CBD5E1] bg-white hover:border-[#DC2626]/50"
                      }`}>
                        <Label htmlFor={`${check.key}-fail`} className="flex cursor-pointer items-center gap-3 font-medium text-[#111827]">
                          <RadioGroupItem
                            value="fail"
                            id={`${check.key}-fail`}
                            className="size-5 border-[#64748B] text-[#DC2626]"
                          />
                          <span>Fail</span>
                        </Label>
                      </div>
                      <div className={`rounded-lg border px-3 py-3 transition-colors ${
                        grnChecks[check.key] === "na"
                          ? "border-[#475569] bg-[#F8FAFC] shadow-sm"
                          : "border-[#CBD5E1] bg-white hover:border-[#475569]/50"
                      }`}>
                        <Label htmlFor={`${check.key}-na`} className="flex cursor-pointer items-center gap-3 font-medium text-[#111827]">
                          <RadioGroupItem
                            value="na"
                            id={`${check.key}-na`}
                            className="size-5 border-[#64748B] text-[#475569]"
                          />
                          <span>N/A</span>
                        </Label>
                      </div>
                    </RadioGroup>

                    {grnChecks[check.key] === "fail" && (
                      <div className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3 space-y-3 mt-2">
                        <p className="text-xs text-[#991B1B] font-semibold">
                          Required when failed
                        </p>

                        <div>
                          <Label className="text-xs text-[#111827] font-medium">Reason Code</Label>
                          <Select
                            value={qcDiscrepancies[check.key]?.reason_code || ""}
                            onValueChange={(val) =>
                              setQcDiscrepancies((prev) => ({
                                ...prev,
                                [check.key]: {
                                  ...prev[check.key],
                                  reason_code: val,
                                },
                              }))
                            }
                          >
                            <SelectTrigger className="mt-1 border-[#111827]/10 rounded-lg bg-white">
                              <SelectValue placeholder="Select reason code..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="damaged">Damaged</SelectItem>
                              <SelectItem value="label_mismatch">Label Mismatch</SelectItem>
                              <SelectItem value="temp_excursion">Temperature Excursion</SelectItem>
                              <SelectItem value="expiry_issue">Expiry Issue</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="text-xs text-[#111827] font-medium">Severity</Label>
                          <Select
                            value={qcDiscrepancies[check.key]?.severity || ""}
                            onValueChange={(val) =>
                              setQcDiscrepancies((prev) => ({
                                ...prev,
                                [check.key]: {
                                  ...prev[check.key],
                                  severity: val,
                                },
                              }))
                            }
                          >
                            <SelectTrigger className="mt-1 border-[#111827]/10 rounded-lg bg-white">
                              <SelectValue placeholder="Select severity..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="critical">Critical</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                <div>
                  <Label className="text-sm text-[#111827] font-medium">Notes</Label>
                  <Input
                    value={grnCheckNotes}
                    onChange={(e) => setGrnCheckNotes(e.target.value)}
                    placeholder="Enter notes (optional)"
                    className="mt-2 border-[#111827]/10 rounded-lg"
                  />
                </div>

                <div>
                  <Label className="text-sm text-[#111827] font-medium">Upload Photo</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setGrnCheckPhoto(e.target.files?.[0] ?? null)}
                    className="mt-2 border-[#111827]/10 rounded-lg"
                  />
                  {grnCheckPhoto && (
                    <p className="text-xs text-[#00A3AD] mt-1">
                      Selected: {grnCheckPhoto.name}
                    </p>
                  )}
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    onClick={() => void handleSaveGrnChecks()}
                    disabled={savingGrnChecks}
                    className="bg-[#00A3AD] hover:bg-[#0891B2] text-white"
                  >
                    {savingGrnChecks ? "Saving..." : "Save Checks"}
                  </Button>
                </div>
              </div>
            </CardContent>
            </AccordionContent>
          </Card>
          </AccordionItem>

          <AccordionItem value="line-items" className="border-0">
          <Card className="bg-white border-[#111827]/10 shadow-lg">
            <CardHeader>
              <AccordionTrigger className="py-0 hover:no-underline">
                <CardTitle className="text-[#111827] font-semibold">
                  Line Items
                </CardTitle>
              </AccordionTrigger>
            </CardHeader>
            <AccordionContent className="pb-0">
            <CardContent className="space-y-4">
              {lines.map((line, index) => {
                const expected = Number(line.qtyExpected);
                const received = Number(line.qtyReceived);
                const mismatch =
                  Number.isFinite(expected) &&
                  Number.isFinite(received) &&
                  line.qtyExpected !== "" &&
                  line.qtyReceived !== "" &&
                  expected !== received;
                return (
                  <div
                    key={line.lineId}
                    className="border border-[#E5E7EB] rounded-lg p-4 space-y-4 bg-[#F8FAFC]"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-[#111827]">
                        Line {index + 1}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        className="border-[#DC2626] text-[#DC2626] hover:bg-[#DC2626]/10"
                        onClick={() => removeLine(line.lineId)}
                        disabled={isPosted}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Remove
                      </Button>
                    </div>
                    {mismatch && (
                      <div className="rounded-md border border-[#F97316]/40 bg-[#FFF7ED] px-3 py-2">
                        <p className="text-sm font-semibold text-[#C2410C]">
                          Discrepancy detected
                        </p>
                        <p className="text-xs text-[#9A3412]">
                          Expected and received quantities do
                          not match. Please select a discrepancy
                          reason.
                        </p>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-[#6B7280]">
                          Product
                        </Label>
                        <SearchableProductSelect
                          options={inventory.map((item) => ({
                            sku: item.id,
                            name: `${item.name} (${item.sku})`,
                          }))}
                          value={line.productId}
                          onChange={(v) =>
                            updateLine(
                              line.lineId,
                              "productId",
                              v,
                            )
                          }
                          disabled={isPosted}
                          placeholder="Type or select product..."
                          className="mt-2"
                        />
                      </div>
                      <div>
                        <Label className="text-[#6B7280]">
                          Qty Expected
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={line.qtyExpected}
                          onChange={(e) =>
                            updateLine(
                              line.lineId,
                              "qtyExpected",
                              e.target.value,
                            )
                          }
                          onKeyDown={(e) =>
                            blockInvalidNumberKeys(e)
                          }
                          className="mt-2 border-[#111827]/10 bg-white"
                          placeholder="0"
                          disabled={isPosted}
                        />
                      </div>
                      <div>
                        <Label className="text-[#6B7280]">
                          Qty Received
                        </Label>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={line.qtyReceived}
                          onChange={(e) =>
                            updateLine(
                              line.lineId,
                              "qtyReceived",
                              e.target.value,
                            )
                          }
                          onKeyDown={(e) =>
                            blockInvalidNumberKeys(e)
                          }
                          className="mt-2 border-[#111827]/10 bg-white"
                          placeholder="0"
                          disabled={isPosted}
                        />
                      </div>
                      <div>
                        <Label className="text-[#6B7280]">
                          Batch/Lot # (Required)
                        </Label>
                        <Input
                          value={line.batchNumber}
                          onChange={(e) =>
                            updateLine(
                              line.lineId,
                              "batchNumber",
                              e.target.value,
                            )
                          }
                          className="mt-2 border-[#111827]/10 bg-white"
                          placeholder="Enter batch or lot number"
                          disabled={isPosted}
                        />
                      </div>
                      <div>
                        <Label className="text-[#6B7280]">
                          Expiry Date (Required)
                        </Label>
                        <Input
                          type="date"
                          value={line.expiryDate}
                          onChange={(e) =>
                            updateLine(
                              line.lineId,
                              "expiryDate",
                              e.target.value,
                            )
                          }
                          className="mt-2 border-[#111827]/10 bg-white"
                          disabled={isPosted}
                        />
                      </div>
                      <div>
                        <Label className="text-[#6B7280]">
                          Discrepancy Reason{" "}
                          {mismatch
                            ? "(Required)"
                            : "(Optional)"}
                        </Label>
                        <Select
                          value={line.discrepancyReason}
                          onValueChange={(v) =>
                            updateLine(
                              line.lineId,
                              "discrepancyReason",
                              v,
                            )
                          }
                          disabled={isPosted}
                        >
                          <SelectTrigger className="mt-2 border-[#111827]/10 bg-white">
                            <SelectValue placeholder="Select reason" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="damaged">
                              Damaged in Transit
                            </SelectItem>
                            <SelectItem value="shortage">
                              Supplier Shortage
                            </SelectItem>
                            <SelectItem value="count_error">
                              Count Error
                            </SelectItem>
                            <SelectItem value="expired">
                              Expired Items
                            </SelectItem>
                            <SelectItem value="other">
                              Other
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {mismatch &&
                      line.discrepancyReason === "other" && (
                        <div>
                          <Label className="text-[#6B7280]">
                            Type Other Reason
                          </Label>
                          <Input
                            value={line.otherReason}
                            onChange={(e) =>
                              updateLine(
                                line.lineId,
                                "otherReason",
                                e.target.value,
                              )
                            }
                            className="mt-2 border-[#111827]/10 bg-white"
                            placeholder="Enter reason"
                            disabled={isPosted}
                          />
                        </div>
                      )}
                  </div>
                );
              })}
              <Button
                onClick={addLine}
                variant="outline"
                className="w-full border-[#00A3AD] text-[#00A3AD] hover:bg-[#00A3AD]/10"
                disabled={isPosted}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Line Item
              </Button>
            </CardContent>
            </AccordionContent>
          </Card>
          </AccordionItem>
        </Accordion>
      )}

      <Card className="bg-white border-[#111827]/10 shadow-sm">
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-[#111827] font-semibold">
                Stock-on-Hand
              </CardTitle>
              <p className="text-sm text-[#6B7280]">
                Current inventory levels
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                value={stockSearch}
                onChange={(e) => setStockSearch(e.target.value)}
                placeholder="Search product or SKU"
                className="w-full sm:w-64 border-[#111827]/10"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={fetchInventory}
                disabled={loadingInventory}
                className="border-[#00A3AD] text-[#00A3AD] hover:bg-[#00A3AD]/10"
              >
                <RefreshCw
                  className={`w-4 h-4 mr-1 ${loadingInventory ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2">
              <p className="text-xs text-[#6B7280]">
                Total Products
              </p>
              <p className="text-lg font-semibold text-[#111827]">
                {inventory.length}
              </p>
            </div>
            <div className="rounded-md border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2">
              <p className="text-xs text-[#92400E]">
                Low Stock
              </p>
              <p className="text-lg font-semibold text-[#B45309]">
                {lowStockCount}
              </p>
            </div>
            <div className="rounded-md border border-[#FECACA] bg-[#FEF2F2] px-3 py-2">
              <p className="text-xs text-[#991B1B]">
                Out of Stock
              </p>
              <p className="text-lg font-semibold text-[#B91C1C]">
                {outOfStockCount}
              </p>
            </div>
          </div>

          {loadingInventory && inventory.length === 0 ? (
            <p className="text-sm text-[#6B7280] text-center py-4">
              Loading inventory...
            </p>
          ) : inventory.length === 0 ? (
            <p className="text-sm text-[#6B7280] text-center py-4">
              No products found in Product Master.
            </p>
          ) : filteredInventory.length === 0 ? (
            <p className="text-sm text-[#6B7280] text-center py-4">
              No products match your search.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[#E5E7EB]">
              <table className="w-full min-w-[780px] text-sm">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#E5E7EB]">
                    <th className="text-left py-3 px-4 font-semibold text-[#111827]">
                      SKU
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-[#111827]">
                      Product Name
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-[#111827]">
                      Unit
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-[#111827]">
                      Qty on-hand
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-[#111827]">
                      Last Updated
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pagedInventory.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-[#E5E7EB] last:border-b-0"
                    >
                      <td className="py-3 px-4 font-mono text-[#00A3AD]">
                        {item.sku}
                      </td>
                      <td className="py-3 px-4 font-medium text-[#111827]">
                        {item.name}
                      </td>
                      <td className="py-3 px-4 text-[#111827]">
                        {item.unit || "-"}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-semibold ${item.status === "zero" ? "text-[#F97316]" : "text-[#111827]"}`}
                        >
                          {item.systemCount.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#6B7280]">
                        {item.lastUpdated
                          ? new Date(
                              item.lastUpdated,
                            ).toLocaleString()
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between px-4 py-4 border-t border-[#E5E7EB] bg-white">
                <div className="text-xs text-[#6B7280]">
                  Page {inventoryPage} of {inventoryTotalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-[#111827]/20 text-[#111827]"
                    onClick={() =>
                      setInventoryPage((prev) =>
                        Math.max(1, prev - 1),
                      )
                    }
                    disabled={inventoryPage <= 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-[#111827]/20 text-[#111827]"
                    onClick={() =>
                      setInventoryPage((prev) =>
                        Math.min(
                          inventoryTotalPages,
                          prev + 1,
                        ),
                      )
                    }
                    disabled={
                      inventoryPage >= inventoryTotalPages
                    }
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {showGrnForm && (
        <div className="sticky bottom-0 z-10 p-4 bg-gradient-to-t from-white via-white to-transparent">
          <div className="max-w-2xl mx-auto space-y-2">
            {isPosted ? (
              <div className="w-full h-14 flex items-center justify-center gap-2 rounded-md bg-green-50 border border-green-300 text-green-700 font-semibold">
                <CheckCircle className="w-5 h-5" />
                Posted - {savedGrnNumber}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Button
                  onClick={handleSaveGrn}
                  disabled={isSaving || isPosting}
                  variant="outline"
                  className="h-14 border-[#00A3AD] text-[#00A3AD] hover:bg-[#00A3AD]/10 font-semibold disabled:opacity-50"
                >
                  <CheckCircle className="w-5 h-5 mr-2" />
                  {isSaving ? "Saving..." : "Save GRN"}
                </Button>

                <Button
                  onClick={handlePostGrn}
                  disabled={isSaving || isPosting}
                  className="h-14 bg-[#059669] hover:bg-[#047857] text-white shadow-lg font-semibold disabled:opacity-50"
                >
                  <SendHorizonal className="w-5 h-5 mr-2" />
                  {isPosting ? "Posting..." : "Post GRN"}
                </Button>

                <Button
                  onClick={handleDownloadGrn}
                  disabled={isSaving || isPosting}
                  variant="outline"
                  className="h-14 border-[#111827]/20 text-[#111827] hover:bg-[#111827]/5 font-semibold"
                >
                  <Download className="w-5 h-5 mr-2" />
                  Download GRN
                </Button>

                <Button
                  onClick={() => setShowDeliveryScheduleDialog(true)}
                  variant="outline"
                  className="h-14 border-[#F59E0B] text-[#F59E0B] hover:bg-[#F59E0B]/10 font-semibold"
                >
                  <Truck className="w-5 h-5 mr-2" />
                  Schedule Delivery
                </Button>
              </div>
            )}
            {!isPosted && savedGrnId && (
              <p className="text-xs text-center text-[#6B7280]">
                GRN saved as draft - click{" "}
                <strong>Post GRN</strong> to update inventory
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
