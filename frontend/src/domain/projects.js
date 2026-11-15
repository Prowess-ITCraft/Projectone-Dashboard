/* How the work came about; it changes what the project contains, not the order of its stages (context pack 02) */
export const ENTRY_PATHS = { post_audit: 'Post-audit', new_infra: 'New infrastructure', restructuring: 'Restructuring' };

export const entryPathLabel = (path) => ENTRY_PATHS[path] ?? 'Not set';
