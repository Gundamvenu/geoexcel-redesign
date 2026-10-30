"""Submit ONE tagged test quotation through the public RPC (exactly what the website form does) and print the reference.
Usage: python tools/email_test.py you@example.com
Reads only the public URL + publishable key from site/.env. The email goes to the address you pass, so both
notification emails (admin alert + customer confirmation) can be checked in one inbox."""
import json, sys, urllib.request

env = dict(l.split('=', 1) for l in open('site/.env', encoding='utf8').read().split('\n') if '=' in l)
url, key = env['PUBLIC_SUPABASE_URL'], env['PUBLIC_SUPABASE_ANON_KEY']


def call(path, body=None):
    req = urllib.request.Request(url + path, data=json.dumps(body).encode() if body is not None else None,
                                 headers={'apikey': key, 'Content-Type': 'application/json'})
    return json.load(urllib.request.urlopen(req, timeout=30))


products = call('/rest/v1/products?select=id,slug&slug=in.(cardamom,pure-ghee)')
ids = {p['slug']: p['id'] for p in products}
ref = call('/rest/v1/rpc/submit_quotation', {
    'p_name': 'E2E TEST Buyer', 'p_company': 'E2E TEST Imports (safe to delete)', 'p_email': sys.argv[1], 'p_phone': '+10000000000',
    'p_message': 'E2E TEST: automated email check, safe to delete. <b>html</b> & "quotes" should appear escaped.',
    'p_items': [{'product_id': ids['cardamom'], 'quantity': 2, 'note': 'Size: 8mm bold | Quantity: 2 MT'},
                {'product_id': ids['pure-ghee'], 'quantity': None, 'note': 'Pack size: 1 lt'},
                {'product_id': None, 'product_name': 'Pulses & lentils <test>', 'quantity': 5, 'note': 'Quantity: 5 MT'}],
    'p_country': 'Testland', 'p_city': None, 'p_website': '',
})
print('reference:', ref)
