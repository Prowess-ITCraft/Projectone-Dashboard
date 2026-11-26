/*
  Module types and the keyword rules that map an order line to one. Both are data, seeded into storage so an
  Admin screen can edit them later (context pack 06, section 6). `procedure` says whether a documented procedure exists.
*/
export const MODULE_TYPES = {
  server: { label: 'Server', procedure: true },
  domain_controller: { label: 'Domain controller', procedure: true },
  firewall: { label: 'Firewall', procedure: true },
  nas: { label: 'NAS', procedure: true },
  eps: { label: 'Endpoint protection', procedure: true },
  backup_software: { label: 'Backup software', procedure: false },
  cloud_backup: { label: 'Cloud backup', procedure: false },
  hosted_dr: { label: 'Hosted disaster recovery', procedure: false },
  network_router: { label: 'Router', procedure: false },
  network_switch: { label: 'Managed switch', procedure: false },
  access_switch: { label: 'Access switch', procedure: false },
  pam: { label: 'Privileged access (PAM)', procedure: false },
};

export const moduleLabel = (type) => MODULE_TYPES[type]?.label ?? 'Not set';

/* First match wins, so the more specific types come first (a "hosted VM Server" is hosted DR, not a server) */
export const DEFAULT_MODULE_RULES = [
  { moduleType: 'hosted_dr', patterns: ['phoenyx', 'hosted vm', 'live backup storage'] },
  { moduleType: 'cloud_backup', patterns: ['one drive', 'onedrive', 'cloud back up', 'cloud backup'] },
  /* Acronis sells XDR too, so this must sit above the backup rule, which would otherwise win on 'acronis' */
  { moduleType: 'eps', patterns: ['\\bxdr\\b', 'extended detection'] },
  { moduleType: 'backup_software', patterns: ['acronis', 'veeam'] },
  { moduleType: 'eps', patterns: ['intercept x', 'xdr', 'endpoint protection', '\\beps\\b', 'sanitization', 'sanitisation'] },
  { moduleType: 'firewall', patterns: ['sophos xgs', 'fortigate', 'sonicwall', 'firewall'] },
  { moduleType: 'nas', patterns: ['qnap', 'synology', '\\bnas\\b'] },
  { moduleType: 'access_switch', patterns: ['access switch'] },
  { moduleType: 'network_switch', patterns: ['managed switch', '\\bswitch\\b'] },
  { moduleType: 'network_router', patterns: ['router', 'asus rt-', 'wi-?fi'] },
  { moduleType: 'pam', patterns: ['\\bpam\\b', 'privileged access'] },
  { moduleType: 'domain_controller', patterns: ['ad ds', 'domain controller'] },
  { moduleType: 'server', patterns: ['thinksystem', 'poweredge', '\\bserver\\b'] },
];

/* Brands used to pair a service line with the product it follows when the service names no product type */
export const DEFAULT_BRANDS = [
  'sophos',
  'qnap',
  'synology',
  'acronis',
  'veeam',
  'one drive',
  'onedrive',
  'asus',
  'cisco',
  'fortigate',
  'sonicwall',
  'phoenyx',
  'dell',
  'lenovo',
  'hp',
];
