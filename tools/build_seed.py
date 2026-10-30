"""Generate supabase/seed.sql from site/src/data/catalog.json.

Every row is flagged is_sample = true: it is the product listing published on geoexcel.group, imported only so the
site has data to show. Nothing is invented (no prices, no units). Remove with supabase/delete_sample_data.sql.
Run: python tools/build_seed.py
"""
import io
import json

cat = json.load(io.open('site/src/data/catalog.json', encoding='utf8'))
categories = {k: v['name'] for k, v in cat['categories'].items()}


def q(s):
    """SQL string literal."""
    return "'" + str(s).replace("'", "''") + "'"


rows = []
for p in cat['products']:
    specs = dict(p['specs'])
    if p.get('note'):
        specs['Specification note'] = p['note']
    about = (p.get('about') or '').strip()
    desc = q(about[:600]) if about else 'null'
    rows.append(
        '  (%s, %s, %s, %s, %s::jsonb, %s, true, true)'
        % (q(p['name']), q(p['id']), q(categories[p['category']]), desc,
           q(json.dumps(specs, ensure_ascii=False)), q('img/products/%s.webp' % p['id']))
    )

sql = """-- SAMPLE DATA. Imported from the public product listing on https://www.geoexcel.group/ (crawled 30 Oct 2026).
-- Specifications are transcribed as published and NOT verified by Geo Excel. No prices and no units are included.
-- Every row has is_sample = true. To remove all of it: supabase/delete_sample_data.sql (not run automatically).
-- Safe to re-run: existing slugs are left untouched.

insert into public.products (name, slug, category, short_description, specs, image_url, is_active, is_sample)
values
%s
on conflict (slug) do nothing;
""" % ',\n'.join(rows)
io.open('supabase/seed.sql', 'w', encoding='utf8', newline='\n').write(sql)
print(len(rows), 'products ->', 'supabase/seed.sql')
