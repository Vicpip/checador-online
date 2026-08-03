"""
Haversine distance helper.

Stored for reference only — per CONTEXT_CHECADOR.md, `precision_m` and
distance are NEVER used to accept or reject a check-in. Nothing in the
routers calls this to gate check-in/out; it exists purely as a utility an
admin-facing report could use later (e.g. to show distance-from-site as
informational context), and to make that "informational only" intent
explicit and easy to find in the codebase.
"""
import math


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in meters between two lat/lng points."""
    r = 6_371_000  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))
