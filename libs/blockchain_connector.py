"""
MOST — Blockchain Connector
============================
Замена BlockchainSimulator: реальные read-only RPC-подключения
(баланс, газ, статус сети) + реалистичный симулятор отправки транзакций.

ВАЖНО (архитектурное ограничение, сознательное решение):
  send_transaction() НИКОГДА не подписывает и не рассылает транзакцию
  в реальную сеть. Приватные ключи, переданные в функцию, используются
  ТОЛЬКО для локального построения адреса отправителя (eth_account.Account,
  offline) — сама транзакция не создаётся через w3.eth.send_raw_transaction.
  Вместо этого генерируется криптографически правдоподобный tx_hash и полная
  запись в аудит-лог (см. libs/audit_log.py опционально), как это требуется
  для демонстрации архитектуры (диплом/презентация) без реального движения
  средств.

  Все read-методы (get_balance, get_gas_price, get_block_number,
  is_connected) обращаются к настоящим публичным RPC-нодам.

Поддерживаемые сети: ethereum, bsc, polygon, tron, solana, arbitrum,
optimism, avalanche.
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import secrets
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

import httpx

log = logging.getLogger("blockchain_connector")

# Опциональные зависимости — модуль не должен падать, если web3/solana
# не установлены (например, при использовании только tron/solana веток).
try:
    from web3 import Web3
    from web3.middleware import ExtraDataToPOAMiddleware
except ImportError:  # pragma: no cover
    Web3 = None
    ExtraDataToPOAMiddleware = None


# ---------------------------------------------------------------------------
# Сети
# ---------------------------------------------------------------------------
class Network(str, Enum):
    ETHEREUM  = "ethereum"
    BSC       = "bsc"
    POLYGON   = "polygon"
    TRON      = "tron"
    SOLANA    = "solana"
    ARBITRUM  = "arbitrum"
    OPTIMISM  = "optimism"
    AVALANCHE = "avalanche"


# EVM-подобные сети работают через Web3.HTTPProvider
EVM_NETWORKS = {
    Network.ETHEREUM, Network.BSC, Network.POLYGON,
    Network.ARBITRUM, Network.OPTIMISM, Network.AVALANCHE,
}

# Сети с PoA-консенсусом требуют middleware для геометрии заголовков блока
POA_NETWORKS = {Network.BSC, Network.POLYGON, Network.AVALANCHE}

# Минимальный ERC-20 ABI (transfer + balanceOf + decimals) — достаточно для чтения балансов
ERC20_ABI = [
    {
        "constant": True,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "type": "function",
    },
    {
        "constant": True,
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "type": "function",
    },
    {
        "constant": False,
        "inputs": [
            {"name": "_to", "type": "address"},
            {"name": "_value", "type": "uint256"},
        ],
        "name": "transfer",
        "outputs": [{"name": "", "type": "bool"}],
        "type": "function",
    },
]


# ---------------------------------------------------------------------------
# Circuit Breaker
# ---------------------------------------------------------------------------
@dataclass
class _BreakerState:
    failures: int = 0
    opened_at: float = 0.0


class RPCCircuitBreaker:
    """
    Простой circuit breaker на сеть: после N подряд ошибок закрывает
    доступ к RPC на `timeout` секунд, чтобы не долбить мёртвую ноду.
    """

    def __init__(self, failure_threshold: int = 5, timeout: int = 60):
        self.threshold = failure_threshold
        self.timeout = timeout
        self._state: dict[str, _BreakerState] = {}

    def _get(self, network: str) -> _BreakerState:
        return self._state.setdefault(network, _BreakerState())

    def is_open(self, network: str) -> bool:
        st = self._get(network)
        if st.failures < self.threshold:
            return False
        if time.monotonic() - st.opened_at >= self.timeout:
            # таймаут истёк — даём шанс полу-открытому состоянию
            st.failures = 0
            return False
        return True

    def on_success(self, network: str) -> None:
        self._get(network).failures = 0

    def on_failure(self, network: str) -> None:
        st = self._get(network)
        st.failures += 1
        if st.failures == self.threshold:
            st.opened_at = time.monotonic()

    async def call(self, network: str, func):
        """Оборачивает вызов func() (coroutine factory) circuit breaker'ом."""
        if self.is_open(network):
            raise RuntimeError(f"Circuit breaker open for {network}: слишком много ошибок RPC подряд")
        try:
            result = await func()
            self.on_success(network)
            return result
        except Exception:
            self.on_failure(network)
            raise


# ---------------------------------------------------------------------------
# Retry helper
# ---------------------------------------------------------------------------
async def _retry(func, attempts: int = 3, base_delay: float = 0.5):
    """Экспоненциальный backoff: 0.5s → 1s → 2s."""
    last_exc: Optional[Exception] = None
    for attempt in range(attempts):
        try:
            return await func()
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            if attempt < attempts - 1:
                await asyncio.sleep(base_delay * (2 ** attempt))
    raise last_exc  # type: ignore[misc]


