import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getCurrentUsername, updatePassword, updateUsername } from "@/lib/auth";
import { backupApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Eye, EyeOff, Download } from "lucide-react";
import { CatalogManager } from "@/components/CatalogManager";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pl-10"
          dir="ltr"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          tabIndex={-1}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

function SettingsPage() {
  const [username, setUsername] = useState<string>("");
  const [userLoading, setUserLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleUpdateUsername = async () => {
    if (!username.trim() || username.trim().length < 2) return toast.error("اسم المستخدم قصير جداً");
    setUserLoading(true);
    const res = await updateUsername(username.trim());
    setUserLoading(false);
    if (!res.ok) return toast.error(`تعذر تحديث اسم المستخدم: ${res.error}`);
    setUsername(res.username);
    toast.success("تم تحديث اسم المستخدم بنجاح");
  };

  const handleDownloadBackup = async () => {
    setDownloading(true);
    try {
      const blob = await backupApi.download();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `alshaib_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("تم تحميل النسخة الاحتياطية بنجاح");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل تحميل النسخة الاحتياطية");
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    getCurrentUsername().then((u) => setUsername(u ?? ""));
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return toast.error("الرجاء إدخال كلمة السر الجديدة");
    if (password.length < 6) return toast.error("كلمة السر يجب أن تكون 6 أحرف على الأقل");
    if (password !== confirm) return toast.error("كلمة السر وتأكيدها غير متطابقتين");
    setLoading(true);
    const res = await updatePassword(password);
    setLoading(false);
    if (!res.ok) return toast.error(`تعذر تحديث كلمة السر: ${res.error}`);
    setPassword("");
    setConfirm("");
    toast.success("تم تحديث كلمة السر بنجاح");
  };

  return (
    <div className="p-3 sm:p-6 max-w-4xl mx-auto w-full min-w-0 space-y-4 sm:space-y-6 pb-8" dir="rtl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">الإعدادات</h1>
        <p className="text-sm text-muted-foreground mt-1">إدارة الحساب والنسخ الاحتياطي والخيارات</p>
      </div>

      <Card className="p-4 sm:p-6">
        <h2 className="font-semibold mb-4">تعديل الحساب</h2>
        <div className="space-y-4 max-w-md">
          <div className="space-y-2">
            <Label htmlFor="username">اسم المستخدم</Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} dir="ltr" className="flex-1" />
              <Button variant="outline" onClick={handleUpdateUsername} disabled={userLoading}>{userLoading ? "جاري الحفظ..." : "حفظ"}</Button>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4 sm:p-6">
        <h2 className="font-semibold mb-4">تغيير كلمة السر</h2>
        <form onSubmit={onSubmit} className="space-y-4 max-w-md">
          <PasswordField id="password" label="كلمة السر الجديدة" value={password} onChange={setPassword} placeholder="6 أحرف على الأقل" />
          <PasswordField id="confirm" label="تأكيد كلمة السر" value={confirm} onChange={setConfirm} />
          <Button type="submit" disabled={loading}>{loading ? "جاري الحفظ..." : "حفظ التغييرات"}</Button>
        </form>
      </Card>

      <Card className="p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Download className="w-5 h-5 text-blue-500" />
              <h2 className="text-lg font-bold">النسخ الاحتياطي</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              تصدير جميع بيانات النظام (مشاريع، زبائن، دفعات، مصاريف، مخزون) كملف JSON
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleDownloadBackup} disabled={downloading} className="bg-blue-500 hover:bg-blue-600 text-white shadow-sm">
              <Download className="w-4 h-4 ml-1" />
              {downloading ? "جاري التحميل..." : "تنزيل كل البيانات"}
            </Button>
          </div>
        </div>
      </Card>

      <div>
        <h2 className="text-lg font-bold mb-3">إدارة الخيارات والقوائم</h2>
        <p className="text-sm text-muted-foreground mb-4">
          أضف أو عدّل القوائم المنسدلة المستخدمة في النظام. التغييرات تنعكس فوراً على كل الصفحات.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <CatalogManager type="payment_method" />
          <CatalogManager type="expense" />
          <CatalogManager type="recipient" />
        </div>
      </div>
    </div>
  );
}
