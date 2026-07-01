"""
MOST — Swarm Agent
Автономный агент роя: слушает Redis Streams, выполняет транзакции
через blockchain_sim с 3 ретраями (exponential backoff 1s/2s/4s),
отчитывается координатору через HTTP.

Запуск: python main.py
"""
import asyncio
import json
import logging
import os
import socket
import time
import uuid

import httpx
import redis.asyncio as aioredis

# ---------------------------------------------------------------------------
# Конфигурация через ENV
# ---------------------------------------------------------------------------
REDIS_URL          = os.environ.get("REDIS_URL",          "redis://redis:6379/0")
COORDINATOR_URL    = os.environ.get("COORDINATOR_URL",    "http://swarm-coordinator:8001")
AGENT_ID           = os.environ.get("AGENT_ID",           str(uuid.uuid4()))
AGENT_NAME         = os.environ.get("AGENT_NAME",         f"agent-{socket.gethostname()}")
STREAM_KEY         = os.environ.get("STREAM_KEY",         "most:swarm:tasks")
GROUP_NAME         = os.environ.get("GROUP_NAME",         "swarm-agents")
CONSUMER_NAME      = AGENT_NAME                            # уникальное имя в группе
BLOCK_MS           = 5_000         # блокирующий XREADGROUP timeout
BATCH_SIZE         = 10            # сообщений за раз
MAX_RETRIES        = 3
BACKOFF            = [1, 2, 4]     # секунды между ретраями

# ---------------------------------------------------------------------------
# Логирование
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger(AGENT_NAME)


# ---------------------------------------------------------------------------
# Blockchain simulator (локальный импорт)
# ---------------------------------------------------------------------------
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from libs.blockchain_sim import BlockchainSimulator, Network

blockchain_sim = BlockchainSimulator()


