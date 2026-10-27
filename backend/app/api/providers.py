from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.entities import ProviderProfile
from app.schemas.provider import ProviderCreate, ProviderRead, ProviderTestResult
from app.services.llm.ollama import OllamaClient, OllamaError

router = APIRouter(prefix="/providers", tags=["providers"])
Database = Annotated[AsyncSession, Depends(get_db)]


async def get_profile(profile_id: str, db: AsyncSession) -> ProviderProfile:
    profile = await db.get(ProviderProfile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    return profile


@router.get("", response_model=list[ProviderRead])
async def list_profiles(db: Database):
    return (await db.scalars(select(ProviderProfile).order_by(ProviderProfile.created_at))).all()


@router.post("", response_model=ProviderRead, status_code=status.HTTP_201_CREATED)
async def create_profile(payload: ProviderCreate, db: Database):
    if payload.is_default:
        await db.execute(update(ProviderProfile).values(is_default=False))
    profile = ProviderProfile(**payload.model_dump())
    db.add(profile)
    await db.commit()
    await db.refresh(profile)
    return profile


@router.put("/{profile_id}", response_model=ProviderRead)
async def update_profile(
    profile_id: str, payload: ProviderCreate, db: Database
):
    profile = await get_profile(profile_id, db)
    if payload.is_default:
        await db.execute(update(ProviderProfile).values(is_default=False))
    for key, value in payload.model_dump().items():
        setattr(profile, key, value)
    await db.commit()
    await db.refresh(profile)
    return profile


@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_profile(profile_id: str, db: Database):
    profile = await get_profile(profile_id, db)
    await db.delete(profile)
    await db.commit()


@router.post("/{profile_id}/test", response_model=ProviderTestResult)
async def test_profile(profile_id: str, db: Database):
    return await OllamaClient(await get_profile(profile_id, db)).test()


@router.get("/{profile_id}/models")
async def discover_models(profile_id: str, db: Database):
    try:
        return {"models": await OllamaClient(await get_profile(profile_id, db)).models()}
    except OllamaError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/{profile_id}/models/{model_name:path}")
async def model_info(profile_id: str, model_name: str, db: Database):
    try:
        return await OllamaClient(await get_profile(profile_id, db)).show(model_name)
    except OllamaError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
