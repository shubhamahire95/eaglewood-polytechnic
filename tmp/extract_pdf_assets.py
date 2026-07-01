import os
import shutil

import fitz
from PIL import Image, ImageDraw


BASE = r"D:\shubh\coding\frelancing\work\eaglewood-polytechnic"
PDF_PATH = os.path.join(BASE, "assets", "docs", "eaglewood-prospectus-2025.pdf")
PAGES_DIR = os.path.join(BASE, "tmp", "pdfs")
EXTRACTED_DIR = os.path.join(BASE, "tmp", "extracted")
ASSETS_DIR = os.path.join(BASE, "assets", "images")

os.makedirs(PAGES_DIR, exist_ok=True)
os.makedirs(EXTRACTED_DIR, exist_ok=True)
os.makedirs(ASSETS_DIR, exist_ok=True)

pdf = fitz.open(PDF_PATH)
thumbs = []

for page_index, page in enumerate(pdf):
    page_number = page_index + 1
    pixmap = page.get_pixmap(matrix=fitz.Matrix(1.25, 1.25), alpha=False)
    page_path = os.path.join(PAGES_DIR, f"page-{page_number:02}.png")
    pixmap.save(page_path)

    image = Image.open(page_path)
    image.thumbnail((220, 310))
    tile = Image.new("RGB", (240, 350), "white")
    tile.paste(image, ((240 - image.width) // 2, 25))
    ImageDraw.Draw(tile).text((10, 5), f"Page {page_number}", fill="black")
    thumbs.append(tile)

    for image_info in page.get_images(full=True):
        xref = image_info[0]
        data = pdf.extract_image(xref)
        width, height = data["width"], data["height"]
        if width < 200 or height < 180:
            continue
        filename = f"p{page_number:02}-x{xref}-{width}x{height}.{data['ext']}"
        with open(os.path.join(EXTRACTED_DIR, filename), "wb") as output:
            output.write(data["image"])

columns = 4
rows = (len(thumbs) + columns - 1) // columns
sheet = Image.new("RGB", (columns * 240, rows * 350), (225, 230, 230))
for index, tile in enumerate(thumbs):
    sheet.paste(tile, ((index % columns) * 240, (index // columns) * 350))
sheet.save(os.path.join(PAGES_DIR, "contact-sheet.jpg"), quality=90)

extracted_files = sorted(
    name for name in os.listdir(EXTRACTED_DIR) if name.lower().endswith((".jpg", ".jpeg", ".png"))
)
tiles = []
for filename in extracted_files:
    image = Image.open(os.path.join(EXTRACTED_DIR, filename)).convert("RGB")
    image.thumbnail((220, 160))
    tile = Image.new("RGB", (240, 200), "white")
    tile.paste(image, ((240 - image.width) // 2, 24))
    ImageDraw.Draw(tile).text((6, 5), filename[:38], fill="black")
    tiles.append(tile)

for sheet_index in range(0, len(tiles), 24):
    batch = tiles[sheet_index:sheet_index + 24]
    image_sheet = Image.new("RGB", (4 * 240, 6 * 200), (225, 230, 230))
    for index, tile in enumerate(batch):
        image_sheet.paste(tile, ((index % 4) * 240, (index // 4) * 200))
    output_name = f"extracted-sheet-{sheet_index // 24 + 1:02}.jpg"
    image_sheet.save(os.path.join(PAGES_DIR, output_name), quality=90)

# Export the strongest prospectus photographs with semantic, website-ready names.
asset_map = {
    "campus.jpg": "p01-x487-1263x720.jpeg",
    "hostel-exterior.jpg": "p04-x2054-1141x695.jpeg",
    "civil-department.jpg": "p08-x4023-852x566.jpeg",
    "computer-department.jpg": "p09-x4504-665x490.jpeg",
    "electrical-department.jpg": "p09-x4520-665x489.jpeg",
    "ai-department.jpg": "p10-x5006-666x490.jpeg",
    "computer-lab.jpg": "p11-x5502-665x489.jpeg",
    "laptop-lab.jpg": "p11-x5506-663x488.jpeg",
    "workshop.jpg": "p12-x5995-614x453.jpeg",
    "machine-lab.jpg": "p12-x5999-615x452.jpeg",
    "smart-classroom.jpg": "p12-x6000-615x452.jpeg",
    "electrical-lab.jpg": "p13-x6480-749x552.jpeg",
    "surveying-lab.jpg": "p14-x6486-662x450.jpeg",
    "graphics-lab.jpg": "p14-x6490-661x449.jpeg",
    "transport.jpg": "p14-x6500-658x449.jpeg",
    "library.jpg": "p14-x6502-661x450.jpeg",
    "reading-hall.jpg": "p14-x6505-563x312.jpeg",
    "chemistry-lab.jpg": "p15-x7456-662x450.jpeg",
    "physics-lab.jpg": "p15-x7457-662x449.jpeg",
    "dining-hall.jpg": "p15-x7462-661x450.jpeg",
    "hostel.jpg": "p15-x7468-662x450.jpeg",
    "hostel-building.jpg": "p15-x7470-662x449.jpeg",
    "annual-gathering.jpg": "p16-x7949-1227x677.jpeg",
    "annual-gathering-stage.jpg": "p16-x7950-993x548.jpeg",
    "poster-presentation.jpg": "p17-x8428-953x630.jpeg",
    "engineers-day.jpg": "p17-x8430-861x493.jpeg",
    "teachers-day.jpg": "p18-x8441-836x428.jpeg",
    "ganesh-festival.jpg": "p19-x8925-937x538.jpeg",
    "womens-day.jpg": "p19-x9398-704x404.jpeg",
    "yoga.jpg": "p19-x9401-703x403.jpeg",
    "personality-development.jpg": "p20-x9882-617x354.jpeg",
    "ncc-activity.jpg": "p20-x9883-616x354.jpeg",
    "traditional-day.jpg": "p20-x9886-615x353.jpeg",
    "drone-workshop.jpg": "p21-x10365-645x509.jpeg",
    "health-checkup.jpg": "p21-x10366-644x509.jpeg",
    "induction-programme.jpg": "p21-x10368-644x509.jpeg",
    "blood-donation.jpg": "p22-x10375-672x424.jpeg",
    "human-rights-workshop.jpg": "p22-x10376-1025x567.jpeg",
    "zonal-competition.jpg": "p22-x10850-674x430.jpeg",
    "student-achievements.jpg": "p23-x11330-490x312.jpeg",
    "republic-day.jpg": "p23-x11336-940x579.jpeg",
    "girls-volleyball.jpg": "p24-x11342-1195x527.jpeg",
    "boys-volleyball.jpg": "p24-x11343-1427x787.jpeg",
    "industrial-visit.jpg": "p25-x12294-665x526.jpeg",
    "industrial-visit-plant.jpg": "p26-x12785-598x473.jpeg",
    "site-visit.jpg": "p26-x12787-930x511.jpeg",
    "placement-guidance.jpg": "p27-x13266-669x419.jpeg",
    "placement-interview.jpg": "p27-x13267-668x419.jpeg",
}

for asset_name, source_name in asset_map.items():
    shutil.copyfile(os.path.join(EXTRACTED_DIR, source_name), os.path.join(ASSETS_DIR, asset_name))

# The crest is stored in the PDF as a JPEG plus a separate transparency mask.
base_pixmap = fitz.Pixmap(pdf, 522)
mask_pixmap = fitz.Pixmap(pdf, 523)
logo_pixmap = fitz.Pixmap(base_pixmap, mask_pixmap)
logo_pixmap.save(os.path.join(ASSETS_DIR, "logo.png"))

official_logo_path = os.path.join(ASSETS_DIR, "logo-official.jpg")
if os.path.exists(official_logo_path):
    official_logo = Image.open(official_logo_path).convert("RGB")
    official_logo.crop((65, 0, 250, official_logo.height)).save(
        os.path.join(ASSETS_DIR, "logo.jpg"), quality=95
    )
