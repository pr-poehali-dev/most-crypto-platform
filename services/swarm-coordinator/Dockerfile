FROM python:3.11-slim

LABEL service="most-swarm-coordinator"

WORKDIR /app

COPY services/swarm-coordinator/requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY libs/ libs/
COPY services/swarm-coordinator/ .

EXPOSE 8001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "2"]
