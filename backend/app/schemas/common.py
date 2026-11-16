from pydantic import BaseModel


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
    username: str
    display_name: str
    role: str
    actions: list[str]


class SeedOut(BaseModel):
    users: list[str]
