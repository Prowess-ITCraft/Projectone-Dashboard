/* ProjectOne – static data: implementation services, task templates, questionnaires. */

/* Steps for each implementation service. AD/DC is empty for now; its steps come later. */
const PLAN = {
  'ad-dc': { new: [], existing: [] },
  dlp: { new: [], existing: [] },
};

/* The implementation services. More are added here as the owner confirms them. src: 'plan' = steps from the project file */
const ITEMS = [
  {
    id: 'ad-dc',
    grp: 'service',
    name: 'AD/DC',
    cat: 'Identity & Access',
    icon: 'HardDrives',
    q: 'server',
    src: 'plan',
    desc: 'Active Directory and domain controller: server, users, groups, policies and workstation join.',
  },
  {
    id: 'dlp',
    grp: 'service',
    name: 'DLP',
    cat: 'Data',
    icon: 'Eye',
    src: 'plan',
    desc: 'Data loss prevention across endpoints and mail.',
  },
];
ITEMS.forEach((it) => {
  it.tasks = PLAN[it.id];
});

/* The product list is no longer used; products are modules inside a project */
const PRODUCT_LIST = [];

/* Questionnaires built from the look-up tables */
const QUESTIONNAIRES = {
  firewall: {
    title: 'Firewall Policy Questionnaire',
    sub: 'One response per user – feeds the firewall look-up table.',
    cols: [
      { k: 'user', l: 'User Name', t: 'text', q: "What is the user's name?" },
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
      { k: 'user', l: 'User Name', t: 'text', q: "What is the user's name?" },
      { k: 'dept', l: 'Department', t: 'text', q: 'Which department does the user belong to?' },
      { k: 'office', l: 'Office Application', t: 'yn', q: 'Allow office applications?' },
      { k: 'other', l: 'Other Application', t: 'yn', q: 'Allow other applications?' },
      { k: 'usb', l: 'USB Block?', t: 'yn', q: 'Should USB ports be blocked?' },
      {
        k: 'folders',
        l: 'Dept Folder Access',
        t: 'text',
        q: 'Which folders in the department can the user access?',
        ph: 'Accounts, Invoices',
      },
      { k: 'edit', l: 'Allow Edit', t: 'yn', q: 'Allow edit?' },
      { k: 'ro', l: 'Read Only', t: 'yn', q: 'Read-only access?' },
      { k: 'drive', l: 'Map Drive', t: 'text', q: 'Which drive letter / share should be mapped?', ph: 'S: \\\\SRV\\Finance' },
      { k: 'printer', l: 'Map Printer', t: 'text', q: 'Which printer should be mapped?', ph: 'HP-Finance-01' },
    ],
    demo: [],
  },
};
export const catalog = { items: ITEMS, productList: PRODUCT_LIST, questionnaires: QUESTIONNAIRES };
