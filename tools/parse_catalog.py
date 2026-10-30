import re, json, io, sys
src = 'audit/content/'
files = {'rice':'general-9','spices':'copy-of-rice','iqf':'copy-of-whole-spices','oils':'copy-of-whole-spices-1'}
ZW = '​'
out = {}
for cat, f in files.items():
    lines = [l.replace(ZW,'').strip() for l in io.open(src+f+'.txt', encoding='utf8').read().split('\n')]
    body = lines[lines.index('Log In')+1:] if 'Log In' in lines else lines
    # find indices of DETAILS:
    idx = [i for i,l in enumerate(body) if l.upper().startswith('DETAILS')]
    items = []
    for n,i in enumerate(idx):
        j = i-1
        while j>=0 and not body[j]: j -= 1
        name = body[j]
        end = idx[n+1] if n+1 < len(idx) else len(body)
        # next product's name sits just before next DETAILS; cut it off
        k = end-1
        while k>i and not body[k]: k -= 1
        if n+1 < len(idx): end = k
        seg = body[i+1:end]
        details=[]; spec=[]; kv={}
        mode='details'
        for l in seg:
            if not l: continue
            u=l.upper()
            if u.startswith('DESCRIPTION'): mode='kv'; continue
            if u.startswith('SPECIFICATION'): mode='spec' if not mode=='kv' else 'spec'; 
            if u.startswith('SPECIFICATION'):
                rest=l.split(':',1)[1].strip() if ':' in l else ''
                if rest: spec.append(rest)
                mode = 'speckv' if cat!='rice' else 'specText'; continue
            if mode=='details': details.append(l)
            elif mode in('kv','speckv') and ':' in l:
                k_,v_=l.split(':',1); kv[k_.strip()]=v_.strip()
            elif mode in ('specText','spec'): spec.append(l)
            elif mode=='kv': spec.append(l)
            else: details.append(l)
        items.append({'name':name,'details':' '.join(details),'specs':kv,'note':' '.join(spec)})
    out[cat]=items
json.dump(out, io.open('tools/catalog_raw.json','w',encoding='utf8'), indent=1, ensure_ascii=False)
for c,v in out.items():
    print(c,len(v),[i['name'] for i in v])
