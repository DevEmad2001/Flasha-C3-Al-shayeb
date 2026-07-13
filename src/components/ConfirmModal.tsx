import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({ open, title, message, confirmLabel = "تأكيد", cancelLabel = "إلغاء", variant = "default", onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="sm:max-w-md text-center">
        <DialogHeader>
          <DialogTitle className="text-center">{title}</DialogTitle>
          <DialogDescription className="text-center text-base pt-2">{message}</DialogDescription>
        </DialogHeader>
        <div className="flex gap-3 justify-center pt-2">
          <Button variant="outline" onClick={onCancel}>{cancelLabel}</Button>
          {variant === "danger" ? (
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={onConfirm}>{confirmLabel}</Button>
          ) : (
            <Button onClick={onConfirm}>{confirmLabel}</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
