FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY alembic.ini .
COPY migrations ./migrations
COPY app ./app

RUN useradd --create-home --uid 10001 api
USER api

EXPOSE 9666
# --no-access-log: the server's own access log prints full URLs with query strings, which can hold customer data.
# The application writes its own request log line without them.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:build --factory --host 0.0.0.0 --port 9666 --no-access-log"]
