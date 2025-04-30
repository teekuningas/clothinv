# To start

## Backend Setup

```
$ make shell
$ make init_db
$ make start-backend
```

## Frontend Setup

1.  **Configure API Connection:**
    Create a `.env` file in the project root directory (next to `Makefile`). Add the following content, replacing the placeholder token with your actual Datasette API token:

    ```dotenv
    # .env
    VITE_API_PROVIDER="datasette"
    VITE_DATASATTE_URL="http://127.0.0.1:8001/inventory"
    VITE_DATASATTE_TOKEN="YOUR_DATASATTE_API_TOKEN_HERE"
    ```
    You can obtain a root user token from Datasette by visiting `http://localhost:8001/-/create-token` after starting the backend.

2.  **Start Frontend Development Server:**
    In a separate terminal (after running `make shell`):
    ```
    $ make watch-frontend
    ```
