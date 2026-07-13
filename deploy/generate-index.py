"""Generate index.html for static SPA deployment from Vite client build."""
import glob
import os
import re

CLIENT = os.path.join(os.path.dirname(__file__), "..", "dist", "client")
OUT = os.path.join(CLIENT, "index.html")

assets = os.path.join(CLIENT, "assets")
js_files = sorted(glob.glob(os.path.join(assets, "index-*.js")), key=os.path.getsize, reverse=True)
css_files = sorted(glob.glob(os.path.join(assets, "styles-*.css")), key=os.path.getmtime, reverse=True)

if not js_files:
    raise SystemExit("No index-*.js found in dist/client/assets")

main_js = "/assets/" + os.path.basename(js_files[0])
main_css = ""
if css_files:
    main_css = f'    <link rel="stylesheet" href="/assets/{os.path.basename(css_files[0])}" />\n'

html = f"""<!DOCTYPE html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>الشايب للإسكان — نظام إدارة الإسكانات</title>
    <link rel="icon" type="image/png" href="/logo.png" />
{main_css}    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="{main_js}"></script>
  </body>
</html>
"""

with open(OUT, "w", encoding="utf-8", newline="\n") as f:
    f.write(html)

print(f"Wrote {OUT}")
print(f"  JS: {main_js}")
