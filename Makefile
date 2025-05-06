# --- Configuration ---
ENV ?= dev # Default environment (can be overridden: make start-backends ENV=test)

# Common
SCHEMA_SQLITE_FILE := db/schema_sqlite.sql
SCHEMA_POSTGRES_FILE := db/schema_postgres.sql

# --- Datasette / SQLite Configuration ---
DATASETTE_CONTAINER_NAME := inventory-datasette-$(ENV)
DATASETTE_PORT := 8001 # Keep port consistent for simplicity, rely on container name
DATASETTE_VOLUME_NAME := inventory-datasette-data-$(ENV)
DATASETTE_DB_FILENAME := inventory.db # Filename *inside* the volume/container
DATASETTE_IMAGE := datasetteproject/datasette:latest

# --- PostgreSQL / PostgREST Configuration ---
POSTGRES_CONTAINER_NAME := inventory-postgres-$(ENV)
POSTGRES_PORT := 5432 # Keep port consistent
POSTGRES_VOLUME_NAME := inventory-postgres-data-$(ENV)
POSTGRES_DB := inventory_db_$(ENV)
POSTGRES_USER := inventory_user_$(ENV)
POSTGRES_PASSWORD := supersecretpassword # Keep simple for local dev/test
POSTGRES_IMAGE := postgres:15

POSTGREST_CONTAINER_NAME := inventory-postgrest-$(ENV)
POSTGREST_PORT := 4000 # Keep port consistent
POSTGREST_IMAGE := postgrest/postgrest:latest
# JWT Secret will be generated dynamically on start

# --- Helper Function ---
# Check if a docker container is running
# Note: Using exact name match (^name$) is more robust
is_running = $(shell sudo docker ps -q -f name=^$(1)$$)

.PHONY: help shell \
	start-backend-datasette stop-backend-datasette clean-backend-datasette \
	start-backend-postgrest stop-backend-postgrest clean-backend-postgrest \
	start-backends stop-backends clean-backends \
	watch-frontend format

help:
	@echo "Available commands:"
	@echo "  make shell                   - Enter the Nix development shell"
	@echo "  make start-backends [ENV=X]  - Start Datasette & PostgREST backends (default ENV=dev)"
	@echo "  make stop-backends [ENV=X]   - Stop Datasette & PostgREST backends"
	@echo "  make clean-backends [ENV=X]  - Stop backends AND remove data volumes"
	@echo "  --- Individual Backends ---"
	@echo "  make start-backend-datasette [ENV=X]"
	@echo "  make stop-backend-datasette [ENV=X]"
	@echo "  make clean-backend-datasette [ENV=X]"
	@echo "  make start-backend-postgrest [ENV=X] - Starts Postgres & PostgREST, outputs JWT"
	@echo "  make stop-backend-postgrest [ENV=X]  - Stops Postgres & PostgREST"
	@echo "  make clean-backend-postgrest [ENV=X] - Stops Postgres & removes data volume"
	@echo "  --- Frontend ---"
	@echo "  make watch-frontend          - Start frontend dev server"
	@echo "  make format                  - Format frontend code"

shell:
	nix develop

# --- Datasette Backend ---