# ---------------------------------------------------------------------------
# Основной класс агента
# ---------------------------------------------------------------------------
class SwarmAgent:
    def __init__(self, agent_id: str, agent_name: str):
        self.agent_id   = agent_id
        self.agent_name = agent_name
        self.redis: aioredis.Redis | None = None
        self._http: httpx.AsyncClient | None = None
        self._running = False

    # ── lifecycle ────────────────────────────────────────────────────────
    async def start(self):
        self.redis = await aioredis.from_url(REDIS_URL, decode_responses=True)
        self._http  = httpx.AsyncClient(base_url=COORDINATOR_URL, timeout=10.0)
        self._running = True
        log.info("Agent %s started, listening on stream %s", self.agent_name, STREAM_KEY)
        await self.listen_for_tasks()

    async def stop(self):
        self._running = False
        if self.redis:
            await self.redis.aclose()
        if self._http:
            await self._http.aclose()
        log.info("Agent %s stopped", self.agent_name)

    # ── публичные методы (по спецификации) ──────────────────────────────
    async def listen_for_tasks(self):
        """
        Бесконечный цикл подписки на Redis Stream через XREADGROUP.
        Читает сообщения, диспетчеризует в process_swarm_tasks.
        """
        while self._running:
            try:
                messages = await self.redis.xreadgroup(
                    groupname=GROUP_NAME,
                    consumername=CONSUMER_NAME,
                    streams={STREAM_KEY: ">"},
                    count=BATCH_SIZE,
                    block=BLOCK_MS,
                )
                if not messages:
                    continue

                for _stream, entries in messages:
                    tasks_by_swarm: dict[str, list[tuple[str, dict]]] = {}
                    for entry_id, fields in entries:
                        swarm_id = fields.get("swarm_id", "unknown")
                        tasks_by_swarm.setdefault(swarm_id, []).append((entry_id, fields))

                    # Обрабатываем параллельно по роям
                    await asyncio.gather(
                        *(self.process_swarm_tasks(swarm_id, tasks)
                          for swarm_id, tasks in tasks_by_swarm.items()),
                        return_exceptions=True,
                    )

            except aioredis.ConnectionError:
                log.warning("Redis connection lost, retrying in 5s...")
                await asyncio.sleep(5)
            except Exception as exc:
                log.error("listen_for_tasks error: %s", exc, exc_info=True)
                await asyncio.sleep(1)

    async def process_swarm_tasks(
        self,
        swarm_id: str,
        tasks: list[tuple[str, dict]],
    ):
        """
        Обрабатывает пакет задач одного роя.
        Запускает execute_task для каждой задачи, затем отчитывается координатору.
        """
        log.info("Swarm %s: processing %d task(s)", swarm_id, len(tasks))

        results = await asyncio.gather(
            *(self._process_single(swarm_id, entry_id, fields)
              for entry_id, fields in tasks),
            return_exceptions=True,
        )

        succeeded = sum(1 for r in results if r is True)
        failed    = len(results) - succeeded
        log.info(
            "Swarm %s: done — %d ok / %d failed",
            swarm_id, succeeded, failed,
        )

    async def _process_single(
        self,
        swarm_id: str,
        entry_id: str,
        fields: dict,
    ) -> bool:
        """Выполняет одну задачу и отчитывается координатору."""
        task = {
            "entry_id":     entry_id,
            "swarm_id":     swarm_id,
            "agent_id":     fields.get("agent_id", ""),
            "agent_name":   fields.get("agent_name", ""),
            "network":      fields.get("network", "ethereum"),
            "from_address": fields.get("from_address", ""),
            "to_address":   fields.get("to_address", ""),
            "amount":       float(fields.get("amount", 0)),
        }
        success = await self.execute_task(task)
        await self._ack(swarm_id, entry_id, success)
        return success

    async def execute_task(self, task: dict) -> bool:
        """
        Выполняет транзакцию через blockchain_sim.
        3 ретрая с exponential backoff: 1s → 2s → 4s.
        """
        network_str   = task["network"]
        from_address  = task["from_address"]
        to_address    = task["to_address"]
        amount        = task["amount"]
        agent_name    = task.get("agent_name", self.agent_name)

        for attempt in range(MAX_RETRIES):
            try:
                network = Network(network_str)
                tx_hash, success = await blockchain_sim.send_transaction(
                    network, from_address, to_address, amount,
                )
                if success:
                    log.info(
                        "[%s] ✓ tx %s on %s | amount=%.6f | hash=%s",
                        agent_name, task["entry_id"][:8], network_str, amount, tx_hash,
                    )
                    return True
                else:
                    log.warning(
                        "[%s] ✗ attempt %d/%d failed on %s",
                        agent_name, attempt + 1, MAX_RETRIES, network_str,
                    )
            except Exception as exc:
                log.error(
                    "[%s] attempt %d/%d exception on %s: %s",
                    agent_name, attempt + 1, MAX_RETRIES, network_str, exc,
                )

            if attempt < MAX_RETRIES - 1:
                backoff = BACKOFF[attempt]
                log.info("[%s] retrying in %ds...", agent_name, backoff)
                await asyncio.sleep(backoff)

        log.error("[%s] ✗✗ all %d retries exhausted for task %s",
                  agent_name, MAX_RETRIES, task["entry_id"][:8])
        return False

    # ── приватные хелперы ────────────────────────────────────────────────
    async def _ack(self, swarm_id: str, entry_id: str, success: bool):
        """Отправляет ACK координатору (HTTP) и подтверждает сообщение в Redis."""
        # 1. Уведомляем координатора
        try:
            if self._http:
                await self._http.post(
                    f"/api/v1/swarm/{swarm_id}/task/{entry_id}/ack",
                    params={"success": str(success).lower()},
                )
        except Exception as exc:
            log.warning("ACK to coordinator failed: %s — falling back to direct XACK", exc)
            # 2. Если координатор недоступен — XACK напрямую
            if self.redis:
                await self.redis.xack(STREAM_KEY, GROUP_NAME, entry_id)


# ---------------------------------------------------------------------------
# Точка входа: бесконечный цикл
# ---------------------------------------------------------------------------
async def main():
    agent = SwarmAgent(agent_id=AGENT_ID, agent_name=AGENT_NAME)
    try:
        await agent.start()
    except (KeyboardInterrupt, asyncio.CancelledError):
        pass
    finally:
        await agent.stop()


if __name__ == "__main__":
    asyncio.run(main())
