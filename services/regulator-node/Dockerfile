FROM python:3.11-slim

LABEL service="most-regulator-node"

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY services/regulator-node/requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY libs/ libs/
COPY services/regulator-node/ .

EXPOSE 8003

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8003", "--workers", "2"]
