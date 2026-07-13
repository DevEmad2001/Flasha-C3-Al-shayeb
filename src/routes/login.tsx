import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { isAuthenticated, login } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

const LOGO_URL = "/logo.png";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const check = () => {
      if (isAuthenticated()) navigate({ to: "/" });
    };
    check();
    window.addEventListener("alshaib-auth-change", check);
    return () => window.removeEventListener("alshaib-auth-change", check);
  }, [navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await login(username, password);
    if (result.ok) {
      toast.success("تم تسجيل الدخول");
      navigate({ to: "/" });
    } else {
      toast.error(result.error || "اسم المستخدم أو كلمة السر غير صحيحة");
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-[100dvh] flex items-center justify-center px-4 py-6 safe-x safe-top safe-bottom bg-gradient-deep relative overflow-hidden"
      dir="rtl"
    >
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, oklch(0.74 0.12 80 / 0.25), transparent 40%), radial-gradient(circle at 80% 80%, oklch(0.36 0.10 265 / 0.5), transparent 45%)",
        }}
      />
      <Card className="relative w-full max-w-sm p-5 sm:p-7 bg-card border border-accent/30 shadow-elegant rounded-2xl">
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="w-24 h-24 rounded-2xl bg-white flex items-center justify-center overflow-hidden ring-4 ring-accent/30 shadow-soft">
            <img src={LOGO_URL} alt="الشايب للإسكان" className="w-20 h-20 object-contain" />
          </div>
          <h1 className="text-xl font-bold text-foreground">تسجيل الدخول</h1>
          <p className="text-sm text-muted-foreground">شركة الشايب للإسكان — لوحة الإدارة</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">اسم المستخدم</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              required
              dir="ltr"
              autoComplete="username"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              inputMode="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">كلمة السر</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pl-10"
                dir="ltr"
                autoComplete="current-password"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            دخول
          </Button>
        </form>
      </Card>
    </div>
  );
}
