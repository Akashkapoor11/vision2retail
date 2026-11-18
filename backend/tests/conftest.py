"""Keep test collection isolated from configured external services."""
import os

# app.db.session constructs its engine at import time. Unit/API tests use their own
# temporary SQLite engine and must never attempt to import a production DB driver.
os.environ["DATABASE_URL"] = "sqlite+pysqlite://"
