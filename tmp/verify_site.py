from html.parser import HTMLParser
from pathlib import Path
import re

ROOT = Path(r"D:\shubh\coding\frelancing\work\eaglewood-polytechnic")


class Parser(HTMLParser):
    def error(self, message):
        raise ValueError(message)


html_files = sorted(ROOT.glob("*.html"))
missing = []
for path in html_files:
    source = path.read_text(encoding="utf-8")
    Parser().feed(source)
    for ref in re.findall(r"assets/(?:images|docs)/[^'\"\) >]+", source):
        if not (ROOT / ref).exists():
            missing.append((path.name, ref))
    required = ["<title>", 'name="description"', 'property="og:title"', "data-site-header", "data-site-footer"]
    absent = [item for item in required if item not in source]
    if absent:
        raise SystemExit(f"{path.name}: missing {absent}")

css = (ROOT / "assets/css/style.css").read_text(encoding="utf-8")
for ref in re.findall(r"\.\./images/[^'\"\)]+", css):
    if not (ROOT / "assets" / ref.replace("../", "")).exists():
        missing.append(("style.css", ref))

if missing:
    raise SystemExit(f"Missing assets: {missing}")
print(f"Verified {len(html_files)} HTML pages; all local asset references resolve.")
