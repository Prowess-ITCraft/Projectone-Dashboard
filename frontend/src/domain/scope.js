const WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5 };
const SETUP = /setup|installation|configuration|implementation/i;

/* A service line that carries support: "One year support charges", "+ 1 Year Support", "3 Years support" */
export const isSupportLine = (line) => line.kind === 'service' && /support/i.test(line.title);

/* Support-only lines (no setup in the title) hold support scope, not checklist tasks */
export const isSupportOnly = (line) =>
  isSupportLine(line) && (line.supportScope === true || (/support charges/i.test(line.title) && !SETUP.test(line.title)));

/* Length in years from the line text, or null when it does not say */
export function supportYears(title) {
  const m = /(\d+|one|two|three|four|five)\s*years?/i.exec(String(title));
  if (!m) return null;
  return WORDS[m[1].toLowerCase()] ?? Number(m[1]);
}

/*
  Splits the service lines of one module. Setup bullets become the module's scope (checklist tasks later);
  support lines become entitlements, which start at customer sign-off (context pack 06, section 5).
*/
export function splitScope(serviceLines) {
  const scopeItems = [];
  const entitlements = [];
  serviceLines.forEach((line) => {
    if (!isSupportOnly(line)) scopeItems.push(...(line.scopeItems ?? []));
    if (isSupportLine(line)) {
      entitlements.push({
        lineId: line.id,
        years: supportYears(line.title),
        scopeItems: isSupportOnly(line) ? [...(line.scopeItems ?? [])] : [],
      });
    }
  });
  return { scopeItems, entitlements };
}