start-backend-datasette:
	@echo "Starting Datasette backend (ENV=$(ENV))..."
	@if [ -n "$(call is_running,$(DATASETTE_CONTAINER_NAME))" ]; then \
		echo "Container $(DATASETTE_CONTAINER_NAME) is already running."; \
	else \
		echo "Ensuring volume $(DATASETTE_VOLUME_NAME) exists..."; \
		sudo docker volume create $(DATASETTE_VOLUME_NAME) > /dev/null; \
		echo "Checking/Initializing database in volume $(DATASETTE_VOLUME_NAME)..."; \
		@echo "DEBUG: DATASETTE_IMAGE for init is [$(DATASETTE_IMAGE)]"
		sudo docker run --rm \
			-v $(DATASETTE_VOLUME_NAME):/data \
			-v $(shell pwd)/$(SCHEMA_SQLITE_FILE):/schema.sql:ro \
			$(DATASETTE_IMAGE) \
			sh -c 'if [ ! -f /data/$(DATASETTE_DB_FILENAME) ]; then echo "Initializing DB..."; sqlite3 /data/$(DATASETTE_DB_FILENAME) < /schema.sql; else echo "DB already exists."; fi'; \
		echo "Starting Datasette container $(DATASETTE_CONTAINER_NAME)..."; \
		@echo "DEBUG: DATASETTE_IMAGE for main container is [$(DATASETTE_IMAGE)]"
		sudo docker run -d --name $(DATASETTE_CONTAINER_NAME) \
			-p $(DATASETTE_PORT):$(DATASETTE_PORT) \
			-v $(DATASETTE_VOLUME_NAME):/data \
			$(DATASETTE_IMAGE) \
			datasette serve /data/$(DATASETTE_DB_FILENAME) --port $(DATASETTE_PORT) --host 0.0.0.0 --cors --root; \
		echo "Datasette container started on http://127.0.0.1:$(DATASETTE_PORT)"; \
	fi

stop-backend-datasette:
	@echo "Stopping Datasette backend (ENV=$(ENV))..."
	@if [ -n "$(call is_running,$(DATASETTE_CONTAINER_NAME))" ]; then \
		sudo docker stop $(DATASETTE_CONTAINER_NAME); \
		sudo docker rm $(DATASETTE_CONTAINER_NAME); \
		echo "Container $(DATASETTE_CONTAINER_NAME) stopped and removed."; \
	else \
		echo "Container $(DATASETTE_CONTAINER_NAME) is not running."; \
	fi

clean-backend-datasette: stop-backend-datasette
	@echo "Removing Datasette data volume $(DATASETTE_VOLUME_NAME)..."
	@sudo docker volume rm $(DATASETTE_VOLUME_NAME) || echo "Volume already removed or does not exist."

# --- PostgREST Backend (Postgres + PostgREST) ---

start-backend-postgrest:
	@echo "Starting PostgREST backend (Postgres + PostgREST) (ENV=$(ENV))..."
	# --- Start Postgres ---
	@echo "Starting Postgres container $(POSTGRES_CONTAINER_NAME)..."
	@if [ -n "$(call is_running,$(POSTGRES_CONTAINER_NAME))" ]; then \
		echo "Postgres container $(POSTGRES_CONTAINER_NAME) is already running."; \
	else \
		echo "Ensuring volume $(POSTGRES_VOLUME_NAME) exists..."; \
		sudo docker volume create $(POSTGRES_VOLUME_NAME) > /dev/null; \
		echo "Starting Postgres container $(POSTGRES_CONTAINER_NAME)..."; \
		sudo docker run -d --name $(POSTGRES_CONTAINER_NAME) \
			-e POSTGRES_DB=$(POSTGRES_DB) \
			-e POSTGRES_USER=$(POSTGRES_USER) \
			-e POSTGRES_PASSWORD=$(POSTGRES_PASSWORD) \
			-p $(POSTGRES_PORT):5432 \
			-v $(POSTGRES_VOLUME_NAME):/var/lib/postgresql/data \
			-v $(shell pwd)/$(SCHEMA_POSTGRES_FILE):/docker-entrypoint-initdb.d/init.sql:ro \
			$(POSTGRES_IMAGE); \
		echo "Waiting for Postgres to be ready..."; \
		until sudo docker exec $(POSTGRES_CONTAINER_NAME) pg_isready -U $(POSTGRES_USER) -d $(POSTGRES_DB) -q; do \
			sleep 1; \
		done; \
		echo "Postgres container started and initialized (if volume was empty)."; \
	fi
	# --- Start PostgREST ---
	@echo "Starting PostgREST container $(POSTGREST_CONTAINER_NAME)..."
	@if [ -n "$(call is_running,$(POSTGREST_CONTAINER_NAME))" ]; then \
		echo "PostgREST container $(POSTGREST_CONTAINER_NAME) is already running."; \
		echo "NOTE: If you need a new JWT token, stop and restart."; \
	else \
		JWT_SECRET=$$(head /dev/urandom | tr -dc A-Za-z0-9 | head -c 64); \
		JWT_PAYLOAD='{"role":"$(POSTGRES_USER)"}'; \
		JWT_TOKEN=$$(echo -n $$JWT_PAYLOAD | jwt encode --secret $$JWT_SECRET --alg HS256 -); \
		echo ""; \
		echo ">>> COPY THIS JWT TOKEN INTO THE UI SETTINGS (ENV=$(ENV)) <<<"; \
		echo ""; \
		echo "$$JWT_TOKEN"; \
		echo ""; \
		echo ">>> END OF JWT TOKEN <<<"; \
		echo ""; \
		sudo docker run -d --name $(POSTGREST_CONTAINER_NAME) \
			-e PGRST_DB_URI="postgresql://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@127.0.0.1:$(POSTGRES_PORT)/$(POSTGRES_DB)" \
			-e PGRST_DB_SCHEMA="public" \
			-e PGRST_DB_ANON_ROLE="anon_role" \
			-e PGRST_JWT_SECRET="$$JWT_SECRET" \
			-e PGRST_SERVER_PORT="$(POSTGREST_PORT)" \
			-e PGRST_OPENAPI_SERVER_PROXY_URI="http://localhost:$(POSTGREST_PORT)" \
			--network host \
			$(POSTGREST_IMAGE); \
		echo "PostgREST container started on http://localhost:$(POSTGREST_PORT)"; \
	fi

