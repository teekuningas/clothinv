# To start

## Backend Setup

```
$ make shell
$ make init_db
$ make start-backend
```

## Frontend Setup

1.  **Configure API Connection:**
    Create a `.env` file in the project root directory (next to `Makefile`). This file allows you to configure which backend provider the frontend connects to and provide necessary credentials.

    **Available Providers:**
    *   `indexedDB`: Uses the browser's internal IndexedDB. No further configuration needed.
    *   `datasette`: Connects to a Datasette instance. Requires URL and optionally a token.
    *   `postgrest`: Connects to a PostgREST API. Requires URL and a JWT token.

    **Example `.env` configurations:**

    *   **Using IndexedDB (Default if no `.env` or `VITE_API_PROVIDER` is set):**
        ```dotenv
        # .env
        VITE_API_PROVIDER="indexedDB"
        ```

    *   **Using Datasette:**
        Replace the placeholder URL and token with your actual Datasette details. You can obtain a root user token from Datasette by visiting `http://localhost:8001/-/create-token` after starting the Datasette backend (`make start-backend-datasette`).
        ```dotenv
        # .env
        VITE_API_PROVIDER="datasette"
        VITE_DATASATTE_URL="http://127.0.0.1:8001/inventory"
        VITE_DATASATTE_TOKEN="YOUR_DATASATTE_API_TOKEN_HERE" # Optional, needed for write operations if Datasette requires auth
        ```

    *   **Using PostgREST:**
        Replace the placeholder URL and token with your actual PostgREST details. The JWT token is generated when you start the PostgREST backend (`make start-backend-postgres-api`) and printed to the console.
        ```dotenv
        # .env
        VITE_API_PROVIDER="postgrest"
        VITE_POSTGREST_URL="http://127.0.0.1:4000" # Default URL from 'make start-backend-postgres-api'
        VITE_POSTGREST_TOKEN="YOUR_POSTGREST_JWT_TOKEN_HERE" # Required for authentication
        ```

    **Note:** If `VITE_API_PROVIDER` is set in `.env`, it overrides the hardcoded default in the application. Settings configured via the UI (Settings page) take precedence over `.env` variables after the initial load.

2.  **Start Frontend Development Server:**
    In a separate terminal (after running `make shell`):
    ```
    $ make watch-frontend
    ```
