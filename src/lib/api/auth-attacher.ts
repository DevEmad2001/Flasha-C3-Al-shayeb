import { createMiddleware } from "@tanstack/react-start";
import { getToken } from "@/lib/api/client";

export const attachApiAuth = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const token = getToken();
  return next({
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
});
