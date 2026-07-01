"""
MOST — Orchestrator
Точка входа платформы: регистрация/логин, приём платежей, развёртывание
swarm-роя и статус прогресса. Порт: 8000.
"""
import asyncio
import random
from typing import List, Optional

import httpx
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from libs.auth import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from libs.blockchain_sim import BlockchainSimulator, Network
from libs.database import get_db
from libs.models import (
    AccountStatus,
    AgentStatus,
    PaymentOrder,
    RouteStatus,
    SwarmAgent,
    SwarmRoute,
    User,
    UserRole,
)

app = FastAPI(title="MOST Orchestrator", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

blockchain_sim = BlockchainSimulator()

RISK_ENGINE_URL = "http://risk-engine:8002"
RISK_ENGINE_TIMEOUT = 5.0


async def _aml_check(address: str, network: str) -> dict:
    """
    Вызывает Risk Engine для AML-проверки адреса получателя.
    Возвращает dict с полями: risk_score, is_sanctioned, is_mixer, recommendation.
    При недоступности сервиса — пропускает с recommendation=MANUAL_REVIEW.
    """
    try:
        async with httpx.AsyncClient(timeout=RISK_ENGINE_TIMEOUT) as client:
            resp = await client.post(
                f"{RISK_ENGINE_URL}/api/v1/risk/check",
                json={"address": address, "network": network},
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Risk Engine вернул ошибку: {exc.response.status_code}",
        )
    except httpx.RequestError:
        return {
            "risk_score": 0,
            "is_sanctioned": False,
            "is_mixer": False,
            "recommendation": "MANUAL_REVIEW",
        }


# ===========================================================================
# Схемы запросов/ответов
# ===========================================================================
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    company_name: str = Field(..., min_length=2, max_length=255)
    inn: str = Field(..., min_length=8, max_length=15)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    id: str
    email: str
    company_name: Optional[str] = None
    role: str
    status: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class PaymentCreate(BaseModel):
    from_currency: str = Field(..., max_length=16)
    to_currency: str = Field(..., max_length=16)
    amount: float = Field(..., gt=0)
    destination_country: str = Field(..., max_length=2)
    destination_address: str = Field(..., min_length=4, max_length=128)


class PaymentStatus(BaseModel):
    order_id: str
    status: str
    total_agents: int
    completed_agents: int
    progress_percent: float
    aml_risk_score: Optional[int] = None
    aml_recommendation: Optional[str] = None


# ===========================================================================
# Swarm Orchestrator
# ===========================================================================
class SwarmOrchestrator:
    ROUTING_METHODS = [
        "standard_split",
        "multi_hop",
        "sequential",
        "parallel_broadcast",
        "mesh_network",
        "adaptive_routing",
        "priority_queue",
    ]

    NETWORKS = [
        "ethereum", "bsc", "polygon", "tron", "solana",
        "stellar", "ton", "arbitrum", "optimism", "avalanche",
    ]

    def analyze_request(self, request: PaymentCreate) -> dict:
        amount = request.amount
        if amount < 10000:
            swarm_size = random.randint(10, 50)
        elif amount < 100000:
            swarm_size = random.randint(50, 200)
        elif amount < 1000000:
            swarm_size = random.randint(200, 1000)
        else:
            swarm_size = random.randint(1000, 5000)

        method = random.choice(self.ROUTING_METHODS)
        networks = random.sample(self.NETWORKS, min(5, len(self.NETWORKS)))
        estimated_time = round(swarm_size * 0.05, 2)

        return {
            "swarm_size": swarm_size,
            "method": method,
            "networks": networks,
            "estimated_time_sec": estimated_time,
        }

    async def deploy_swarm(self, order: PaymentOrder, analysis: dict, db: AsyncSession) -> SwarmRoute:
        route = SwarmRoute(
            order_id=order.id,
            total_parts=analysis["swarm_size"],
            strategy={"name": analysis["method"], "networks": analysis["networks"]},
        )
        db.add(route)
        await db.flush()

        amount_per_agent = order.amount / analysis["swarm_size"]
        agents: List[SwarmAgent] = []
        for i in range(analysis["swarm_size"]):
            network = random.choice(analysis["networks"])
            agent = SwarmAgent(
                route_id=route.id,
                agent_name=f"Agent_{i}_{random.randint(1000, 9999)}",
                network=network,
                from_address=blockchain_sim.generate_address(network),
                to_address=blockchain_sim.generate_address(network),
                amount=amount_per_agent,
            )
            agents.append(agent)
        db.add_all(agents)
        await db.flush()

        asyncio.create_task(self._run_swarm(route.id, agents))
        return route

    async def _run_swarm(self, route_id, agents: List[SwarmAgent]):
        semaphore = asyncio.Semaphore(100)

        async def run_with_limit(agent: SwarmAgent):
            async with semaphore:
                return await self._run_agent(agent)

        tasks = [run_with_limit(a) for a in agents]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        completed = sum(1 for r in results if r is True)
        print(f"Swarm {route_id} done: {completed}/{len(agents)}")

    async def _run_agent(self, agent: SwarmAgent) -> bool:
        for attempt in range(3):
            try:
                agent.status = "active"
                network = Network(agent.network)
                tx_hash, success = await blockchain_sim.send_transaction(
                    network, agent.from_address, agent.to_address, float(agent.amount)
                )
                agent.tx_hash = tx_hash
                agent.status = "completed" if success else "dead"
                return success
            except Exception:
                if attempt < 2:
                    await asyncio.sleep(2 ** attempt)
                else:
                    agent.status = "dead"
                    return False
        return False


orchestrator = SwarmOrchestrator()


# ===========================================================================
# Auth endpoints
# ===========================================================================
@app.post("/api/v1/auth/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.scalar(select(User).where(User.email == req.email))
    if existing:
        raise HTTPException(status_code=409, detail="Email уже зарегистрирован")

    user = User(
        email=req.email,
        password_hash=hash_password(req.password),
        company_name=req.company_name,
        inn=req.inn,
        role=UserRole.USER,
        status=AccountStatus.ACTIVE,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token({"sub": str(user.id), "role": user.role.value})
    return AuthResponse(
        access_token=token,
        user=UserPublic(
            id=str(user.id),
            email=user.email,
            company_name=user.company_name,
            role=user.role.value,
            status=user.status.value,
        ),
    )


@app.post("/api/v1/auth/login", response_model=AuthResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await db.scalar(select(User).where(User.email == req.email))
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Неверный email или пароль")

    token = create_access_token({"sub": str(user.id), "role": user.role.value})
    return AuthResponse(
        access_token=token,
        user=UserPublic(
            id=str(user.id),
            email=user.email,
            company_name=user.company_name,
            role=user.role.value,
            status=user.status.value,
        ),
    )


# ===========================================================================
# Payment endpoints
# ===========================================================================
@app.post("/api/v1/payments/new", response_model=PaymentStatus, status_code=status.HTTP_201_CREATED)
async def new_payment(
    req: PaymentCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # --- AML-проверка адреса получателя ------------------------------------
    aml = await _aml_check(req.destination_address, req.from_currency)

    if aml["recommendation"] == "REJECT":
        raise HTTPException(
            status_code=403,
            detail={
                "error": "AML_REJECTED",
                "message": "Платёж отклонён системой AML-комплаенса",
                "risk_score": aml["risk_score"],
                "is_sanctioned": aml["is_sanctioned"],
                "is_mixer": aml["is_mixer"],
            },
        )

    # --- Создаём заказ и запускаем рой -------------------------------------
    aml_status = "aml_pending" if aml["recommendation"] == "MANUAL_REVIEW" else "processing"

    order = PaymentOrder(
        user_id=user.id,
        from_currency=req.from_currency,
        to_currency=req.to_currency,
        amount=req.amount,
        destination_country=req.destination_country,
        destination_address=req.destination_address,
        status=aml_status,
        risk_score=aml["risk_score"],
    )
    db.add(order)
    await db.flush()

    # При MANUAL_REVIEW рой не запускается — ждёт ручного одобрения
    if aml["recommendation"] == "MANUAL_REVIEW":
        await db.commit()
        return PaymentStatus(
            order_id=str(order.id),
            status=aml_status,
            total_agents=0,
            completed_agents=0,
            progress_percent=0.0,
            aml_risk_score=aml["risk_score"],
            aml_recommendation=aml["recommendation"],
        )

    analysis = orchestrator.analyze_request(req)
    route = await orchestrator.deploy_swarm(order, analysis, db)
    await db.commit()

    return PaymentStatus(
        order_id=str(order.id),
        status=order.status,
        total_agents=route.total_parts,
        completed_agents=0,
        progress_percent=0.0,
        aml_risk_score=aml["risk_score"],
        aml_recommendation=aml["recommendation"],
    )


@app.get("/api/v1/payments/{order_id}", response_model=PaymentStatus)
async def get_payment(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    order = await db.scalar(select(PaymentOrder).where(PaymentOrder.id == order_id))
    if not order:
        raise HTTPException(status_code=404, detail="Платёж не найден")

    route = await db.scalar(select(SwarmRoute).where(SwarmRoute.order_id == order.id))
    total = route.total_parts if route else 0
    completed = 0
    if route:
        completed = await db.scalar(
            select(func.count()).select_from(SwarmAgent).where(
                SwarmAgent.route_id == route.id,
                SwarmAgent.status == "completed",
            )
        ) or 0

    progress = round((completed / total) * 100, 2) if total else 0.0

    return PaymentStatus(
        order_id=str(order.id),
        status=order.status,
        total_agents=total,
        completed_agents=completed,
        progress_percent=progress,
    )


@app.get("/health")
async def health():
    return {"status": "ok", "service": "orchestrator"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)