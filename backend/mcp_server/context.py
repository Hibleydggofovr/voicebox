"""Per-request client identity for MCP calls.

MCP clients identify themselves via an ``X-Voicebox-Client-Id`` HTTP header
(direct-HTTP clients set it in their MCP config; the stdio shim forwards it
from the ``VOICEBOX_CLIENT_ID`` env var). Middleware copies the value into a
ContextVar so tool implementations can read it without plumbing the request
object through every service call.
"""

import logging
from contextvars import ContextVar
from datetime import datetime

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp


logger = logging.getLogger(__name__)

CLIENT_ID_HEADER = "X-Voicebox-Client-Id"

# Tool handlers read this to apply per-client voice bindings.
current_client_id: ContextVar[str | None] = ContextVar(
    "current_client_id", default=None
)


class ClientIdMiddleware(BaseHTTPMiddleware):
    """Copy X-Voicebox-Client-Id into a ContextVar and stamp last_seen_at.

    Only stamps on MCP-endpoint requests (anything under ``/mcp``) so
    unrelated REST traffic with the header set won't advance the
    last-seen timestamp — the Settings UI uses that to show when each
    client was last heard from.
    """

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next) -> Response:
        client_id = request.headers.get(CLIENT_ID_HEADER)
        token = current_client_id.set(client_id)
        try:
            response = await call_next(request)
        finally:
            current_client_id.reset(token)

        if client_id and request.url.path.startswith("/mcp"):
            _stamp_last_seen(client_id)
        return response


def _stamp_last_seen(client_id: str) -> None:
    """Update or create the MCPClientBinding row for this client_id."""
    try:
        from ..database import get_db
        from ..database.models import MCPClientBinding
    except Exception:
        return
    try:
        db = next(get_db())
    except Exception:
        return
    try:
        row = (
            db.query(MCPClientBinding)
            .filter(MCPClientBinding.client_id == client_id)
            .first()
        )
        if row is None:
            row = MCPClientBinding(client_id=client_id)
            db.add(row)
        row.last_seen_at = datetime.utcnow()
        db.commit()
    except Exception:
        logger.debug(
            "Could not stamp last_seen_at for %s", client_id, exc_info=True
        )
        db.rollback()
    finally:
        db.close()
