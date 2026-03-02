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
  id: number;
  sku: string;
  product_name: string;
  barcode: string | null;
  inventory_on_hand: number;
}

interface PhysicalCount {
  id: string;
  product_id: number;
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
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [countedBy] = useState("Warehouse Staff"); // Could be made dynamic

  // Load recent counts on mount
  useEffect(() => {
    loadRecentCounts();
  }, []);

  const loadRecentCounts = async () => {
    try {
      const { data, error } = await supabase
        .from("physical_counts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      setRecentCounts(data || []);
    } catch (error: any) {
      console.error("Error loading recent counts:", error);
    }
  };

  const findProductByBarcode = async (barcode: string) => {
    if (!barcode.trim()) {
      toast.error("Please enter a barcode");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("barcode", barcode.trim())
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

    const count = parseInt(physicalCount);
    if (isNaN(count) || count < 0) {
      toast.error("Count cannot be negative", {
        description: "Please enter a valid count (0 or above)",
      });
      return;
    }

    if (physicalCount === "") {
      toast.error("Please enter a count");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("physical_counts")
        .insert([
          {
            product_id: selectedProduct.id,
            sku: selectedProduct.sku,
            product_name: selectedProduct.product_name,
            physical_count: count,
            counted_by: countedBy,
            system_count: selectedProduct.inventory_on_hand,
            variance: count - selectedProduct.inventory_on_hand,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      toast.success("Saved", {
        description: `${selectedProduct.product_name} — Count: ${count}`,
        icon: <CheckCircle2 className="w-5 h-5 text-[#00A3AD]" />,
      });

      // Add to recent counts at the top
      setRecentCounts((prev) => [data, ...prev.slice(0, 4)]);

      // Clear for next item
      setSelectedProduct(null);
      setPhysicalCount("");
      setManualBarcode("");
    } catch (error: any) {
      toast.error("Failed to save count", {
        description: error.message,
      });
    } finally {
      setLoading(false);
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
