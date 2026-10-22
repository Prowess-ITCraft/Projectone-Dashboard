/* ProjectOne – static data: components, task templates, questionnaires.
   Tasks flagged `true` as 3rd element are DEMO steps (not from the project plan file). */


/* Generic DEMO templates for components that have no steps in the project plan */
const demoTasks = (name) => ({
  new: [
    ['Installation', `Site survey & prerequisite validation for ${name}`, true],
    ['Installation', 'Licence, account & access provisioning', true],
    ['Installation', `Deploy ${name} in staging environment`, true],
    ['Installation', 'Integrate with directory / network services', true],
    ['Configuration', 'Baseline policy configuration', true],
    ['Configuration', 'Populate look-up table with policy data', true],
    ['Configuration', 'Pilot group rollout & tuning', true],
    ['Configuration', 'Alerting & log forwarding to SIEM', true],
    ['Configuration', 'UAT, evidence capture & sign-off', true],
  ],
  existing: [
    ['Installation', 'Snapshot / back up the current configuration', true],
    ['Installation', 'Version, health & licence assessment', true],
    ['Installation', 'Patch / upgrade to the approved release', true],
    ['Configuration', 'Review existing policies against look-up table', true],
    ['Configuration', 'Fine-tune & harden settings', true],
    ['Configuration', 'Regression test & rollback verification', true],
    ['Configuration', 'Document changes as audit evidence', true],
  ],
});

/* Steps taken from the project plan (checklist file) */
const FINAL = ['Configuration', 'Final testing and hand over'];

const PLAN = {
  switch: {
    new: [
      ['Installation', 'Managed Switch Installation swapping unmanaged switches'],
      ['Configuration', 'Managed Switch Configuration setup'],
      FINAL,
    ],
    existing: [
      ['Installation', 'Managed Switch Installation swapping unmanaged switches'],
      ['Configuration', 'Managed Switch Configuration setup'],
      ['Configuration', 'Re-verify VLAN, port & uplink configuration', true],
      FINAL,
    ],
  },
  nas: {
    new: [
      ['Installation', 'QNAP Setup Installation'],
      ['Installation', 'Backup Application Setup and mapping with QNAP'],
      ['Configuration', 'Initiating Data Porting backup'],
      ['Configuration', 'Data porting completion and verification'],
      ['Configuration', 'Defining Data backup folders, mapping & configuring'],
      ['Configuration', 'Defining Data backup schedule'],
      FINAL,
    ],
    existing: [
      ['Installation', 'Backup Application Setup and mapping with QNAP'],
      ['Configuration', 'Initiating Data Porting backup'],
      ['Configuration', 'Populating the Look-up table with policy data'],
      ['Configuration', 'Daily verification of the progress, tracking & maneuvering'],
      ['Configuration', 'Data porting completion and verification'],
      ['Configuration', 'Defining Data backup folders, mapping & configuring'],
      ['Configuration', 'Defining Data backup schedule'],
      FINAL,
    ],
  },
  firewall: {
    new: [
      ['Installation', 'Unbox, rack & power the new firewall', true],
      ['Installation', 'Assign management IP & register licence', true],
      ['Installation', 'Firmware update, finetuning & hardening'],
      ['Configuration', 'Define interfaces, zones & routing', true],
      ['Configuration', 'Populating the Look-up table with policy data'],
      ['Configuration', 'Create user / group policies from the look-up table', true],
      ['Configuration', 'Bandwidth allocation (High / Med / Low) & web filtering', true],
      ['Configuration', 'Back up configuration & failover test', true],
      FINAL,
    ],
    existing: [
      ['Installation', 'Firewalls Firmware update, finetuning & hardening'],
      ['Configuration', 'Populating the Look-up table with policy data'],
      ['Configuration', 'Reconcile existing rules with look-up table', true],
      ['Configuration', 'Daily verification of the progress, tracking & maneuvering'],
      FINAL,
    ],
  },
  server: {
    new: [
      ['Installation', 'Dell R740 Server formatting, WinOS Installation and VM Creation'],
      ['Installation', 'Dell R740 Server WinOS installation, RAID & VM creation'],
      ['Configuration', 'Building AD, Creation of roles, user profiles & Groups'],
      ['Configuration', 'Populating the Look-up table with policy data'],
      ['Configuration', 'Defining policies, data transfer & mapping'],
      ['Configuration', 'One day success Live testing & releasing back up server'],
      ['Configuration', 'Connections of workstations to domain'],
      FINAL,
    ],
    existing: [
      ['Installation', 'Back up Server Installation & VM & AD set up configuration'],
      ['Configuration', 'Populating the Look-up table with policy data'],
      ['Configuration', 'Windows Server Backup from both the VM'],
      ['Configuration', 'Defining policies, data transfer & mapping'],
      ['Configuration', 'One day success Live testing & releasing back up server'],
      ['Configuration', 'Connections of workstations to domain'],
      FINAL,
    ],
  },
  eps: {
    new: [
      ['Installation', 'End points sanitization - client installation & root level scan'],
      ['Configuration', 'EPS With XDR Setup, configuration and policy setup'],
      FINAL,
    ],
    existing: [
      ['Installation', 'End points sanitization - client installation & root level scan'],
      ['Configuration', 'EPS With XDR Setup, configuration and policy setup'],
      ['Configuration', 'Review exclusions & detection policies', true],
      FINAL,
    ],
  },
  odr: {
    new: [
      ['Installation', 'Acronis Account VM Setup & configuration'],
      ['Configuration', 'Total data & Server sync for Go Live'],
      ['Configuration', 'One day verification confirmation'],
      FINAL,
    ],
    existing: [
      ['Installation', 'Acronis Account VM Setup & configuration'],
      ['Configuration', 'Total data & Server sync for Go Live'],
      ['Configuration', 'One day verification confirmation'],
      ['Configuration', 'Recovery drill & RTO/RPO evidence', true],
      FINAL,
    ],
  },
};

