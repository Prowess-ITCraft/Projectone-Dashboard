/*
  Roles and what each may do. Permissions are data (role to actions), so adding a role later is a new row here and
  no change to any component. Every check in the app goes through can(). Admin and Engineer are the only roles for
  now; the matrix below keeps the earlier behaviour (what the intake coordinator did is now Engineer, what the project
  lead did is now Admin) and is listed as open until the owner confirms it.
*/
export const ROLES = {
  admin: 'Admin',
  engineer: 'Engineer',
};

const ENGINEER = ['create_project', 'upload', 'edit_lines', 'classify', 'confirm_classification'];
const ADMIN = [...ENGINEER, 'confirm_intake', 'reopen', 'set_delivery', 'resolve_duplicate', 'reset_data', 'set_project_status'];

export const PERMISSIONS = { admin: ADMIN, engineer: ENGINEER };

export const can = (actor, action) => Boolean(actor && PERMISSIONS[actor.role]?.includes(action));

export const actorLabel = (actor) => (actor?.name ? `${actor.name}, ${ROLES[actor.role]}` : (ROLES[actor?.role] ?? 'Unknown'));
