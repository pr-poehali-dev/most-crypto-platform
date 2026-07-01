FROM python:3.11-slim

LABEL service="most-swarm-agent"

WORKDIR /app

# cryptography нужна для некоторых сетей blockchain_sim
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        libffi-dev \
    && rm -rf /var/lib/apt/lists/*

COPY services/swarm-agent/requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY libs/ libs/
COPY services/swarm-agent/ .

# Агент — не HTTP-сервер, это воркер-процесс
CMD ["python", "main.py"]
