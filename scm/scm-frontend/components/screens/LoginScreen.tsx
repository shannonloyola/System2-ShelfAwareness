"use client";

import { useState } from "react";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Checkbox } from "../ui/checkbox";
import { Logo } from "../Logo";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function LoginScreen() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!employeeId || !password) {
      toast.error("Missing Credentials", {
        description: "Please enter both Employee ID and Password"
      });
      return;
    }

    // Simulate login
    toast.success("Login Successful", {
      description: "Welcome to Shelf Awareness"
    });
    
    setTimeout(() => {
      router.push("/dashboard");
    }, 500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full h-screen grid grid-cols-1 lg:grid-cols-2">
        {/* Left Side - Solid Midnight Blue with Branding (6R Diamond Style) */}
        <div className="bg-[#1A2B47] hidden lg:flex flex-col items-center justify-center p-12">
          <Logo size="large" className="mb-8" />
          
          <div className="w-full max-w-md space-y-6 text-center">
            <div>
              <h2 className="text-4xl font-bold text-white mb-3" style={{ fontFamily: 'Public Sans, sans-serif' }}>
                Admin Portal
              </h2>
              <p className="text-white/80 text-lg">
                High-precision pharmaceutical supply chain management system
              </p>
            </div>

            {/* Feature Pills */}
            <div className="grid grid-cols-2 gap-3 pt-8">
              {[
                "Japan Procurement",
                "Warehouse Management",
                "Stock Tracking",
                "Payment Analytics"
              ].map((feature) => (
                <div 
                  key={feature}
                  className="px-4 py-3 bg-[#00A3AD] rounded-lg text-sm font-semibold text-white shadow-lg"
                  style={{ fontFamily: 'Public Sans, sans-serif' }}
                >
                  {feature}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side - Stark White Login Form */}
        <div className="bg-white flex flex-col items-center justify-center p-8 lg:p-16">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-8 flex justify-center">
            <Logo size="default" />
          </div>

          <div className="w-full max-w-md">
            <div className="mb-8">
              <h1 className="text-3xl lg:text-4xl font-bold text-[#1A2B47] mb-2" style={{ fontFamily: 'Public Sans, sans-serif' }}>
                Admin Portal Login
              </h1>
              <p className="text-[#6B7280]" style={{ fontFamily: 'Public Sans, sans-serif' }}>
                Enter your credentials to access the system
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              {/* Employee ID */}
              <div>
                <Label htmlFor="employeeId" className="text-[#111827] font-semibold mb-2 block" style={{ fontFamily: 'Public Sans, sans-serif' }}>
                  Employee ID
                </Label>
                <Input
                  id="employeeId"
                  type="text"
                  placeholder="Enter your Employee ID"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="h-12 border-[#E5E7EB] focus:border-[#00A3AD] focus:ring-[#00A3AD] rounded-lg"
                  style={{ fontFamily: 'Public Sans, sans-serif' }}
                />
              </div>

              {/* Password */}
              <div>
                <Label htmlFor="password" className="text-[#111827] font-semibold mb-2 block" style={{ fontFamily: 'Public Sans, sans-serif' }}>
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 pr-12 border-[#E5E7EB] focus:border-[#00A3AD] focus:ring-[#00A3AD] rounded-lg"
                    style={{ fontFamily: 'Public Sans, sans-serif' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#111827] transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  />
                  <Label 
                    htmlFor="remember" 
                    className="text-sm text-[#6B7280] cursor-pointer"
                    style={{ fontFamily: 'Public Sans, sans-serif' }}
                  >
                    Remember Me
                  </Label>
                </div>
                <button
                  type="button"
                  className="text-sm text-[#00A3AD] hover:underline font-semibold"
                  style={{ fontFamily: 'Public Sans, sans-serif' }}
                >
                  Forgot Password?
                </button>
              </div>

              {/* Login Button */}
              <Button
                type="submit"
                className="w-full h-12 bg-[#00A3AD] hover:bg-[#0891B2] text-white font-bold text-base shadow-lg rounded-lg"
                style={{ fontFamily: 'Public Sans, sans-serif' }}
              >
                Login
              </Button>

              {/* Security Notice */}
              <div className="mt-6 p-4 bg-[#FEF3C7] border border-[#F59E0B]/30 rounded-lg flex gap-3">
                <AlertCircle className="w-5 h-5 text-[#F97316] flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-bold text-[#111827] mb-1" style={{ fontFamily: 'Public Sans, sans-serif' }}>
                    Authorized Personnel Only
                  </div>
                  <div className="text-xs text-[#6B7280]" style={{ fontFamily: 'Public Sans, sans-serif' }}>
                    This pharmaceutical system is monitored. Unauthorized access is prohibited.
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