stop-backend-postgrest:
	@echo "Stopping PostgREST backend (Postgres + PostgREST) (ENV=$(ENV))..."
	# Stop PostgREST first
	@if [ -n "$(call is_running,$(POSTGREST_CONTAINER_NAME))" ]; then \
		sudo docker stop $(POSTGREST_CONTAINER_NAME); \
		sudo docker rm $(POSTGREST_CONTAINER_NAME); \
		echo "Container $(POSTGREST_CONTAINER_NAME) stopped and removed."; \
	else \
		echo "Container $(POSTGREST_CONTAINER_NAME) is not running."; \
	fi
	# Stop Postgres
	@if [ -n "$(call is_running,$(POSTGRES_CONTAINER_NAME))" ]; then \
		sudo docker stop $(POSTGRES_CONTAINER_NAME); \
		sudo docker rm $(POSTGRES_CONTAINER_NAME); \
		echo "Container $(POSTGRES_CONTAINER_NAME) stopped and removed."; \
	else \
		echo "Container $(POSTGRES_CONTAINER_NAME) is not running."; \
	fi

clean-backend-postgrest: stop-backend-postgrest
	@echo "Removing Postgres data volume $(POSTGRES_VOLUME_NAME)..."
	@sudo docker volume rm $(POSTGRES_VOLUME_NAME) || echo "Volume already removed or does not exist."

# --- Combined Backend Management ---

start-backends: start-backend-datasette start-backend-postgrest
	@echo "All backends (ENV=$(ENV)) started."

stop-backends: stop-backend-datasette stop-backend-postgrest
	@echo "All backends (ENV=$(ENV)) stopped."

clean-backends: clean-backend-datasette clean-backend-postgrest
	@echo "All backends (ENV=$(ENV)) stopped and data volumes removed."

# --- Frontend ---

watch-frontend:
	@echo "Starting frontend development server..."
	@cd frontend && npm install && npm run dev

format:
	@cd frontend && npm run format:jsx
	@cd frontend && npm run format:css

# --- Remove Old Targets ---
# Remove init-db-datasette, start-backend-datasette (old), init-db-postgres, start-backend-postgres, start-backend-postgres-api
