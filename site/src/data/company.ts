// Every fact here comes from geoexcel.group or from the certificate copies published on it.
export const company = {
  brand: 'Geo Excel',
  legalName: 'Geoexcel Production Trades Private Limited',
  tagline: 'Facilitating international & domestic trade',
  addressLines: ['3C-918, 3rd Floor, 3rd Cross, 1st Block', 'HRBR Layout, Kalyan Nagar', 'Bangalore 560043, Karnataka, India'],
  phone: '+91 8035110602',
  phoneHref: '+918035110602',
  email: 'info@geoexcel.group',
  liveSite: 'https://www.geoexcel.group/',
};

export type Credential = {
  id: string; short: string; title: string; issuer: string; scope: string; issued: string; validTo: string;
  note?: string; file: string; alt: string;
};

// Dates and scope are transcribed from the published scans (full-resolution read, 30 Oct 2026).
export const credentials: Credential[] = [
  {
    id: 'apeda', short: 'APEDA RCMC', title: 'Registration-cum-Membership Certificate (RCMC)',
    issuer: 'Agricultural and Processed Food Products Export Development Authority (APEDA), Bengaluru',
    scope: 'Merchant exporter. Registered for: export of frozen potato products such as French fries, potato wedges, hash brown, burger patties.',
    issued: '22 Dec 2023', validTo: '31 Mar 2028', file: 'apeda',
    alt: 'APEDA registration-cum-membership certificate issued to Geoexcel Production Trades Private Limited',
  },
  {
    id: 'fssai', short: 'FSSAI licence', title: 'Central Licence under the FSS Act, 2006',
    issuer: 'Food Safety and Standards Authority of India (FSSAI), Chennai',
    scope: 'Kind of business: Trade/Retail – Trader/Merchant – Exporter.',
    issued: '21 Feb 2024', validTo: '20 Feb 2025',
    note: 'Validity as printed on the copy; refer to the annexure on the certificate. Replace with the current licence copy (placeholder).',
    file: 'fssai', alt: 'FSSAI central licence page 1 for Geoexcel Production Trades Pvt Ltd',
  },
  {
    id: 'cle', short: 'Leather Exports RCMC', title: 'Registration-cum-Membership Certificate (RCMC)',
    issuer: 'Council for Leather Exports, Chennai',
    scope: 'Merchant exporter. Registered for: leather footwear.',
    issued: '02 Mar 2024', validTo: '31 Mar 2024',
    note: 'Validity as printed on the copy. Replace with the current certificate (placeholder).',
    file: 'cle', alt: 'Council for Leather Exports membership certificate issued to Geoexcel Production Trades Private Limited',
  },
  {
    id: 'udyam', short: 'Udyam (MSME)', title: 'Udyam Registration Certificate',
    issuer: 'Ministry of Micro, Small & Medium Enterprises, Government of India',
    scope: 'Enterprise registration under the Udyam scheme.', issued: 'See copy', validTo: 'See copy',
    file: 'msme', alt: 'Udyam registration certificate for Geoexcel Production Trades Private Limited',
  },
  {
    id: 'iec', short: 'Importer-Exporter Code', title: 'Importer-Exporter Code (IEC)',
    issuer: 'Directorate General of Foreign Trade (DGFT), Government of India',
    scope: 'Importer-Exporter Code issued to the company. Authenticity can be checked on the DGFT website, as the certificate itself notes.',
    issued: 'See copy', validTo: 'See copy', file: 'iec',
    alt: 'Importer-Exporter Code certificate issued to Geoexcel Production Trades Private Limited',
  },
];

export const timeline = [
  { when: '1980s', title: 'Agriculture', text: 'Started as farmers growing and harvesting rice, sugarcane and sesame.' },
  { when: '1990s', title: 'Cement & steel dealers', text: 'Diversified into cement and steel, a foundation for civil contracting services.' },
  { when: '1993–2014', title: 'Civil construction', text: 'Turn-key residential construction in Bangalore from 1993; by 2014 commercial, industrial and infrastructure work, plus own developments under the name “Anuadi Constructions”.' },
  { when: '2019', title: 'SDGs & CSR', text: 'Focus on the UN 17 Sustainable Development Goals and a passion-driven approach to CSR.' },
  { when: '2023', title: 'Birth of “Geo Excel”', text: 'Export trade of the products listed on this website.' },
];
