"""Browser agent router — streams Browser Use progress via SSE."""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncGenerator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/browser-agent", tags=["browser-agent"])

SUPPLIERS_URL = "https://supply-chain-dashboard-eight.vercel.app/suppliers"


class BrowserAgentRequest(BaseModel):
    company: str
    note: str


def _sse(event: str, data: str) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


async def _stream_agent(company: str, note: str) -> AsyncGenerator[str, None]:
    try:
        from browser_use_sdk.v3 import AsyncBrowserUse  # type: ignore[import]
    except ImportError:
        yield _sse("error", "browser-use-sdk is not installed. Run: pip install browser-use-sdk")
        return

    api_key = get_settings().browser_use_api_key
    if not api_key:
        yield _sse("error", "BROWSER_USE_API_KEY is not configured in backend/.env")
        return

    task = f"""Go directly to {SUPPLIERS_URL} and click on "{company}".

Context about this supplier: {note}

Do exactly two things on their profile page:
1. Add one internal note — write 1-2 sentences based on the context above.
2. Send one message to the supplier — write 2-3 sentences based on the context above.

After clicking save/send each time, move on immediately. A cleared input means it worked."""

    client = AsyncBrowserUse(api_key=api_key)
    yield _sse("status", "Starting…")

    try:
        session = await client.sessions.create(keep_alive=True)
        if hasattr(session, "live_url") and session.live_url:
            yield _sse("live_url", session.live_url)

        try:
            run = client.run(task, session_id=session.id, model="claude-sonnet-4.6")
            async for msg in run:
                if msg.summary:
                    yield _sse("status", msg.summary[:80])
            yield _sse("done", "Successfully updated.")
        finally:
            await client.sessions.stop(session.id)

    except Exception as exc:
        logger.exception("Browser agent failed")
        yield _sse("error", str(exc))


@router.post("/run")
async def run_browser_agent(body: BrowserAgentRequest) -> StreamingResponse:
    """Stream browser agent progress as Server-Sent Events."""
    return StreamingResponse(
        _stream_agent(body.company, body.note),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
