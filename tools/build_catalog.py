import json, io, re
raw = json.load(io.open('tools/catalog_raw.json', encoding='utf8'))
KEYMAP = {
 'packaging size available':'Pack size','packaging size':'Pack size','packaging':'Pack size',
 'packaging type available':'Packaging type','packaging type':'Packaging type','packing':'Packaging type',
 'hns code':'HS code','hns code ':'HS code',
 'shelve life':'Shelf life','shelf life':'Shelf life',
 'region of origin':'Region','state':'Region',
 'color':'Colour','colour':'Colour',
 'country of origin':'Country of origin','country of orgin':'Country of origin',
 'extraction method':'Extraction method','variety available':'Variety','grade':'Grade','grades':'Grade',
 'botanical name':'Botanical name','product shape & size':'Form','storage':'Storage','moisture':'Moisture','broken':'Broken',
 'texture':'Texture','polished':'Polish','features':'Features','purity':'Purity','speciality':'Speciality','total ash':'Total ash',
 'acid insoluble ash':'Acid-insoluble ash','extraneous matter':'Extraneous matter','light berries':'Light berries','baby colves':'Baby cloves',
 'cardamom size':'Sizes','ingredients':'Ingredients','allergen info':'Allergen info',
}
ORDER = ['Variety','Grade','Form','Region','Country of origin','Colour','Polish','Texture','Broken','Moisture','Purity','Extraneous matter','Light berries','Baby cloves','Total ash','Acid-insoluble ash','Sizes','Botanical name','Extraction method','Pack size','Packaging type','Storage','Shelf life','Ingredients','Allergen info','Features','Speciality','HS code']
TYPO = {'Brocolli':'Broccoli','BROCOLLI':'BROCCOLI','Shelve':'Shelf','protine':'protein','minireals':'minerals','Colves':'Cloves','Florest':'Florets','Shredds':'Shreds','Kennels':'Kernels','Orgin':'Origin','Mace Flower (Javitri)':'Mace Flower (Javitri)'}
def fix(s):
    for a,b in TYPO.items(): s=s.replace(a,b)
    s = s.replace('�','é')
    return re.sub(r'\s+',' ',s).strip()
def title(n):
    n = fix(n)
    keep = {'IR','PR','IQF','A2','1121','1401','1509','UNDA'}
    out=[]
    for w in n.split(' '):
        u=w.upper()
        out.append(w if (u in keep or re.match(r'^\(?[A-Z]+\)?$',w) and u in keep) else w.capitalize())
    return ' '.join(out).replace('(Unda)','(Unda)')
def slug(n): return re.sub(r'[^a-z0-9]+','-',n.lower()).strip('-')

DROP = {  # duplicates in source
 ('rice',4):'duplicate of 1509 Basmati Sella (source lists it twice with different moisture)',
 ('rice',13):'duplicate of PR 11 Steam Long Grain (source lists it twice)',
}
BAD_NOTE = {'JEERAKASALA RICE','PALAKADDAN MATTA RICE (UNDA)'}   # spec paragraph copy-pasted from 1121 Basmati
BAD_SPECIALITY = {'1401 PUSA BASMATI STEAM RICE','PR 11 Steam Long Grain Rice'}  # says "Pure 1509 Basmati rice"
CATS = {
 'rice':{'name':'Rice','blurb':'Basmati, parboiled and regional non-basmati rice, sortexed, in 5–50 kg packs.'},
 'spices':{'name':'Whole spices','blurb':'Whole spices and seeds from Kerala, Karnataka and beyond, packed 1–50 kg.'},
 'iqf':{'name':'IQF frozen vegetables & potato','blurb':'Individually quick frozen vegetables and potato products, stored at −18 °C.'},
 'oils':{'name':'Edible oils & ghee','blurb':'Cold-pressed oils and ghee in bottles, cans and drums.'},
}
flags=[]
out=[]
for cat, items in raw.items():
    for i,it in enumerate(items):
        if (cat,i) in DROP: flags.append(f"{cat}: dropped '{it['name']}' – {DROP[(cat,i)]}"); continue
        specs={}
        for k,v in it['specs'].items():
            nk=KEYMAP.get(k.lower().strip(), k.strip())
            v=fix(v)
            if not v or v in('-',':'): continue
            if nk=='Speciality' and it['name'] in BAD_SPECIALITY and 'Pure 1509' in v:
                flags.append(f"{it['name']}: omitted Speciality '{v}' (says 1509 on a different variety)"); continue
            if nk=='Shelf life' and it['name']=='NUTMEG': flags.append("NUTMEG: omitted shelf life '14Yr' (implausible)"); continue
            specs[nk]=v
        note=fix(it['note'])
        m=re.match(r'Region of Origin\s*([A-Za-z ,&]+?)\s+(Moisture|Average|Avg)',note)
        if m and 'Region' not in specs:
            specs['Region']=m.group(1).strip(); note=note[len(m.group(0))-len(m.group(2)):]
        # Pusa special: region text fused into note
        if it['name'] in BAD_NOTE: flags.append(f"{it['name']}: omitted specification paragraph (copy of 1121 Basmati text)"); note=''
        details=fix(it['details'])
        if it['name']=='NUTMEG': flags.append("NUTMEG: omitted description (source text describes Mace Flower)"); details=''
        # keep only descriptive sentences: drop unverifiable claims (price/manufacturer) from the source copy
        sents=re.split(r'(?<=[.!?])\s+',details)
        keep=[]
        for sn in sents:
            if re.search(r'market leading prices|renowned manufacturer|Our offered rice is grown|precisely processed',sn): 
                if 'widely consumed' not in sn: continue
            sn=re.sub(r'^Provided\s+','',sn)
            keep.append(sn)
        details=' '.join(keep)
        ordered={k:specs[k] for k in ORDER if k in specs}
        ordered.update({k:v for k,v in specs.items() if k not in ordered})
        out.append({'id':slug(fix(it['name'])),'_src':[cat,i],'category':cat,'name':title(it['name']),'about':details,'specs':ordered,'note':note})
# ensure unique ids
seen={}
for p in out:
    if p['id'] in seen: seen[p['id']]+=1; p['id']+=f"-{seen[p['id']]}"
    else: seen[p['id']]=1
for p in out:
    p['image']=f"img/products/{p['id']}.webp"
json.dump({'categories':CATS,'products':out}, io.open('site/src/data/catalog.json','w',encoding='utf8'), indent=1, ensure_ascii=False)
io.open('tools/catalog_flags.txt','w',encoding='utf8').write('\n'.join(flags))
print(len(out),'products'); print('\n'.join(flags))