/* Network components + products. src: 'plan' = steps from project file, 'mixed' = plan + demo, 'demo' = all demo */
const ITEMS = [
  // Network components
  { id: 'firewall', grp: 'infra', name: 'Firewall', cat: 'Network', icon: 'Wall', q: 'firewall', src: 'mixed', desc: 'Perimeter security, web filtering and bandwidth policy per user.' },
  { id: 'server', grp: 'infra', name: 'Server', cat: 'Identity & Access', icon: 'HardDrives', q: 'server', src: 'plan', desc: 'Dell R740 – Windows Server, VMs and Active Directory.' },
  { id: 'switch', grp: 'infra', name: 'Switch', cat: 'Network', icon: 'TreeStructure', src: 'plan', desc: 'Cisco Catalyst C1300-24T-4G managed switching.' },
  { id: 'router', grp: 'infra', name: 'Router', cat: 'Network', icon: 'Network', src: 'demo', desc: 'WAN edge routing and failover links.' },
  { id: 'nas', grp: 'infra', name: 'NAS', cat: 'Resilience', icon: 'Database', src: 'plan', desc: 'QNAP auto data backup storage.' },
  { id: 'san', grp: 'infra', name: 'SAN', cat: 'Resilience', icon: 'Stack', src: 'demo', desc: 'Block storage fabric for virtual workloads.' },
  { id: 'ap', grp: 'infra', name: 'Access Point', cat: 'Network', icon: 'WifiHigh', src: 'demo', desc: 'Wi-Fi coverage, SSIDs and guest isolation.' },
  // Products without their own network-component page
  { id: 'cdr', grp: 'prod', name: 'Sanitisation (CDR)', cat: 'Data', icon: 'FileMagnifyingGlass', src: 'demo', desc: 'Content Disarm & Reconstruction for inbound files.' },
  { id: 'eps', grp: 'prod', name: 'EPS with XDR', cat: 'Endpoint', icon: 'ShieldCheck', src: 'plan', desc: 'SentinelOne endpoint protection with XDR.' },
  { id: 'atp', grp: 'prod', name: 'ATP', cat: 'Endpoint', icon: 'Broadcast', src: 'demo', desc: 'Advanced threat protection and sandboxing.' },
  { id: 'spe', grp: 'prod', name: 'Security Posture Enhancement', cat: 'Endpoint', icon: 'ChartLineUp', src: 'demo', desc: 'Continuous posture scoring and remediation.' },
  { id: 'dlp', grp: 'prod', name: 'DLP', cat: 'Data', icon: 'Eye', src: 'demo', desc: 'Data loss prevention across endpoints and mail.' },
  { id: 'odr', grp: 'prod', name: 'Phoenix ODR', cat: 'Resilience', icon: 'CloudArrowUp', src: 'plan', desc: 'Acronis on-demand disaster recovery.' },
  { id: 'ztna', grp: 'prod', name: 'ZTNA', cat: 'Identity & Access', icon: 'Globe', src: 'demo', desc: 'Zero-trust application access.' },
  { id: 'ipam', grp: 'prod', name: 'IPAM (PAM)', cat: 'Identity & Access', icon: 'Key', src: 'demo', desc: 'IP address management and privileged access.' },
  { id: 'mdm', grp: 'prod', name: 'MDM / BYOD', cat: 'Endpoint', icon: 'DeviceMobile', src: 'demo', desc: 'Mobile device management and BYOD policy.' },
  { id: 'enc', grp: 'prod', name: 'Encryption', cat: 'Data', icon: 'Lock', src: 'demo', desc: 'Disk and removable-media encryption.' },
  { id: 'inv', grp: 'prod', name: 'Inventory Management', cat: 'Endpoint', icon: 'Package', src: 'demo', desc: 'Hardware and software asset inventory.' },
  { id: 'pwr', grp: 'prod', name: 'Power Savings Management', cat: 'Endpoint', icon: 'Power', src: 'demo', desc: 'Endpoint power policy and energy reporting.' },
];
ITEMS.forEach(it => { it.tasks = PLAN[it.id] || demoTasks(it.name); });

