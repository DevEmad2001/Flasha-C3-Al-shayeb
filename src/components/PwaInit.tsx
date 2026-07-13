import { useEffect } from "react";
import { registerPwa } from "@/lib/pwa";
import { captureInstallPrompt } from "@/lib/pwa-install";

export function PwaInit() {
  useEffect(() => {
    registerPwa();
    captureInstallPrompt();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.update());
      });
    }
  }, []);
  return null;
}
