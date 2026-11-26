import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field


class HealthOut(BaseModel):
    status: str


class VersionOut(BaseModel):
    version: str
    environment: str


class RoleOut(BaseModel):
    key: str
    label: str
    actions: list[str]


class MeOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    actions: list[str]
    must_change_password: bool


class SeedOut(BaseModel):
    users: list[str]


class LoginIn(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=200)


class ChangePasswordIn(BaseModel):
    current_password: str = Field(max_length=200)
    new_password: str = Field(max_length=200)


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: str
    is_active: bool
    must_change_password: bool
    password_is_default: bool
    created_at: datetime
    last_login_at: datetime | None


class LoginDetailsOut(BaseModel):
    """What an Admin copies to send an engineer who has not yet changed the default password."""

    email: str
    password: str


class NewEngineerIn(BaseModel):
    full_name: str = Field(max_length=120)
    email: str = Field(max_length=254)


class UserWithPasswordOut(BaseModel):
    """The only response that carries a password: the temporary one, shown once to the Admin who asked for it."""

    user: UserOut
    temporary_password: str


class AssignmentOut(BaseModel):
    project_id: uuid.UUID
    engineer_id: uuid.UUID
    full_name: str
    email: str
    assigned_at: datetime


class SetEngineersIn(BaseModel):
    engineer_ids: list[uuid.UUID] = Field(max_length=200)


class NotificationOut(BaseModel):
    id: uuid.UUID
    type: str
    title: str
    message: str
    project_id: uuid.UUID | None
    is_read: bool
    created_at: datetime


class NotificationsOut(BaseModel):
    unread_count: int
    items: list[NotificationOut]


class EvidenceOut(BaseModel):
    id: uuid.UUID
    name: str
    media_type: str
    size: int
    uploaded_by_id: uuid.UUID
    uploaded_by_name: str
    uploaded_at: datetime
    can_remove: bool


class CommentOut(BaseModel):
    id: uuid.UUID
    body: str
    author_id: uuid.UUID
    author_name: str
    created_at: datetime


class ChecklistStepOut(BaseModel):
    id: uuid.UUID
    phase: str
    position: int
    title: str
    state: str
    done: bool
    locked: bool
    locked_reason: str | None
    start_date: date | None
    end_date: date | None
    progress: int
    evidence: list[EvidenceOut]
    comments: list[CommentOut]


class EvidenceLimitsOut(BaseModel):
    max_bytes: int
    max_files: int
    accepted: list[str]
    accepted_text: str


class ChecklistOut(BaseModel):
    limits: EvidenceLimitsOut
    steps: list[ChecklistStepOut]


class StepIn(BaseModel):
    phase: str = Field(pattern="^(installation|configuration)$")
    title: str = Field(min_length=1, max_length=300)
    start_date: date | None = None
    end_date: date | None = None
    progress: int = Field(default=0, ge=0, le=100)


class StepPatch(BaseModel):
    phase: str | None = Field(default=None, pattern="^(installation|configuration)$")
    title: str | None = Field(default=None, min_length=1, max_length=300)
    start_date: date | None = None
    end_date: date | None = None
    progress: int | None = Field(default=None, ge=0, le=100)


class StepOrderIn(BaseModel):
    step_ids: list[uuid.UUID] = Field(max_length=500)


class EvidenceIn(BaseModel):
    name: str = Field(min_length=1, max_length=300)
    content: str = Field(min_length=1)


class CommentIn(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


class WorkLineOut(BaseModel):
    """An order line as an engineer sees it: no money fields, no document, no classification workings."""

    id: str
    number: int | None
    description: str
    quantity: float | int | None
    kind: str | None
    module: str | None
    pairing: str | None


class WorkProjectOut(BaseModel):
    id: uuid.UUID
    number: str
    customer_name: str


class WorkOut(BaseModel):
    project: WorkProjectOut
    lines: list[WorkLineOut]
    limits: EvidenceLimitsOut
    steps: list[ChecklistStepOut]


class MyProjectOut(BaseModel):
    id: uuid.UUID
    number: str
    customer_name: str
    assigned_at: datetime
    step_count: int
    steps_done: int


class SampleStepsIn(BaseModel):
    project_id: uuid.UUID
    count: int = Field(default=4, ge=1, le=20)


class CounterOut(BaseModel):
    value: int
