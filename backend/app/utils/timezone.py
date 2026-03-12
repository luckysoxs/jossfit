"""Timezone-aware date/time utilities.

All users are in Mexico, so we use America/Mexico_City as the default.
This ensures date.today() matches what the user sees on their phone.
"""

from datetime import date, datetime

try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo

MX_TZ = ZoneInfo("America/Mexico_City")


def today_mx() -> date:
    """Return today's date in Mexico City timezone."""
    return datetime.now(MX_TZ).date()


def now_mx() -> datetime:
    """Return current datetime in Mexico City timezone."""
    return datetime.now(MX_TZ)
