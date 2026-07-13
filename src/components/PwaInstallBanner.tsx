import { useEffect, useState } from "react";
import { Share, X, Download, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  canShowInstallPrompt,
  dismissInstallPrompt,
  hasAndroidInstallPrompt,
  isAndroidDevice,
  isIosDevice,
  isStandalonePwa,
  triggerAndroidInstall,
} from "@/lib/pwa-install";

export function PwaInstallBanner() {
  const [visible, setVisible] = useState(false);
  const [androidReady, setAndroidReady] = useState(false);

  useEffect(() => {
    const sync = () => {
      setVisible(canShowInstallPrompt());
      setAndroidReady(hasAndroidInstallPrompt());
    };
    sync();
    window.addEventListener("pwa-install-available", sync);
    return () => window.removeEventListener("pwa-install-available", sync);
  }, []);

  if (!visible || isStandalonePwa()) return null;

  const ios = isIosDevice();
  const android = isAndroidDevice();

  const close = () => {
    dismissInstallPrompt();
    setVisible(false);
  };

  const onInstall = async () => {
    if (android && androidReady) {
      const ok = await triggerAndroidInstall();
      if (ok) setVisible(false);
      return;
    }
    close();
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[60] p-3 safe-x safe-bottom pointer-events-none"
      dir="rtl"
    >
      <div className="pointer-events-auto mx-auto max-w-lg rounded-2xl border border-accent/40 bg-card/95 backdrop-blur-md shadow-elegant p-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Smartphone className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-foreground">ثبّت تطبيق الشايب على هاتفك</p>
            {ios ? (
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                على iPhone: اضغط{" "}
                <Share className="inline w-3.5 h-3.5 align-text-bottom mx-0.5" />
                <span className="font-medium text-foreground">مشاركة</span> أسفل Safari،
                ثم اختر{" "}
                <span className="font-medium text-foreground">«إضافة إلى الشاشة الرئيسية»</span>.
              </p>
            ) : android ? (
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {androidReady
                  ? "اضغط «تثبيت التطبيق» لإضافة الشايب إلى شاشتك الرئيسية."
                  : "من قائمة Chrome ⋮ اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية»."}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                أضف الموقع إلى الشاشة الرئيسية لاستخدامه كتطبيق.
              </p>
            )}
            <div className="flex flex-wrap gap-2 mt-3">
              {android && androidReady && (
                <Button size="sm" className="gap-1.5 h-8" onClick={onInstall}>
                  <Download className="w-3.5 h-3.5" />
                  تثبيت التطبيق
                </Button>
              )}
              <Button size="sm" variant="outline" className="h-8" onClick={close}>
                {ios ? "فهمت" : "لاحقاً"}
              </Button>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            className="shrink-0 text-muted-foreground hover:text-foreground p-1 rounded-md"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
