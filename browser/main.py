"""
Supply Chain Agent
==================
Input: supplier name + context paragraph
Action: finds the supplier on the dashboard, adds an internal note,
        and sends a message to the supplier based on severity.

Usage:
    python3 main.py --company "Iberian Packaging Solutions" --note 'Delayed 3 shipments...'
    python3 main.py   (interactive prompts)
"""
import asyncio
import argparse
import os
import sys
from dotenv import load_dotenv
from browser_use_sdk.v3 import AsyncBrowserUse
from rich.console import Console
from rich.panel import Panel

load_dotenv()
console = Console() 

SUPPLY_URL = "https://supply-chain-dashboard-eight.vercel.app/suppliers"


def get_inputs(args) -> tuple[str, str]:
    company = args.company
    note = args.note

    if not company:
        company = input("Supplier name: ").strip()
    if not note:
        console.print("Context paragraph (press Enter twice when done):")
        lines = []
        while True:
            line = input()
            if line == "" and lines and lines[-1] == "":
                break
            lines.append(line)
        note = "\n".join(lines).strip()

    if not company or not note:
        console.print("[red]Both supplier name and context are required.[/red]")
        sys.exit(1)

    return company, note


async def run_supply(company: str, note: str) -> None:
    api_key = os.environ.get("BROWSER_USE_API_KEY", "")
    if not api_key:
        console.print("[red]Missing BROWSER_USE_API_KEY in .env[/red]")
        sys.exit(1)

    client = AsyncBrowserUse(api_key=api_key)
    session = await client.sessions.create(keep_alive=True)

    console.print(f"[dim]Session: {session.id}[/dim]")
    if hasattr(session, "live_url") and session.live_url:
        console.print(f"[bold yellow]Watch live:[/bold yellow] {session.live_url}")

    try:
        task = f"""
Go to {SUPPLY_URL}

Navigate to the "Suppliers" section of the dashboard.
Find the supplier named "{company}" and open their profile.

════════════════════════════════════════
CONTEXT ABOUT THIS SUPPLIER:
"{note}"
════════════════════════════════════════

STEP 1 — ASSESS SEVERITY
Read the context carefully and classify it into one of these tiers:

  TIER 1 — CRITICAL (immediate action required)
    Triggers: legal violations, sanctions, fraud, bribery, safety failures,
    government watch lists, regulatory non-compliance, unresolvable breaches.
    → Action: Relationship termination notice.

  TIER 2 — SERIOUS (formal escalation required)
    Triggers: repeated delays (2+ shipments), quality failures on multiple orders,
    contract SLA breaches, financial instability signals, unresponsiveness.
    → Action: Formal written warning demanding a corrective action plan within 14 days.

  TIER 3 — MINOR (watch and warn)
    Triggers: single delay, one-off quality complaint, minor miscommunication.
    → Action: Professional follow-up requesting explanation and timeline.

  TIER 4 — POSITIVE (recognition)
    Triggers: on-time delivery, quality praise, strong partnership signals.
    → Action: Appreciation message, express interest in deepening the relationship.

STEP 2 — WRITE THE INTERNAL NOTE
Add a note to the supplier's record on the dashboard.
The note is for the internal supply chain team. It must include:
  - A clear one-line severity label: e.g. "⚠️ TIER 1 — CRITICAL" or "✅ TIER 4 — POSITIVE"
  - A 2–3 sentence summary of the key issues or strengths
  - A recommended next step for the team (e.g. "Initiate termination process", "Escalate to legal", "Schedule supplier review call")

IMPORTANT — after you click "Add Note" or "Save", the textarea will automatically
clear itself. This is normal and means the note was saved successfully.
Do NOT re-enter or re-submit the note. Move on to Step 3 immediately.

STEP 3 — SEND A MESSAGE TO THE SUPPLIER
Use whatever messaging or contact feature is available on the supplier's profile.
Write a short, direct chat message — 2 to 3 sentences maximum, no subject line,
no formal letter format, no greetings or sign-offs. Just the core message, plain
and professional, as if sending a chat to a business contact.

  For TIER 1 (Critical):
    State that due to the specific issue (name it), you are initiating an immediate
    relationship review and all new orders are on hold. Ask them to respond within
    5 business days.
    Example: "Due to identified U.S. sanctions exposure, we are placing all active
    orders on hold and initiating a formal compliance review. Please respond within
    5 business days with a written explanation."

  For TIER 2 (Serious):
    Name the specific failures, state that this breaches your SLA, and demand a
    corrective action plan within 14 days.
    Example: "We've recorded 3 delayed shipments and quality failures this quarter,
    which breach our SLA terms. Please submit a corrective action plan within 14
    days or we will escalate to contract review."

  For TIER 3 (Minor):
    Acknowledge the issue briefly and ask for an explanation and timeline.
    Example: "We noticed a delay on your last shipment and wanted to follow up —
    can you share what happened and your expected resolution timeline?"

  For TIER 4 (Positive):
    Express specific appreciation and signal interest in the relationship.
    Example: "Your on-time delivery and quality this quarter have been excellent —
    we really value the partnership and look forward to continuing to grow together."

Complete Step 2 and Step 3 exactly once each — do not repeat either action.
After clicking save/submit for each step, move on immediately without re-checking
the textarea or re-submitting. A cleared textarea or empty input field after saving
is confirmation of success, not failure.
""".strip()

        run = client.run(task, session_id=session.id, model="claude-sonnet-4.6")
        async for msg in run:
            if msg.summary:
                role_color = "cyan" if msg.role == "assistant" else "dim"
                console.print(f"  [{role_color}][{msg.role}][/{role_color}] {msg.summary}")

        result = run.result
        if result and result.output:
            console.print(f"\n[bold green]Done:[/bold green] {result.output}")
        else:
            console.print("\n[bold green]Done.[/bold green]")

    finally:
        await client.sessions.stop(session.id)
        console.print("[dim]Session closed.[/dim]")


def main():
    parser = argparse.ArgumentParser(description="Supply chain supplier agent")
    parser.add_argument("--company", help="Supplier name as it appears on the dashboard")
    parser.add_argument("--note", help="Context paragraph about the supplier")
    args = parser.parse_args()

    company, note = get_inputs(args)

    console.print(
        Panel(
            f"[bold]{company}[/bold]\n\n[dim]{note[:200]}{'...' if len(note) > 200 else ''}[/dim]",
            title="Supply Chain Agent",
            border_style="blue",
        )
    )

    asyncio.run(run_supply(company, note))


if __name__ == "__main__":
    main()
