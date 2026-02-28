<a name="section-16"></a>
# SECTION 16 — Docker & Containerization for Data

"It works on my machine!" 

To prevent this problem, Data Engineers use Docker. Containerization allows you to package your data pipeline (Python, libraries, OS dependencies) into a portable image that runs identically on your laptop, the testing server, and the production cloud.

## 16.1 Dockerfile for Data Pipeline

```dockerfile
# Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy code
COPY src/ ./src/
COPY config/ ./config/

# Non-root user (security best practice)
RUN useradd --create-home appuser
USER appuser

# Run pipeline
CMD ["python", "src/pipeline.py"]
```

## 16.2 Docker Compose for Full Stack

```yaml
# docker-compose.yml
version: "3.9"

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: datauser
      POSTGRES_PASSWORD: datapass
      POSTGRES_DB: analytics
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U datauser"]
      interval: 10s
      retries: 5

  pipeline:
    build: .
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://datauser:datapass@postgres:5432/analytics
      API_KEY: ${API_KEY}
    volumes:
      - ./data:/app/data
    restart: "no"

  jupyter:
    image: jupyter/datascience-notebook:python-3.11
    ports:
      - "8888:8888"
    volumes:
      - ./notebooks:/home/jovyan/work
      - ./data:/home/jovyan/data
    environment:
      JUPYTER_TOKEN: "mytoken"

  airflow-webserver:
    image: apache/airflow:2.8.0
    command: webserver
    ports:
      - "8080:8080"
    environment:
      AIRFLOW__DATABASE__SQL_ALCHEMY_CONN: postgresql+psycopg2://datauser:datapass@postgres/airflow
      AIRFLOW__CORE__EXECUTOR: LocalExecutor
    depends_on:
      - postgres
    volumes:
      - ./dags:/opt/airflow/dags

volumes:
  postgres_data:
```

## 16.3 Common Docker Commands

```bash
# Build image
docker build -t my-pipeline:latest .

# Run container
docker run --env-file .env my-pipeline:latest

# Run interactively
docker run -it --entrypoint bash my-pipeline:latest

# Docker Compose
docker-compose up -d                # start all services detached
docker-compose logs -f pipeline     # follow logs for service
docker-compose exec postgres psql -U datauser -d analytics  # shell into service
docker-compose down -v              # stop and remove volumes

# Debug a running container
docker exec -it container_name bash
docker logs container_name --tail 100
docker inspect container_name

# Clean up
docker system prune -a              # remove all unused resources
```

---

