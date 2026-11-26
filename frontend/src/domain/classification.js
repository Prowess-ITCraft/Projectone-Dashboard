import { DEFAULT_BRANDS, DEFAULT_MODULE_RULES } from './modules';

/*
  Product, service or subscription? Rules run in order and the first hit wins (context pack 06, section 3):
  service words first, then hardware models, then subscription words. No hit means "unknown", which blocks the
  classify stage until a person decides. Hardware comes before subscription so "XGS-88 with 3 years protection" stays a product.
*/
export const DEFAULT_KIND_RULES = [
  {
    id: 'service-words',
    kind: 'service',
    patterns: [
      'setup',
      'installation',
      'configuration',
      'implementation',
      'sanitization',
      'sanitisation',
      'support charges',
      'migration',
      'porting',
      'management',
      'one time',
    ],
  },
  {
    id: 'hardware-models',
    kind: 'product',
    patterns: [
      'qnap',
      'synology',
      'sophos xgs',
      'fortigate',
      'sonicwall',
      'thinksystem',
      'poweredge',
      'asus rt-',
      '\\brouter\\b',
      '\\bswitch\\b',
      '\\bnas\\b',
    ],
  },
  {
    id: 'subscription-words',
    kind: 'subscription',
    patterns: [
      'licen[cs]e',
      'per instance',
      'per year',
      '\\bplan\\b',
      'yearly charges',
      'hosted',
      '\\d+\\s*years?\\s*(xtreme\\s*)?protection',
      '\\d+\\s*users?\\b.*\\d+\\s*years?',
    ],
  },
];

export const DEFAULT_RULES = { kind: DEFAULT_KIND_RULES, module: DEFAULT_MODULE_RULES, brands: DEFAULT_BRANDS };

/*
  Rules are seeded into storage once, so a copy stored before a default rule was added never sees it. This adds the
  XDR rule to such a copy, just above the first rule that would otherwise win on 'acronis', and changes nothing else,
  so rules an Admin edited are kept. Returns the same object when there is nothing to add.
*/
const XDR_RULE = DEFAULT_MODULE_RULES.find((r) => r.moduleType === 'eps' && r.patterns.includes('\\bxdr\\b'));
export function upgradeStoredRules(stored) {
  const module = stored?.module;
  if (!Array.isArray(module)) return stored;
  if (module.some((r) => r.patterns?.includes('\\bxdr\\b'))) return stored;
  const at = module.findIndex((r) => r.moduleType === 'backup_software');
  const next = [...module];
  next.splice(at === -1 ? 0 : at, 0, XDR_RULE);
  return { ...stored, module: next };
}

const hits = (patterns, text) => patterns.some((p) => new RegExp(p, 'i').test(text));

/* Kind and module type for one line title. `rule` names the rule that decided, for the audit trail. */
export function classifyTitle(title, rules = DEFAULT_RULES) {
  const text = String(title ?? '');
  const kindRule = rules.kind.find((r) => hits(r.patterns, text));
  const moduleRule = rules.module.find((r) => hits(r.patterns, text));
  return {
    kind: kindRule ? kindRule.kind : 'unknown',
    moduleType: moduleRule ? moduleRule.moduleType : null,
    rule: kindRule ? kindRule.id : null,
  };
}

const norm = (text) =>
  String(text)
    .toLowerCase()
    .replace(/one drive/g, 'onedrive');

export const brandsIn = (title, brands = DEFAULT_BRANDS) => {
  const text = norm(title);
  return brands.map(norm).filter((b) => text.includes(b));
};

const isProduct = (line) => line.kind === 'product' || line.kind === 'subscription';

/*
  Classify every line of a document, then pair each service to the product or subscription it belongs to.
  A service pairs to the nearest earlier line of the same module type; a service that names no module type pairs
  by brand to the nearest earlier product. A service that still cannot be placed is left alone with a suggestion
  (the adjacent product), because a person decides whatever the rules cannot (context pack 06, section 4).
  Lines are plain objects { id, title, ... }. Returns new objects with kind, moduleType, pairedToLineId, suggestion and matchedRule.
*/
export function classifyLines(lines, rules = DEFAULT_RULES) {
  const result = lines.map((line) => {
    const c = classifyTitle(line.title, rules);
    return {
      ...line,
      kind: c.kind,
      moduleType: c.moduleType,
      matchedRule: c.rule,
      pairedToLineId: null,
      suggestion: null,
      classificationSource: 'rule',
    };
  });

  result.forEach((line, index) => {
    if (line.kind !== 'service') return;
    const earlier = result.slice(0, index).filter(isProduct).reverse();
    let match = null;
    if (line.moduleType) {
      match = earlier.find((p) => p.moduleType === line.moduleType) ?? null;
    } else {
      const own = brandsIn(line.title, rules.brands);
      match = earlier.find((p) => own.some((b) => brandsIn(p.title, rules.brands).includes(b))) ?? null;
      if (match) line.moduleType = match.moduleType;
    }
    if (match) line.pairedToLineId = match.id;
    else if (!line.moduleType && earlier.length) line.suggestion = { moduleType: earlier[0].moduleType, pairedToLineId: earlier[0].id };
  });
  return result;
}
