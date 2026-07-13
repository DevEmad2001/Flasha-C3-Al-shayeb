import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRecipients } from "@/hooks/useCatalog";

const CUSTOM = "__custom__";

type Props = {
  value: string;
  onChange: (v: string) => void;
  label?: string;
};

export function RecipientField({ value, onChange, label = "الواصل (لمن وصلت الدفعة)" }: Props) {
  const { names } = useRecipients();
  const inList = value !== "" && names.includes(value);
  const [mode, setMode] = useState<"list" | "custom">(inList || value === "" ? "list" : "custom");

  useEffect(() => {
    if (value === "") setMode("list");
    else if (names.includes(value)) setMode("list");
    else setMode("custom");
  }, [value, names]);

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select
        value={mode === "custom" ? CUSTOM : (value || "__none__")}
        onValueChange={(v) => {
          if (v === CUSTOM) {
            setMode("custom");
            onChange("");
          } else if (v === "__none__") {
            setMode("list");
            onChange("");
          } else {
            setMode("list");
            onChange(v);
          }
        }}
      >
        <SelectTrigger><SelectValue placeholder="اختر الواصل" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">—</SelectItem>
          {names.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
          <SelectItem value={CUSTOM}>إدخال يدوي...</SelectItem>
        </SelectContent>
      </Select>
      {mode === "custom" && (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="اسم غير موجود في القائمة"
        />
      )}
    </div>
  );
}