/* The product list as supplied; some entries open an existing component page in a given mode */
const PRODUCT_LIST = [
  { name: 'Sanitisation (CDR)', id: 'cdr' },
  { name: 'EPS with XDR', id: 'eps' },
  { name: 'ATP', id: 'atp' },
  { name: 'Security Posture Enhancement', id: 'spe' },
  { name: 'DLP', id: 'dlp' },
  { name: 'Firewall (New)', id: 'firewall', mode: 'new' },
  { name: 'Existing Firewall', id: 'firewall', mode: 'existing' },
  { name: 'QNAP Backup', id: 'nas' },
  { name: 'Server – AD', id: 'server' },
  { name: 'Phoenix ODR', id: 'odr' },
  { name: 'Managed Switches', id: 'switch' },
  { name: 'ZTNA', id: 'ztna' },
  { name: 'IPAM (PAM)', id: 'ipam' },
  { name: 'MDM / BYOD', id: 'mdm' },
  { name: 'Encryption', id: 'enc' },
  { name: 'Inventory Management', id: 'inv' },
  { name: 'Power Savings Management', id: 'pwr' },
];

/* Questionnaires built from the look-up tables */
const QUESTIONNAIRES = {
  firewall: {
    title: 'Firewall Policy Questionnaire',
    sub: 'One response per user – feeds the firewall look-up table.',
    cols: [
      { k: 'user', l: 'User Name', t: 'text', q: 'What is the user\'s name?' },
      { k: 'dept', l: 'Department', t: 'text', q: 'Which department does the user belong to?' },
      { k: 'ip', l: 'IP Address', t: 'text', q: 'What IP address is assigned to the user?', ph: '192.168.1.10' },
      { k: 'internet', l: 'Allow Internet', t: 'yn', q: 'Should the user have Internet access?' },
      { k: 'bw', l: 'Bandwidth', t: 'hml', q: 'What bandwidth allocation applies (High / Med / Low)?' },
      { k: 'official', l: 'Official Emails', t: 'yn', q: 'Allow official emails?' },
      { k: 'personal', l: 'Personal Emails', t: 'yn', q: 'Allow personal emails?' },
      { k: 'skype', l: 'Skype', t: 'yn', q: 'Allow Skype?' },
      { k: 'youtube', l: 'YouTube', t: 'yn', q: 'Allow YouTube?' },
      { k: 'social', l: 'Social Sites', t: 'yn', q: 'Allow social sites?' },
      { k: 'fin', l: 'Fin & Bank', t: 'yn', q: 'Allow financial & banking sites?' },
      { k: 'govt', l: 'Govt Sites', t: 'yn', q: 'Allow government sites?' },
      { k: 'sports', l: 'Sports', t: 'yn', q: 'Allow sports sites?' },
      { k: 'swdl', l: 'S/W Downloads', t: 'yn', q: 'Allow software downloads?' },
      { k: 'vpn', l: 'SSL VPN', t: 'yn', q: 'Allow SSL VPN?' },
    ],
    demo: [],
  },
  server: {
    title: 'Server Domain Questionnaire',
    sub: 'One response per user – feeds the Active Directory look-up table.',
    cols: [
      { k: 'user', l: 'User Name', t: 'text', q: 'What is the user\'s name?' },
      { k: 'dept', l: 'Department', t: 'text', q: 'Which department does the user belong to?' },
      { k: 'office', l: 'Office Application', t: 'yn', q: 'Allow office applications?' },
      { k: 'other', l: 'Other Application', t: 'yn', q: 'Allow other applications?' },
      { k: 'usb', l: 'USB Block?', t: 'yn', q: 'Should USB ports be blocked?' },
      { k: 'folders', l: 'Dept Folder Access', t: 'text', q: 'Which folders in the department can the user access?', ph: 'Accounts, Invoices' },
      { k: 'edit', l: 'Allow Edit', t: 'yn', q: 'Allow edit?' },
      { k: 'ro', l: 'Read Only', t: 'yn', q: 'Read-only access?' },
      { k: 'drive', l: 'Map Drive', t: 'text', q: 'Which drive letter / share should be mapped?', ph: 'S: \\\\SRV\\Finance' },
      { k: 'printer', l: 'Map Printer', t: 'text', q: 'Which printer should be mapped?', ph: 'HP-Finance-01' },
    ],
    demo: [],
  },
};
export { ITEMS, PRODUCT_LIST, QUESTIONNAIRES };
