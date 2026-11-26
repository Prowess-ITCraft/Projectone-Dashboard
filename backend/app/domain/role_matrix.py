"""The Admin and Engineer permission matrix, as data.

It mirrors frontend/src/domain/permissions.js. It seeds the role_actions table; after that the database rows are the
truth and `can()` reads only them. There is deliberately no financial action: Project One holds no financial data.

Owner decision, 20 Nov 2026: an engineer works only on assigned projects and can complete checklist steps,
upload evidence and comment. Order lines and project structure are read only to them.
"""

ROLES: dict[str, str] = {"admin": "Admin", "engineer": "Engineer"}

# The role given to accounts an Admin adds and to the seeded engineers
ENGINEER_ROLE = "engineer"
ADMIN_ROLE = "admin"

# Owner decision, 20 Nov 2026: an engineer changes checklist progress and nothing else. They see the order lines of
# their assigned projects read only, and the checklist, where they may complete a step, upload evidence and comment.
ENGINEER_ACTIONS: tuple[str, ...] = (
    "complete_step",
    "upload_evidence",
    "comment_step",
)
ADMIN_ACTIONS: tuple[str, ...] = (
    "upload",
    "edit_lines",
    "classify",
    "manage_checklist",
    "create_project",
    "confirm_classification",
    "confirm_intake",
    "reopen",
    "set_delivery",
    "resolve_duplicate",
    "reset_data",
    "manage_users",
    "set_project_status",
    "assign_engineers",
    "view_all_projects",
)

ROLE_ACTIONS: dict[str, tuple[str, ...]] = {"admin": ADMIN_ACTIONS, "engineer": ENGINEER_ACTIONS}
