/**
 * Two-tone brand text: "NanoCircuit" in primary color, ".lk" in secondary/teal,
 * with "ELECTRONICS STORE" tagline below — matching the brand identity image.
 */
interface BrandTextProps {
  storeName?: string;
  showTagline?: boolean;
  size?: "sm" | "md" | "lg";
}

const BrandText = ({ storeName = "NanoCircuit.lk", showTagline = false, size = "md" }: BrandTextProps) => {
  // Split at the last dot before a TLD to get two-tone effect
  // e.g. "NanoCircuit.lk" → ["NanoCircuit", ".lk"]
  const dotIndex = storeName.lastIndexOf(".");
  const main = dotIndex > 0 ? storeName.slice(0, dotIndex) : storeName;
  const tld = dotIndex > 0 ? storeName.slice(dotIndex) : "";

  const sizeClasses = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl",
  };

  const taglineSizeClasses = {
    sm: "text-[8px]",
    md: "text-[9px]",
    lg: "text-[10px]",
  };

  return (
    <div className="flex flex-col leading-none">
      <span className={`font-bold font-display tracking-tight ${sizeClasses[size]}`}>
        <span className="text-primary">{main}</span>
        {tld && <span className="text-secondary">{tld}</span>}
      </span>
      {showTagline && (
        <span
          className={`font-semibold font-display tracking-[0.25em] uppercase text-secondary mt-0.5 ${taglineSizeClasses[size]}`}
        >
          Electronics Store
        </span>
      )}
    </div>
  );
};

export default BrandText;
