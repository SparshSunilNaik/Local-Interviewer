from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.entities import (
    AppSetting,
    Evaluation,
    InterviewSession,
    InterviewTurn,
    ProviderProfile,
)

router = APIRouter(prefix="/settings", tags=["settings"])
Database = Annotated[AsyncSession, Depends(get_db)]


class SettingsPayload(BaseModel):
    audio: dict = Field(default_factory=dict)
    privacy: dict = Field(default_factory=dict)
    onboarding_complete: bool = False
    developer: dict = Field(default_factory=dict)


@router.get("", response_model=SettingsPayload)
async def get_settings(db: Database):
    setting = (await db.scalars(select(AppSetting).where(AppSetting.key == "user"))).first()
    return SettingsPayload(**setting.value) if setting else SettingsPayload()


@router.put("", response_model=SettingsPayload)
async def save_settings(payload: SettingsPayload, db: Database):
    setting = (await db.scalars(select(AppSetting).where(AppSetting.key == "user"))).first()
    if setting:
        setting.value = payload.model_dump()
    else:
        db.add(AppSetting(key="user", value=payload.model_dump()))
    await db.commit()
    return payload


class DeleteAllRequest(BaseModel):
    confirmation: str


@router.delete("/data")
async def delete_all_data(payload: DeleteAllRequest, db: Database):
    if payload.confirmation != "DELETE ALL LOCAL DATA":
        raise HTTPException(status_code=400, detail="Confirmation phrase does not match")
    for entity in (Evaluation, InterviewTurn, InterviewSession, ProviderProfile, AppSetting):
        await db.execute(delete(entity))
    await db.commit()
    return {"deleted": True}
