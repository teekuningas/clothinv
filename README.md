# To start

## Frontend Setup

1.  **Configure API Connection:**
    The application uses the browser's IndexedDB for storage by default. You can configure it to connect to a backend API (like Datasette or PostgREST) via the **Settings** page within the application after launching it. Configuration is stored in the browser's local storage.

2.  **Start Frontend Development Server:**
    In a separate terminal (after running `make shell`):
    ```
    $ make watch-frontend
    ```
