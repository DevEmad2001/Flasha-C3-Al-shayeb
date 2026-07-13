import { authApi, getToken, setToken } from "@/lib/api";

const AUTH_EVENT = "alshaib-auth-change";

let cachedAuthed = false;

if (typeof window !== "undefined") {
  cachedAuthed = !!getToken();
  window.addEventListener(AUTH_EVENT, () => {
    cachedAuthed = !!getToken();
  });
}

export function isAuthenticated(): boolean {
  return cachedAuthed && !!getToken();
}

export async function login(
  username: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await authApi.login(username.trim(), password.trim());
    setToken(res.token);
    cachedAuthed = true;
    window.dispatchEvent(new Event(AUTH_EVENT));
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "فشل تسجيل الدخول";
    const network =
      msg.includes("Failed to fetch") ||
      msg.includes("NetworkError") ||
      msg.includes("Load failed");
    return {
      ok: false,
      error: network ? "تعذر الاتصال بالخادم. تحقق من الإنترنت وحاول مجدداً." : msg,
    };
  }
}

export async function logout() {
  setToken(null);
  cachedAuthed = false;
  window.dispatchEvent(new Event(AUTH_EVENT));
}

export async function updatePassword(
  newPassword: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await authApi.changePassword(newPassword);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "فشل تحديث كلمة السر" };
  }
}

export async function updateUsername(
  newUsername: string,
): Promise<{ ok: true; username: string } | { ok: false; error: string }> {
  try {
    const res = await authApi.changeUsername(newUsername);
    return { ok: true, username: res.username };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "فشل تحديث اسم المستخدم" };
  }
}

export async function getCurrentUsername(): Promise<string | null> {
  if (!getToken()) return null;
  try {
    const me = await authApi.me();
    return me.username;
  } catch {
    return null;
  }
}

export { getToken };
