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
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export function LoginScreen() {
  const router = useRouter();
  const { loginAsMockAdmin } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error("Missing Credentials", {
        description: "Please enter both Email and Password",
      });
      return;
    }

    setIsLoading(true);
    
    // Developer Mock Bypass for Local Testing (Avoid email confirmation lock)
    if (email === "admin@shelfawareness.com" && password === "password123") {
      loginAsMockAdmin(email);
      toast.success("Login Successful (Developer Bypass)", {
        description: "Logged in as Administrator",
      });
      setIsLoading(false);
      router.push("/dashboard");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setIsLoading(false);

    if (error) {
      toast.error("Login Failed", {
        description: error.message,
      });
      return;
    }

    toast.success("Login Successful", {
      description: "Welcome to Shelf Awareness",
    });

    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full h-screen grid grid-cols-1 lg:grid-cols-2">
        {/* Left Side - Solid Midnight Blue with Branding (6R Diamond Style) */}
        <div className="bg-[#1A2B47] hidden lg:flex flex-col items-center justify-center p-12">
          <Logo size="huge" layout="col" showSubtitle={true} customSubtitle="Supply Chain Management Portal" />
        </div>

        {/* Right Side - Stark White Login Form */}
        <div className="bg-white flex flex-col items-center justify-center p-8 lg:p-16">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-8 flex justify-center">
            <Logo size="default" showSubtitle={false} />
          </div>

          <div className="w-full max-w-md">
            <div className="mb-8">
              <h1 className="text-2xl lg:text-3xl font-bold text-[#1A2B47] mb-2 leading-tight" style={{ fontFamily: 'Public Sans, sans-serif' }}>
                Welcome to Shelf Awareness
              </h1>
              <p className="text-[#6B7280]" style={{ fontFamily: 'Public Sans, sans-serif' }}>
                Enter your credentials to access the system
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              {/* Email */}
              <div>
                <Label htmlFor="email" className="text-[#111827] font-semibold mb-2 block" style={{ fontFamily: 'Public Sans, sans-serif' }}>
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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

              {/* Login Button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-[#00A3AD] hover:bg-[#0891B2] text-white font-bold text-base shadow-lg rounded-lg disabled:opacity-60"
                style={{ fontFamily: 'Public Sans, sans-serif' }}
              >
                {isLoading ? "Logging in..." : "Login"}
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
