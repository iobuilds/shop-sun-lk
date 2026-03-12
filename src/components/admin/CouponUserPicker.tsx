import { useState, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { X, Search, Plus } from "lucide-react";

interface CouponUserPickerProps {
  allProfiles: any[];
  selectedPhones: string;
  onChange: (phones: string) => void;
}

const CouponUserPicker = ({ allProfiles, selectedPhones, onChange }: CouponUserPickerProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const selectedList = selectedPhones.split(",").map(p => p.trim()).filter(Boolean);

  const filteredPickerUsers = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return [];
    const term = searchTerm.toLowerCase();
    return (allProfiles || [])
      .filter((p: any) => {
        const phone = (p.phone || "").replace(/\s/g, "");
        if (!phone) return false;
        if (selectedList.includes(phone)) return false;
        return (
          phone.toLowerCase().includes(term) ||
          (p.full_name || "").toLowerCase().includes(term)
        );
      })
      .slice(0, 10);
  }, [searchTerm, allProfiles, selectedList]);

  const addUser = (phone: string) => {
    const clean = phone.replace(/\s/g, "");
    if (selectedList.includes(clean)) return;
    const updated = [...selectedList, clean].join(", ");
    onChange(updated);
    setSearchTerm("");
    setShowDropdown(false);
  };

  const removeUser = (phone: string) => {
    const updated = selectedList.filter(p => p !== phone).join(", ");
    onChange(updated);
  };

  const getProfileByPhone = (phone: string) =>
    allProfiles?.find((p: any) => (p.phone || "").replace(/\s/g, "") === phone);

  return (
    <div className="space-y-2">
      <Label>Assign Users</Label>
      {selectedList.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedList.map(phone => {
            const prof = getProfileByPhone(phone);
            return (
              <span key={phone} className="inline-flex items-center gap-1 bg-secondary/10 text-secondary text-xs px-2 py-1 rounded-full">
                <span className="font-medium">{prof?.full_name || "Unknown"}</span>
                <span className="text-secondary/60">{phone}</span>
                <button onClick={() => removeUser(phone)} className="ml-0.5 hover:text-destructive"><X className="w-3 h-3" /></button>
              </span>
            );
          })}
        </div>
      )}
      <div className="relative">
        <div className="flex items-center border border-input rounded-md bg-background px-3">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            placeholder="Search by name or phone..."
            className="flex-1 h-9 px-2 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </div>
        {showDropdown && filteredPickerUsers.length > 0 && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
            {filteredPickerUsers.map((p: any) => (
              <button
                key={p.id}
                onClick={() => addUser(p.phone)}
                className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center justify-between"
              >
                <div>
                  <span className="font-medium text-foreground">{p.full_name || "—"}</span>
                  <span className="ml-2 text-muted-foreground">{p.phone}</span>
                </div>
                <Plus className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
        {showDropdown && searchTerm.length >= 2 && filteredPickerUsers.length === 0 && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg p-3 text-sm text-muted-foreground text-center">
            No users found
          </div>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground">Search users by name or phone to assign them. {selectedList.length} user(s) selected.</p>
    </div>
  );
};

export default CouponUserPicker;
