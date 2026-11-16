"""The Admin and Engineer permission matrix, as data.

It mirrors frontend/src/domain/permissions.js and is a placeholder until the owner confirms it (open question).
It seeds the role_actions table; after that the database rows are the truth and `can()` reads only them.
There is deliberately no financial action: Project One holds no financial data.
"""

ROLES: dict[str, str] = {"admin": "Admin", "engineer": "Engineer"}

ENGINEER_ACTIONS: tuple[str, ...] = (
    "create_project",
    "upload",
    "edit_lines",
    "classify",
    "confirm_classification",
)
ADMIN_ACTIONS: tuple[str, ...] = (
    *ENGINEER_ACTIONS,
    "confirm_intake",
    "reopen",
    "set_delivery",
    "resolve_duplicate",
    "reset_data",
    "manage_users",
)

ROLE_ACTIONS: dict[str, tuple[str, ...]] = {"admin": ADMIN_ACTIONS, "engineer": ENGINEER_ACTIONS}
