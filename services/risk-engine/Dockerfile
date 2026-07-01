FROM python:3.11-slim

LABEL service="most-risk-engine"

WORKDIR /app

COPY services/risk-engine/requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY libs/ libs/
COPY services/risk-engine/ .

EXPOSE 8002

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8002", "--workers", "4"]
