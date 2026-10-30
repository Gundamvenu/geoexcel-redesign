"""Download the per-product photos published on geoexcel.group and write site/public/img/products/<id>.webp.
Pairing is by position on each live product page (image i belongs to listing i). Run after build_catalog.py."""
import json, io, os, subprocess, tempfile
from PIL import Image

cat = json.load(io.open('site/src/data/catalog.json', encoding='utf8'))
srcs = json.load(io.open('tools/product_images.json', encoding='utf8'))
os.makedirs('site/public/img/products', exist_ok=True)
tmp = tempfile.mkdtemp()
cache = {}
for p in cat['products']:
    c, i = p['_src']
    url = srcs[c][i]
    if url not in cache:
        f = os.path.join(tmp, f'{len(cache)}.img')
        subprocess.run(['curl', '-sL', '-m', '60', url, '-o', f], check=True)
        cache[url] = f
    im = Image.open(cache[url]).convert('RGB')
    im.thumbnail((720, 720))
    im.save(f"site/public/{p['image']}", quality=76)
print(len(cat['products']), 'images written')
