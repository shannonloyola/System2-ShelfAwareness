import { useState, useEffect } from "react";
import {
  Camera,
  Scan,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Package,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Label } from "../ui/label";
import { toast } from "sonner";
import { supabase } from "../../../lib/supabase";

interface Product {
  id: number | string;
  sku: string;
  product_name: string;
  barcode: string | null;
  inventory_on_hand: number;
}

interface PhysicalCount {
  id: string;
  product_id: number | string;
  sku: string;
  product_name: string;
  physical_count: number;
  counted_by: string;
  created_at: string;
}

export default function InventoryCount() {
  const [manualBarcode, setManualBarcode] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [physicalCount, setPhysicalCount] = useState("");
  const [recentCounts, setRecentCounts] = useState<PhysicalCount[]>([]);
  const [shelfItems, setShelfItems] = useState<Product[]>([]);
  const [loadingShelfItems, setLoadingShelfItems] = useState(false);
  const [mobileCountDrafts, setMobileCountDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [countedBy] = useState("Warehouse Staff"); // Could be made dynamic

  // Load recent counts on mount
  useEffect(() => {
    loadRecentCounts();
    loadShelfItems();
  }, []);

  const loadRecentCounts = async () => {
    try {
      // Table 'physical_counts' does not exist yet in schema
      // Gracefully handle by setting empty array
      setRecentCounts([]);
    } catch (error: any) {
      console.error("Error loading recent counts:", error);
    }
  };

  const loadShelfItems = async () => {
    setLoadingShelfItems(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .select("product_id,sku,product_name,barcode,inventory_on_hand")
        .order("product_name", { ascending: true })
        .limit(100);

      if (error) {
        throw error;
      }

      const normalized = (data ?? []).map((row: any) => ({
        id: row.product_id ?? row.id ?? "",
        sku: String(row.sku ?? "N/A"),
        product_name: String(row.product_name ?? "Unknown Product"),
        barcode: (row.barcode as string | null) ?? null,
        inventory_on_hand: Number(row.inventory_on_hand ?? 0),
      }));
      setShelfItems(normalized);
    } catch (error: any) {
      toast.error("Could not load shelf items", {
        description: error.message,
      });
      setShelfItems([]);
    } finally {
      setLoadingShelfItems(false);
    }
  };

  const saveCountForProduct = async (
    product: Product,
    rawCount: string,
    options?: { clearMainForm?: boolean },
  ) => {
    const count = parseInt(rawCount);
    if (rawCount === "") {
      toast.error("Please enter a count");
      return false;
    }
    if (isNaN(count) || count < 0) {
      toast.error("Count cannot be negative", {
        description: "Please enter a valid count (0 or above)",
      });
      return false;
    }

    setLoading(true);
    try {
      const mockData: PhysicalCount = {
        id: `count-${Date.now()}`,
        product_id: product.id,
        sku: product.sku,
        product_name: product.product_name,
        physical_count: count,
        counted_by: countedBy,
        created_at: new Date().toISOString(),
      };

      toast.success("Saved", {
        description: `${product.product_name} - Count: ${count}`,
        icon: <CheckCircle2 className="w-5 h-5 text-[#00A3AD]" />,
      });

      setRecentCounts((prev) => [mockData, ...prev.slice(0, 4)]);

      if (options?.clearMainForm !== false) {
        setSelectedProduct(null);
        setPhysicalCount("");
        setManualBarcode("");
      }
      return true;
    } catch (error: any) {
      toast.error("Failed to save count", {
        description: error.message,
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const findProductByBarcode = async (barcode: string) => {
    const trimmedBarcode = barcode.trim();
    if (!trimmedBarcode) {
      toast.error("Please enter a barcode");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("barcode", trimmedBarcode)
        .single();

      if (error || !data) {
        toast.error("No product found for this barcode", {
          description: "Please check the barcode and try again",
          icon: <AlertCircle className="w-5 h-5 text-[#F97316]" />,
        });
        setSelectedProduct(null);
        return;
      }

      setSelectedProduct(data);
      setPhysicalCount(""); // Reset count for new product
      toast.success("Product found!", {
        description: data.product_name,
        icon: <CheckCircle2 className="w-5 h-5 text-[#00A3AD]" />,
      });
    } catch (error: any) {
      toast.error("Barcode not recognized. Try again.", {
        description: error.message,
      });
      setSelectedProduct(null);
    } finally {
      setLoading(false);
    }
  };

  const handleScanClick = () => {
    setScanning(true);
    // Simulate camera preview - in production, integrate with a barcode scanner library
    toast.info("Camera scanning not implemented yet", {
      description: "Please use manual barcode input for now",
    });
    setTimeout(() => setScanning(false), 2000);
  };

  const handleSaveCount = async () => {
    if (!selectedProduct) {
      toast.error("Please scan or select a product first");
      return;
    }

    await saveCountForProduct(selectedProduct, physicalCount);
  };

  const handleMobileScanTap = (item: Product) => {
    setSelectedProduct(item);
    setManualBarcode(item.barcode ?? "");
    setPhysicalCount("");
    toast.info("Ready to scan/count", {
      description: `${item.product_name} selected`,
    });
  };

  const handleMobileCountTap = async (item: Product) => {
    const key = String(item.id);
    const rawCount = mobileCountDrafts[key] ?? "";
    const saved = await saveCountForProduct(item, rawCount, {
      clearMainForm: false,
    });
    if (saved) {
      setMobileCountDrafts((prev) => ({ ...prev, [key]: "" }));
    }
  };

  const canSave = selectedProduct && physicalCount !== "" && parseInt(physicalCount) >= 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-[#1A2B47] tracking-tight">
            Count Items
          </h1>
          <p className="text-slate-600 mt-2">
            Scan and enter physical count
          </p>
        </div>

        {/* Simplified Mobile Shelf Counting */}
        <div className="lg:hidden mb-6">
          <Card className="border-2 border-[#1A2B47]/10 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-[#1A2B47] to-[#1A2B47]/90">
              <CardTitle className="text-white">
                Shelf Counting (Mobile)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {loadingShelfItems ? (
                <p className="text-sm text-slate-500">Loading shelf items...</p>
              ) : shelfItems.length === 0 ? (
                <p className="text-sm text-slate-500">No shelf items found.</p>
              ) : (
                shelfItems.map((item) => {
                  const key = String(item.id);
                  return (
                    <div
                      key={key}
                      className="rounded-lg border border-slate-200 p-3 bg-white space-y-3"
                    >
                      <div>
                        <p className="font-semibold text-[#1A2B47] text-sm">
                          {item.product_name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {item.sku} | System: {item.inventory_on_hand}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          onClick={() => handleMobileScanTap(item)}
                          className="bg-[#00A3AD] hover:bg-[#0891B2] text-white"
                        >
                          Scan
                        </Button>
                        <Button
                          type="button"
                          onClick={() => handleMobileCountTap(item)}
                          disabled={loading || !(mobileCountDrafts[key] ?? "").trim()}
                          className="bg-[#F97316] hover:bg-[#EA580C] text-white"
                        >
                          Count
                        </Button>
                      </div>
                      <Input
                        type="number"
                        min="0"
                        placeholder="Physical count"
                        value={mobileCountDrafts[key] ?? ""}
                        onChange={(e) =>
                          setMobileCountDrafts((prev) => ({
                            ...prev,
                            [key]: e.target.value,
                          }))
                        }
                        className="h-11 border-slate-300"
                      />
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Desktop: Two-column layout / Mobile: Single column */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Main Panel - Left/Center */}
          <div className="lg:col-span-2 space-y-6">
            {/* Scan Section */}
            <Card className="border-2 border-[#1A2B47]/10 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-[#1A2B47] to-[#1A2B47]/90">
                <CardTitle className="text-white flex items-center gap-2">
                  <Scan className="w-5 h-5" />
                  Scan Barcode
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                {/* Scan Button */}
                <Button
                  onClick={handleScanClick}
                  disabled={scanning || loading}
                  className="w-full h-16 bg-[#00A3AD] hover:bg-[#0891B2] text-white text-lg font-semibold shadow-md transition-all"
                >
                  <Camera className="w-6 h-6 mr-3" />
                  {scanning ? "Scanning..." : "Scan with Camera"}
                </Button>

                {/* Manual Barcode Input */}
                <div className="relative">
                  <Label htmlFor="barcode" className="text-sm font-medium text-slate-700 mb-2 block">
                    Or enter barcode manually
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="barcode"
                      type="text"
                      placeholder="Enter barcode number"
                      value={manualBarcode}
                      onChange={(e) => setManualBarcode(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          findProductByBarcode(manualBarcode);
                        }
                      }}
                      className="h-14 text-lg border-2 border-slate-300 focus:border-[#00A3AD]"
                      disabled={loading}
                    />
                    <Button
                      onClick={() => findProductByBarcode(manualBarcode)}
                      disabled={loading || !manualBarcode.trim()}
                      className="h-14 px-6 bg-[#1A2B47] hover:bg-[#2A3B57] text-white font-medium"
                    >
                      <Search className="w-5 h-5 mr-2" />
                      Find
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Item Details Card - Only show when product is selected */}
            {selectedProduct && (
              <Card className="border-2 border-[#00A3AD] shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-300">
                <CardHeader className="bg-gradient-to-r from-[#00A3AD] to-[#0891B2]">
                  <CardTitle className="text-white flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Item Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Product Name</p>
                      <p className="text-xl font-bold text-[#1A2B47]">
                        {selectedProduct.product_name}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-slate-500 mb-1">SKU</p>
                        <p className="font-mono text-base font-semibold text-slate-700">
                          {selectedProduct.sku}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500 mb-1">Barcode</p>
                        <p className="font-mono text-base font-semibold text-slate-700">
                          {selectedProduct.barcode || "N/A"}
                        </p>
                      </div>
                    </div>
                    <div className="bg-slate-100 p-4 rounded-lg border border-slate-200">
                      <p className="text-sm text-slate-600 mb-1">System Count</p>
                      <p className="text-2xl font-bold text-[#1A2B47]">
                        {selectedProduct.inventory_on_hand}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Physical Count Input - Only show when product is selected */}
            {selectedProduct && (
              <Card className="border-2 border-[#1A2B47]/10 shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
                <CardHeader>
                  <CardTitle className="text-[#1A2B47]">
                    Physical Count
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="count" className="text-sm font-medium text-slate-700 mb-2 block">
                      Enter the actual count you see on the shelf
                    </Label>
                    <Input
                      id="count"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={physicalCount}
                      onChange={(e) => setPhysicalCount(e.target.value)}
                      className="h-20 text-3xl font-bold text-center border-2 border-slate-300 focus:border-[#00A3AD]"
                      disabled={loading}
                    />
                  </div>

                  {/* Save Button */}
                  <Button
                    onClick={handleSaveCount}
                    disabled={!canSave || loading}
                    className="w-full h-16 bg-[#F97316] hover:bg-[#EA580C] text-white text-lg font-bold shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <CheckCircle2 className="w-6 h-6 mr-3" />
                    {loading ? "Saving..." : "Save Count"}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Empty State - Show when no product selected */}
            {!selectedProduct && (
              <Card className="border-2 border-dashed border-slate-300 bg-slate-50">
                <CardContent className="py-16 text-center">
                  <Scan className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                  <p className="text-slate-500 text-lg">
                    Scan or enter a barcode to begin counting
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Recent Counts Panel - Right */}
          <div className="lg:col-span-1">
            <Card className="border-2 border-[#1A2B47]/10 shadow-lg sticky top-8">
              <CardHeader className="bg-gradient-to-r from-[#1A2B47] to-[#1A2B47]/90">
                <CardTitle className="text-white flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Recent Counts
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 max-h-[600px] overflow-y-auto">
                {recentCounts.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-slate-400">No counts yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentCounts.map((count, index) => (
                      <div
                        key={count.id}
                        className="p-4 bg-white border border-slate-200 rounded-lg hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <p className="font-semibold text-sm text-[#1A2B47] line-clamp-2 flex-1">
                            {count.product_name}
                          </p>
                          <span className="ml-2 text-2xl font-bold text-[#00A3AD]">
                            {count.physical_count}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span className="font-mono">{count.sku}</span>
                          <span>
                            {new Date(count.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

