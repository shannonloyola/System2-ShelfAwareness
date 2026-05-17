export function Logo({ 
  className = "", 
  size = "default",
  showSubtitle = true,
  layout = "row",
  customSubtitle = ""
}: { 
  className?: string; 
  size?: "small" | "default" | "large" | "huge"; 
  showSubtitle?: boolean;
  layout?: "row" | "col";
  customSubtitle?: string;
}) {
  const sizeClasses = {
    small: "w-32 h-12",
    default: "w-48 h-20",
    large: "w-64 h-28",
    huge: "w-96 h-48"
  };

  return (
    <div className={`flex ${layout === "col" ? "flex-col items-center text-center justify-center w-full h-auto" : "items-center gap-3 " + sizeClasses[size]} ${className}`}>
      {/* Medical Cross + Warehouse Shelf Icon */}
      <svg 
        viewBox="0 0 80 80" 
        className={`${size === "huge" ? "h-36 w-36" : "h-full w-auto"}`}
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Warehouse Shelf Structure */}
        <rect x="10" y="50" width="60" height="4" fill="white" />
        <rect x="10" y="35" width="60" height="4" fill="white" />
        <rect x="10" y="20" width="60" height="4" fill="white" />
        
        {/* Vertical supports */}
        <rect x="10" y="20" width="4" height="34" fill="white" />
        <rect x="66" y="20" width="4" height="34" fill="white" />
        
        {/* Medical Cross - Centered and overlaid */}
        <g transform="translate(30, 10)">
          {/* Cross background circle */}
          <circle cx="10" cy="10" r="12" fill="#00A3AD" />
          
          {/* Cross shape */}
          <rect x="7" y="4" width="6" height="12" fill="white" rx="1" />
          <rect x="4" y="7" width="12" height="6" fill="white" rx="1" />
          
          {/* Plus accent for pharmaceutical theme */}
          <circle cx="10" cy="10" r="3" fill="#00A3AD" />
        </g>
        
        {/* Small box icons on shelf */}
        <rect x="15" y="40" width="8" height="8" fill="#00A3AD" opacity="0.8" rx="1" />
        <rect x="28" y="40" width="8" height="8" fill="#00A3AD" opacity="0.6" rx="1" />
        <rect x="54" y="40" width="8" height="8" fill="#00A3AD" opacity="0.8" rx="1" />
      </svg>
      
      {/* Logo Text */}
      <div className={`flex flex-col justify-center ${layout === "col" ? "items-center mt-6" : ""}`}>
        <div 
          className="font-bold text-white leading-tight"
          style={{ 
            fontFamily: 'Public Sans, Inter, sans-serif',
            fontSize: size === "small" ? "1rem" : size === "large" ? "1.75rem" : size === "huge" ? "3.5rem" : "1.35rem"
          }}
        >
          Shelf Awareness
        </div>
        {showSubtitle && size !== "small" && (
          <div 
            className={`${size === "huge" ? "text-[#00A3AD] text-xl font-bold tracking-widest mt-4 uppercase" : "text-white/80 text-xs font-medium tracking-wide mt-1"}`}
            style={{ fontFamily: 'Public Sans, sans-serif' }}
          >
            {customSubtitle || "Medical Logistics Portal"}
          </div>
        )}
      </div>
    </div>
  );
}