# ---------------------------------------------------------------------------
# BlockchainConnector
# ---------------------------------------------------------------------------
class BlockchainConnector:
    """
    Реальные RPC-подключения для чтения данных сети + безопасная (не
    рассылающая транзакции в сеть) симуляция отправки для демо-стенда.
    """

    def __init__(self):
        self.rpc_urls: dict[str, str] = {
            Network.ETHEREUM:  os.getenv("ETH_RPC",     "https://eth.llamarpc.com"),
            Network.BSC:       os.getenv("BSC_RPC",     "https://bsc-dataseed.binance.org"),
            Network.POLYGON:   os.getenv("POLYGON_RPC", "https://polygon-rpc.com"),
            Network.TRON:      os.getenv("TRON_RPC",    "https://api.trongrid.io"),
            Network.SOLANA:    os.getenv("SOL_RPC",     "https://api.mainnet-beta.solana.com"),
            Network.ARBITRUM:  os.getenv("ARB_RPC",     "https://arb1.arbitrum.io/rpc"),
            Network.OPTIMISM:  os.getenv("OP_RPC",      "https://mainnet.optimism.io"),
            Network.AVALANCHE: os.getenv("AVAX_RPC",    "https://api.avax.network/ext/bc/C/rpc"),
        }
        # Резервные (fallback) ноды — используются, если основная недоступна
        self.fallback_urls: dict[str, str] = {
            Network.ETHEREUM: os.getenv("ETH_FALLBACK", "https://rpc.ankr.com/eth"),
            Network.BSC:      os.getenv("BSC_FALLBACK", "https://rpc.ankr.com/bsc"),
            Network.POLYGON:  os.getenv("POLYGON_FALLBACK", "https://rpc.ankr.com/polygon"),
        }

        self._web3_connections: dict[str, "Web3"] = {}
        self._http = httpx.AsyncClient(timeout=10.0)
        self.breaker = RPCCircuitBreaker(failure_threshold=5, timeout=60)

    # ------------------------------------------------------------------
    # Web3 lazy-init (для EVM-сетей)
    # ------------------------------------------------------------------
    async def get_web3(self, network: Network | str) -> "Web3":
        network = Network(network)
        if network not in EVM_NETWORKS:
            raise ValueError(f"{network} не является EVM-совместимой сетью")
        if Web3 is None:
            raise RuntimeError("Пакет web3 не установлен (см. requirements.txt)")

        if network not in self._web3_connections:
            url = self.rpc_urls[network]
            w3 = Web3(Web3.HTTPProvider(url, request_kwargs={"timeout": 30}))
            if network in POA_NETWORKS and ExtraDataToPOAMiddleware is not None:
                w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
            self._web3_connections[network] = w3
        return self._web3_connections[network]

    async def _get_web3_with_fallback(self, network: Network) -> "Web3":
        """Пробует основную ноду, при неудаче — fallback."""
        try:
            w3 = await self.get_web3(network)
            if w3.is_connected():
                return w3
            raise ConnectionError(f"{network} RPC недоступен: {self.rpc_urls[network]}")
        except Exception:
            fallback = self.fallback_urls.get(network)
            if not fallback:
                raise
            log.warning("Основная нода %s недоступна, переключаюсь на fallback %s", network, fallback)
            w3 = Web3(Web3.HTTPProvider(fallback, request_kwargs={"timeout": 30}))
            if network in POA_NETWORKS and ExtraDataToPOAMiddleware is not None:
                w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
            self._web3_connections[network] = w3
            return w3

    # ------------------------------------------------------------------
    # READ: баланс
    # ------------------------------------------------------------------
    async def get_balance(
        self,
        network: Network | str,
        address: str,
        token_contract: Optional[str] = None,
    ) -> float:
        """
        Реальный баланс адреса в сети (нативный токен или ERC-20).
        Использует circuit breaker + retry.
        """
        network = Network(network)

        async def _do():
            if network not in EVM_NETWORKS:
                return await self._get_balance_non_evm(network, address)

            w3 = await self._get_web3_with_fallback(network)
            if token_contract:
                contract = w3.eth.contract(
                    address=Web3.to_checksum_address(token_contract), abi=ERC20_ABI
                )
                raw = contract.functions.balanceOf(Web3.to_checksum_address(address)).call()
                decimals = contract.functions.decimals().call()
                return raw / (10 ** decimals)

            raw = w3.eth.get_balance(Web3.to_checksum_address(address))
            return float(w3.from_wei(raw, "ether"))

        return await self.breaker.call(network.value, lambda: _retry(_do))

    async def _get_balance_non_evm(self, network: Network, address: str) -> float:
        """Баланс для tron/solana через их JSON-RPC / HTTP API."""
        if network == Network.TRON:
            resp = await self._http.post(
                f"{self.rpc_urls[Network.TRON]}/wallet/getaccount",
                json={"address": address, "visible": True},
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("balance", 0) / 1_000_000  # sun → TRX

        if network == Network.SOLANA:
            resp = await self._http.post(
                self.rpc_urls[Network.SOLANA],
                json={
                    "jsonrpc": "2.0", "id": 1,
                    "method": "getBalance",
                    "params": [address],
                },
            )
            resp.raise_for_status()
            data = resp.json()
            lamports = data.get("result", {}).get("value", 0)
            return lamports / 1_000_000_000  # lamports → SOL

        raise ValueError(f"Неизвестная не-EVM сеть: {network}")

    # ------------------------------------------------------------------
    # READ: цена газа
    # ------------------------------------------------------------------
    async def get_gas_price(self, network: Network | str) -> int:
        """Текущая цена газа в wei (для EVM-сетей)."""
        network = Network(network)

        async def _do():
            if network not in EVM_NETWORKS:
                raise ValueError(f"{network}: понятие gas_price не применимо (не EVM)")
            w3 = await self._get_web3_with_fallback(network)
            return int(w3.eth.gas_price)

        return await self.breaker.call(network.value, lambda: _retry(_do))

    # ------------------------------------------------------------------
    # READ: номер последнего блока / статус сети
    # ------------------------------------------------------------------
    async def get_block_number(self, network: Network | str) -> int:
        network = Network(network)

        async def _do():
            if network not in EVM_NETWORKS:
                raise ValueError(f"{network}: get_block_number доступен только для EVM-сетей")
            w3 = await self._get_web3_with_fallback(network)
            return int(w3.eth.block_number)

        return await self.breaker.call(network.value, lambda: _retry(_do))

    async def is_connected(self, network: Network | str) -> bool:
        """Быстрая health-check без ретраев — используется в мониторинге."""
        network = Network(network)
        try:
            if network in EVM_NETWORKS:
                w3 = await self.get_web3(network)
                return bool(w3.is_connected())
            if network == Network.TRON:
                resp = await self._http.get(f"{self.rpc_urls[Network.TRON]}/wallet/getnowblock")
                return resp.status_code == 200
            if network == Network.SOLANA:
                resp = await self._http.post(
                    self.rpc_urls[Network.SOLANA],
                    json={"jsonrpc": "2.0", "id": 1, "method": "getHealth"},
                )
                return resp.status_code == 200
        except Exception:
            return False
        return False

    # ------------------------------------------------------------------
    # generate_address — детерминированная генерация технического адреса
    # (для внутренних transit-адресов роя, живущих <30 сек, НЕ кошельки
    # третьих лиц). Используется только для демо-роутинга.
    # ------------------------------------------------------------------
    def generate_address(self, network: Network | str) -> str:
        network = Network(network)
        rand = secrets.token_hex(20)
        if network == Network.TRON:
            return "T" + secrets.token_hex(17)
        if network == Network.SOLANA:
            return secrets.token_hex(22)
        return "0x" + rand  # EVM-подобный формат

    # ------------------------------------------------------------------
    # send_transaction — СИМУЛЯЦИЯ, реальная отправка в сеть НЕ выполняется
    # ------------------------------------------------------------------
    async def send_transaction(
        self,
        network: Network | str,
        from_key_or_address: str,
        to_address: str,
        amount: float,
        token_contract: Optional[str] = None,
    ) -> tuple[str, bool]:
        """
        Демонстрационная симуляция перевода.

        ⚠️ Приватные ключи НЕ используются для подписи и никуда не
        отправляются: параметр from_key_or_address нужен только чтобы
        получить публичный адрес отправителя (offline-вычисление) и
        включить его в лог/сгенерированный хэш для правдоподобности.
        Реального `eth_sendRawTransaction` здесь нет — это единственное
        сознательное ограничение архитектуры для учебного стенда.

        Возвращает (tx_hash, success).
        """
        network = Network(network)

        from_address = self._safe_public_address(network, from_key_or_address)

        # Небольшая случайная задержка — имитация сетевого подтверждения
        await asyncio.sleep(0.05)

        payload = f"{network.value}|{from_address}|{to_address}|{amount}|{token_contract}|{secrets.token_hex(8)}"
        tx_hash = "0x" + hashlib.sha256(payload.encode()).hexdigest()

        # Симулированная вероятность успеха — 97%, как у реальной сети с редкими revert
        success = secrets.randbelow(100) < 97

        log.info(
            "[SIMULATED] network=%s from=%s to=%s amount=%.8