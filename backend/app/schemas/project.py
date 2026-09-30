import html
from datetime import date
from typing import Optional
from pydantic import BaseModel, Field, field_validator

class ProjectCreate(BaseModel):
    customer_id: int
    project_name: str = Field(..., min_length=2, max_length=255)
    assigned_partner_id: int
    committed_date: date
    total_amount: float = Field(default=0.00, ge=0)
    advance_paid: float = Field(default=0.00, ge=0)
    asset_link: Optional[str] = None

    @field_validator("project_name", "asset_link")
    @classmethod
    def sanitize_strings(cls, v: Optional[str]) -> Optional[str]:
        if v:
            return html.escape(v.strip())
        return v

class ProjectStatusUpdate(BaseModel):
    status: str
    update_text: str = Field(..., min_length=1)

    @field_validator("update_text")
    @classmethod
    def sanitize_text(cls, v: str) -> str:
        return html.escape(v.strip())