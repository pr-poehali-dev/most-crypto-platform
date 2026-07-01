"""
MOST — Swarm Coordinator
Координатор роя: диспетчеризация задач через Redis Streams,
мониторинг прогресса, рекавери зависших задач (XCLAIM).
Порт: 8001
"""
import asyncio
import json
import os
import time
import uuid
from contextlib import asynccontextmanager
from typing import Any

import redis.asyncio as aioredis
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Конфигурация
# ---------------------------------------------------------------------------
REDIS_URL         = os.environ.get("REDIS_URL", "redis://redis:6379/0")
STREAM_KEY        = "most:swarm:tasks"
GROUP_NAME        = "swarm-agents"
CLAIM_IDLE_MS     = 30_000        # 30 сек — задача считается зависшей
CLAIM_INTERVAL_S  = 15            # как часто проверять зависшие задачи
MAX_RETRY_COUNT   = 3


# ---------------------------------------------------------------------------
# Redis-клиент (shared singleton)
# ---------------------------------------------------------------------------
redis_client: aioredis.Redis | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global redis_client
    redis_client = await aioredis.from_url(REDIS_URL, decode_responses=True)

    # Создаём consumer group (игнорируем ошибку если уже существует)
    try:
        await redis_client.xgroup_create(STREAM_KEY, GROUP_NAME, id="0", mkstream=True)
    except aioredis.ResponseError as e:
        if "BUSYGROUP" not in str(e):
            raise

    # Фоновая задача — рекавери зависших задач
    asyncio.create_task(_claim_idle_loop())

    yield

    await redis_client.aclose()


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(title="MOST Swarm Coordinator", version="0.3.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Схемы
# ---------------------------------------------------------------------------
class AgentTask(BaseModel):
    agent_id: str
    agent_name: str
    network: str
    from_address: str
    to_address: str
    amount: float


class DispatchRequest(BaseModel):
    route_id: str = Field(..., description="UUID SwarmRoute")
    agents: list[AgentTask] = Field(..., min_length=1)


class DispatchResponse(BaseModel):
    swarm_id: str
    route_id: str
    dispatched: int
    stream: str


class SwarmStatus(BaseModel):
    swarm_id: str
    route_id: str
    total: int
    pending: int
    completed: int
    failed: int
    progress_percent: float


# ---------------------------------------------------------------------------
# Хелперы
# ---------------------------------------------------------------------------
def _swarm_meta_key(swarm_id: str) -> str:
    return f"most:swarm:meta:{swarm_id}"


def _task_result_key(swarm_id: str) -> str:
    return f"most:swarm:results:{swarm_id}"


async def _publish_task(r: aioredis.Redis, swarm_id: str, task: AgentTask) -> str:
    """Публикует одну задачу агента в Redis Stream, возвращает stream entry id."""
    payload: dict[str, Any] = {
        "swarm_id":     swarm_id,
        "agent_id":     task.agent_id,
        "agent_name":   task.agent_name,
        "network":      task.network,
        "from_address": task.from_address,
        "to_address":   task.to_address,
        "amount":       str(task.amount),
        "retry_count":  "0",
        "dispatched_at": str(int(time.time() * 1000)),
    }
    entry_id: str = await r.xadd(STREAM_KEY, payload)
    return entry_id


# ---------------------------------------------------------------------------
# Фоновый цикл: рекавери зависших задач (XCLAIM)
# ---------------------------------------------------------------------------
async def _claim_idle_loop():
    """
    Каждые CLAIM_INTERVAL_S секунд забирает задачи, которые были
    выданы агентам, но не подтверждены (XACK) более CLAIM_IDLE_MS мс.
    Переставляет их обратно в очередь (XADD) если retry_count < MAX_RETRY_COUNT,
    либо помечает как failed.
    """
    while True:
        await asyncio.sleep(CLAIM_INTERVAL_S)
        if redis_client is None:
            continue
        try:
            # Получаем все pending-записи (зависшие у агентов)
            pending_info = await redis_client.xpending_range(
                STREAM_KEY, GROUP_NAME,
                min="-", max="+", count=100,
            )
            if not pending_info:
                continue

            now_ms = int(time.time() * 1000)
            for entry in pending_info:
                idle_ms = now_ms - entry["time_since_delivered"]
                if idle_ms < CLAIM_IDLE_MS:
                    continue

                entry_id    = entry["message_id"]
                retry_count = entry.get("times_delivered", 1)

                # Забираем задачу на себя (coordinator = временный consumer)
                claimed = await redis_client.xclaim(
                    STREAM_KEY, GROUP_NAME, "coordinator-recovery",
                    min_idle_time=CLAIM_IDLE_MS,
                    message_ids=[entry_id],
                )
                if not claimed:
                    continue

                for c_id, fields in claimed:
                    swarm_id = fields.get("swarm_id", "unknown")
                    result_key = _task_result_key(swarm_id)

                    if retry_count >= MAX_RETRY_COUNT:
                        # Окончательный провал — помечаем failed
                        await redis_client.hset(result_key, entry_id, "failed")
                        await redis_client.xack(STREAM_KEY, GROUP_NAME, c_id)
                    else:
                        # Переотправляем в стрим с увеличенным retry_count
                        fields["retry_count"] = str(retry_count + 1)
                        await redis_client.xadd(STREAM_KEY, fields)
                        await redis_client.xack(STREAM_KEY, GROUP_NAME, c_id)

        except Exception as exc:
            print(f"[claim-loop] error: {exc}")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/health")
async def health():
    return {"status": "ok", "service": "swarm-coordinator"}


@app.post("/api/v1/swarm/dispatch", response_model=DispatchResponse)
async def dispatch_swarm(req: DispatchRequest):
    """
    Принимает route_id и список агентских задач,
    публикует их в Redis Stream, возвращает swarm_id.
    """
    if redis_client is None:
        raise HTTPException(status_code=503, detail="Redis не инициализирован")

    swarm_id = str(uuid.uuid4())
    result_key = _task_result_key(swarm_id)
    meta_key   = _swarm_meta_key(swarm_id)

    # Сохраняем метаинформацию о рое
    await redis_client.hset(meta_key, mapping={
        "route_id":  req.route_id,
        "total":     str(len(req.agents)),
        "created_at": str(int(time.time() * 1000)),
    })
    await redis_client.expire(meta_key, 86400)   # TTL 24 ч

    # Публикуем задачи
    for agent_task in req.agents:
        entry_id = await _publish_task(redis_client, swarm_id, agent_task)
        # Регистрируем в hash результатов как pending
        await redis_client.hset(result_key, entry_id, "pending")

    await redis_client.expire(result_key, 86400)

    return DispatchResponse(
        swarm_id=swarm_id,
        route_id=req.route_id,
        dispatched=len(req.agents),
        stream=STREAM_KEY,
    )


@app.get("/api/v1/swarm/{swarm_id}/status", response_model=SwarmStatus)
async def swarm_status(swarm_id: str):
    """
    Возвращает прогресс выполнения роя:
    сколько задач pending / completed / failed.
    """
    if redis_client is None:
        raise HTTPException(status_code=503, detail="Redis не инициализирован")

    meta_key   = _swarm_meta_key(swarm_id)
    result_key = _task_result_key(swarm_id)

    meta = await redis_client.hgetall(meta_key)
    if not meta:
        raise HTTPException(status_code=404, detail="Рой не найден")

    results = await redis_client.hgetall(result_key)
    values  = list(results.values())

    total     = int(meta.get("total", 0))
    completed = values.count("completed")
    failed    = values.count("failed")
    pending   = total - completed - failed

    progress = round((completed / total) * 100, 2) if total else 0.0

    return SwarmStatus(
        swarm_id=swarm_id,
        route_id=meta.get("route_id", ""),
        total=total,
        pending=max(0, pending),
        completed=completed,
        failed=failed,
        progress_percent=progress,
    )


@app.post("/api/v1/swarm/{swarm_id}/task/{entry_id}/ack")
async def ack_task(swarm_id: str, entry_id: str, success: bool = True):
    """
    Вызывается агентом после выполнения задачи.
    Обновляет статус в hash результатов и подтверждает сообщение в стриме.
    """
    if redis_client is None:
        raise HTTPException(status_code=503, detail="Redis не инициализирован")

    result_key = _task_result_key(swarm_id)
    status     = "completed" if success else "failed"

    await redis_client.hset(result_key, entry_id, status)
    await redis_client.xack(STREAM_KEY, GROUP_NAME, entry_id)

    return {"entry_id": entry_id, "status": status}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=False)
