/*
  Roles and what each may do. Permissions are data (role to actions), so adding a role later is a new row here and
  no change to any component. Every check in the app goes through can(). It mirrors backend/app/domain/role_matrix.py,
  which the server enforces; this copy only decides what the screens offer.

  Owner decision, 17 Nov 2026: an engineer works only on assigned projects. Owner decision, 20 Nov 2026: an engineer
  changes checklist progress and nothing else (complete a step, upload evidence, comment); order lines are read only.
*/
export const ROLES = {
  admin: 'Admin',
  engineer: 'Engineer',
};

const ENGINEER = ['complete_step', 'upload_evidence', 'comment_step'];
const ADMIN = [
  'upload',
  'edit_lines',
  'classify',
  'manage_checklist',
  'create_project',
  'confirm_classification',
  'confirm_intake',
  'reopen',
  'set_delivery',
  'resolve_duplicate',
  'reset_data',
  'manage_users',
  'set_project_status',
  'assign_engineers',
  'view_all_projects',
];

export const PERMISSIONS = { admin: ADMIN, engineer: ENGINEER };

export const can = (actor, action) => Boolean(actor && PERMISSIONS[actor.role]?.includes(action));

export const actorLabel = (actor) => (actor?.name ? `${actor.name}, ${ROLES[actor.role]}` : (ROLES[actor?.role] ?? 'Unknown'));
