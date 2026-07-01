FROM python:3.11-slim

LABEL service="most-orchestrator"

WORKDIR /app

# Системные зависимости для psycopg2 и cryptography
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Зависимости Python
COPY services/orchestrator/requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Общие библиотеки проекта
COPY libs/ libs/

# Код сервиса
COPY services/orchestrator/ .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
