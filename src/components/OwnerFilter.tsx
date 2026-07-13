import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = {
  value: string;
  onChange: (v: string) => void;
  owners: string[];
  allValue?: string;
  allLabel?: string;
  className?: string;
  /** Optional partial name search (e.g. customer name on schedule page). */
  nameSearch?: string;
  onNameSearchChange?: (v: string) => void;
  nameSearchLabel?: string;
  nameSearchPlaceholder?: string;
};

export function OwnerFilter({
  value,
  onChange,
  owners,
  allValue = "all",
  allLabel = "كل الملاك",
  className,
  nameSearch,
  onNameSearchChange,
  nameSearchLabel = "بحث باسم الزبون",
  nameSearchPlaceholder = "اسم الزبون...",
}: Props) {
  const showNameSearch = onNameSearchChange != null;

  return (
    <div className={className}>
      <Label>المالك</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-1.5">
          <SelectValue placeholder="اختر المالك" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={allValue}>{allLabel}</SelectItem>
          {owners.map((o) => (
            <SelectItem key={o} value={o}>{o}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showNameSearch && (
        <div className="mt-2">
          <Label className="text-xs text-muted-foreground">{nameSearchLabel}</Label>
          <Input
            value={nameSearch ?? ""}
            onChange={(e) => onNameSearchChange(e.target.value)}
            placeholder={nameSearchPlaceholder}
            className="mt-1"
          />
        </div>
      )}
    </div>
  );
}
