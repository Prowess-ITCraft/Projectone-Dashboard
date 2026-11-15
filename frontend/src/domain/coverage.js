import { classifyTitle, DEFAULT_RULES } from './classification';

/*
  Compares what a PrismSuite report recommends with what the order contains. Information only: it never changes
  the order and never blocks a stage (context pack 06, section 7). Recommendations that name no product, such as
  "Remove Kaspersky and McAfee", are listed apart as other actions.
*/
export function coverageCheck(recommendations, orderedModuleTypes, rules = DEFAULT_RULES) {
  const ordered = new Set(orderedModuleTypes.filter(Boolean));
  const covered = [];
  const recommendedNotOrdered = [];
  const other = [];
  const recommendedTypes = new Set();

  recommendations.forEach((text) => {
    const { moduleType } = classifyTitle(text, { ...rules, kind: [] });
    if (!moduleType) return other.push(text);
    recommendedTypes.add(moduleType);
    (ordered.has(moduleType) ? covered : recommendedNotOrdered).push({ text, moduleType });
  });

  const orderedNotRecommended = [...ordered].filter((type) => !recommendedTypes.has(type));
  return { covered, recommendedNotOrdered, orderedNotRecommended, other };
}
