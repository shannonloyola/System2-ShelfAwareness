import { Check } from "lucide-react";

interface TrackerStep {
  label: string;
  completed: boolean;
  active: boolean;
}

interface PerItemTrackerProps {
  poNumber: string;
  steps: TrackerStep[];
}

export function PerItemTracker({ poNumber, steps }: PerItemTrackerProps) {
  return (
    <div className="p-6 rounded-lg bg-white border-2 border-[#E5E7EB] shadow-sm">
      <div className="mb-6">
        <div className="font-bold text-[#111827] text-lg" style={{ fontFamily: 'Public Sans, sans-serif' }}>
          {poNumber}
        </div>
        <div className="text-sm text-[#6B7280]" style={{ fontFamily: 'Public Sans, sans-serif' }}>
          Order Progress Tracker
        </div>
      </div>

      <div className="relative">
        {/* Progress Line */}
        <div className="absolute top-6 left-0 w-full h-1 bg-[#E5E7EB]" style={{ zIndex: 0 }} />
        <div 
          className="absolute top-6 left-0 h-1 bg-[#00A3AD] transition-all duration-500" 
          style={{ 
            width: `${(steps.filter(s => s.completed).length / steps.length) * 100}%`,
            zIndex: 0
          }} 
        />

        {/* Steps */}
        <div className="relative flex justify-between" style={{ zIndex: 1 }}>
          {steps.map((step, index) => (
            <div key={index} className="flex flex-col items-center" style={{ width: `${100 / steps.length}%` }}>
              {/* Node Circle */}
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg ${
                  step.active
                    ? "bg-[#00A3AD] text-white scale-110 shadow-[#00A3AD]/50 animate-pulse"
                    : step.completed
                    ? "bg-[#00A3AD] text-white scale-110 shadow-[#00A3AD]/50"
                    : "bg-white border-2 border-[#E5E7EB] text-[#6B7280]"
                }`}
              >
                {step.completed ? (
                  <Check className="w-6 h-6" />
                ) : (
                  <div className="w-3 h-3 rounded-full bg-current" />
                )}
              </div>

              {/* Label */}
              <div
                className={`mt-3 text-xs text-center font-semibold transition-colors ${
                  step.completed || step.active ? "text-[#00A3AD]" : "text-[#6B7280]"
                }`}
                style={{ 
                  fontFamily: 'Public Sans, sans-serif',
                  maxWidth: '90px'
                }}
              >
                {step.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
