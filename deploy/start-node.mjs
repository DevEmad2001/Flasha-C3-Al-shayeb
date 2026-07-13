import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import serverHandler from "./dist/server/server.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const CLIENT = join(__dirname, "dist", "client");
const PORT = Number(process.env.PORT || 3000);

const mimeTypes = {
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
};

async function readBody(req) {
  if (req.method === "GET" || req.method === "HEAD") return undefined;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function serveStatic(pathname, res) {
  const filePath = join(CLIENT, pathname);
  const data = await readFile(filePath);
  const type = mimeTypes[extname(pathname)] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable" });
  res.end(data);
}

createServer(async (req, res) => {
  try {
    const host = req.headers.host || "localhost";
    const url = new URL(req.url || "/", `http://${host}`);

    if (
      url.pathname.startsWith("/assets/") ||
      url.pathname === "/logo.png" ||
      url.pathname === "/apple-touch-icon.png" ||
      url.pathname === "/pwa-icon-192.png" ||
      url.pathname === "/pwa-icon-512.png" ||
      url.pathname === "/favicon.ico" ||
      url.pathname === "/manifest.webmanifest" ||
      url.pathname === "/sw.js"
    ) {
      try {
        await serveStatic(url.pathname, res);
        return;
      } catch {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
    }

    const body = await readBody(req);
    const request = new Request(`http://${host}${url.pathname}${url.search}`, {
      method: req.method,
      headers: req.headers,
      body,
    });

    const handler = serverHandler.fetch ? serverHandler : serverHandler.default;
    const response = await handler.fetch(request);
    const headers = Object.fromEntries(response.headers.entries());
    const buffer = Buffer.from(await response.arrayBuffer());
    res.writeHead(response.status, headers);
    res.end(buffer);
  } catch (error) {
    console.error(error);
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Internal Server Error");
  }
}).listen(PORT, "0.0.0.0", () => {
  console.log(`AlShaib web listening on ${PORT}`);
});
