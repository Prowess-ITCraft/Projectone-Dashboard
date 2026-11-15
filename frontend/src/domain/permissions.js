/*
  Temporary roles until the role model is decided. Every permission check in the app goes through can(), so the
  agreed matrix replaces this one function later. It starts permissive: only money, confirmations and reopening
  are limited to the project lead.
*/
export const ROLES = {
  intake_coordinator: 'Intake coordinator',
  project_lead: 'Project lead',
};

const ALLOWED = {
  create_project: ['intake_coordinator', 'project_lead'],
  upload: ['intake_coordinator', 'project_lead'],
  edit_lines: ['intake_coordinator', 'project_lead'],
  classify: ['intake_coordinator', 'project_lead'],
  confirm_classification: ['intake_coordinator', 'project_lead'],
  view_financials: ['project_lead'],
  confirm_intake: ['project_lead'],
  reopen: ['project_lead'],
  set_delivery: ['project_lead'],
};

export const can = (actor, action) => Boolean(actor && ALLOWED[action]?.includes(actor.role));

export const actorLabel = (actor) => (actor?.name ? `${actor.name}, ${ROLES[actor.role]}` : (ROLES[actor?.role] ?? 'Unknown'));
