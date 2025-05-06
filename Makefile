# --- Configuration ---
ENV ?= dev

# Common
SCHEMA_SQLITE_FILE := db/schema_sqlite.sql
SCHEMA_POSTGRES_FILE := db/schema_postgres.sql

# --- Datasette / SQLite Configuration ---
DATASETTE_CONTAINER_NAME := inventory-datasette-$(ENV)
DATASETTE_PORT := 8001
DATASETTE_VOLUME_NAME := inventory-datasette-data-$(ENV)
DATASETTE_DB_FILENAME := inventory.db
DATASETTE_IMAGE := datasetteproject/datasette:latest

# --- PostgreSQL / PostgREST Configuration ---
POSTGRES_CONTAINER_NAME := inventory-postgres-$(ENV)
POSTGRES_PORT := 5432
POSTGRES_VOLUME_NAME := inventory-postgres-data-$(ENV)
POSTGRES_DB := inventory_db_$(ENV)
POSTGRES_USER := inventory_user_$(ENV)
POSTGRES_PASSWORD := supersecretpassword
POSTGRES_IMAGE := postgres:15
POSTGREST_CONTAINER_NAME := inventory-postgrest-$(ENV)
POSTGREST_PORT := 4000
POSTGREST_IMAGE := postgrest/postgrest:latest

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
		echo "Checking/Initializing database in volume $(DATASETTE_VOLUME_NAME) using Python script..."; \
		sudo docker run --rm \
			-v $(DATASETTE_VOLUME_NAME):/data \
			-v $(shell pwd)/$(SCHEMA_SQLITE_FILE):/schema.sql:ro \
			-v $(shell pwd)/db/init_sqlite.py:/init_sqlite.py:ro \
			-e DB_PATH="/data/$(DATASETTE_DB_FILENAME)" \
			-e SCHEMA_PATH="/schema.sql" \
			$(DATASETTE_IMAGE) \
			python /init_sqlite.py && \
		echo "Starting Datasette container $(DATASETTE_CONTAINER_NAME)..." && \
		sudo docker run -d --name $(DATASETTE_CONTAINER_NAME) \
			-p $(DATASETTE_PORT):$(DATASETTE_PORT) \
			-v $(DATASETTE_VOLUME_NAME):/data \
			$(DATASETTE_IMAGE) \
			datasette serve /data/$(DATASETTE_DB_FILENAME) --port $(DATASETTE_PORT) --host 0.0.0.0 --cors --root; \
		echo "Datasette container started on http://127.0.0.1:$(DATASETTE_PORT)"; \
	fi

stop-backend-datasette:
	@echo "Stopping Datasette backend (ENV=$(ENV))..."
	@echo "Attempting to stop container $(DATASETTE_CONTAINER_NAME)..."
	@sudo docker stop $(DATASETTE_CONTAINER_NAME) > /dev/null 2>&1 || true
	@echo "Attempting to remove container $(DATASETTE_CONTAINER_NAME)..."
	@sudo docker rm $(DATASETTE_CONTAINER_NAME) > /dev/null 2>&1 || echo "Container $(DATASETTE_CONTAINER_NAME) not found or already removed."
	@echo "Datasette container stop/remove process complete."

clean-backend-datasette: stop-backend-datasette
	@echo "Removing Datasette data volume $(DATASETTE_VOLUME_NAME)..."
	@sudo docker volume rm $(DATASETTE_VOLUME_NAME) || echo "Volume already removed or does not exist."

# --- PostgREST Backend (Postgres + PostgREST) ---

start-backend-postgrest:
	@echo "Starting PostgREST backend (Postgres + PostgREST) (ENV=$(ENV))..."
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
		echo ""; \
		echo ">>> POSTGREST JWT CONFIGURATION (ENV=$(ENV)) <<<"; \
		echo ""; \
		echo "Generated JWT Secret (used by PostgREST container):"; \
		echo "$$JWT_SECRET"; \
		echo ""; \
		if command -v jwt >/dev/null 2>&1; then \
			JWT_TOKEN=$$(echo -n $$JWT_PAYLOAD | jwt encode --secret $$JWT_SECRET --alg HS256 -); \
			echo "JWT Token (for UI settings - generated using jwt-cli):"; \
			echo "$$JWT_TOKEN"; \
		else \
			echo "WARNING: 'jwt-cli' not found in PATH."; \
			echo "To generate the JWT Token for the UI, you can:"; \
			echo "  1. Install jwt-cli (e.g., 'npm install -g @tsndr/jwt-cli' or via Nix shell)"; \
			echo "  2. Use an online tool like https://jwt.io with:"; \
			echo "     - Algorithm: HS256"; \
			echo "     - Payload:   $$JWT_PAYLOAD"; \
			echo "     - Secret:    (copy the secret printed above)"; \
		fi; \
		echo ""; \
		echo ">>> END OF JWT CONFIGURATION <<<"; \
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
	# Stop and remove PostgREST container
	@echo "Attempting to stop container $(POSTGREST_CONTAINER_NAME)..."
	@sudo docker stop $(POSTGREST_CONTAINER_NAME) > /dev/null 2>&1 || true
	@echo "Attempting to remove container $(POSTGREST_CONTAINER_NAME)..."
	@sudo docker rm $(POSTGREST_CONTAINER_NAME) > /dev/null 2>&1 || echo "Container $(POSTGREST_CONTAINER_NAME) not found or already removed."

	# Stop and remove Postgres container
	@echo "Attempting to stop container $(POSTGRES_CONTAINER_NAME)..."
	@sudo docker stop $(POSTGRES_CONTAINER_NAME) > /dev/null 2>&1 || true
	@echo "Attempting to remove container $(POSTGRES_CONTAINER_NAME)..."
	@sudo docker rm $(POSTGRES_CONTAINER_NAME) > /dev/null 2>&1 || echo "Container $(POSTGRES_CONTAINER_NAME) not found or already removed."

	@echo "PostgREST and Postgres containers stop/remove process complete."

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
