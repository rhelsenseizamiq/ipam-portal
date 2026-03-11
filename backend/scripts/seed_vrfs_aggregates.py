#!/usr/bin/env python3
"""
Seed script: Insert test VRFs, RIRs, and Aggregates.

Run from the backend directory:
    cd backend && python -m scripts.seed_vrfs_aggregates

Idempotent: skips records that already exist (matched by name/slug/prefix).
"""
import asyncio
import ipaddress
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import close_mongo_connection, connect_to_mongo, get_database

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)

NOW = datetime.now(timezone.utc)

RIRS = [
    {
        "name": "ARIN",
        "slug": "arin",
        "description": "American Registry for Internet Numbers",
        "is_private": False,
    },
    {
        "name": "RIPE NCC",
        "slug": "ripe-ncc",
        "description": "Réseaux IP Européens Network Coordination Centre",
        "is_private": False,
    },
    {
        "name": "APNIC",
        "slug": "apnic",
        "description": "Asia-Pacific Network Information Centre",
        "is_private": False,
    },
    {
        "name": "RFC1918 Private",
        "slug": "rfc1918",
        "description": "Private address space per RFC 1918",
        "is_private": True,
    },
    {
        "name": "RFC6598 CGNAT",
        "slug": "rfc6598",
        "description": "Shared address space for CGNAT (100.64.0.0/10)",
        "is_private": True,
    },
]

VRFS = [
    {
        "name": "Global",
        "rd": None,
        "description": "Default global routing table",
        "enforce_unique": True,
    },
    {
        "name": "PROD-VRF",
        "rd": "65000:100",
        "description": "Production network VRF",
        "enforce_unique": True,
    },
    {
        "name": "DEV-VRF",
        "rd": "65000:200",
        "description": "Development and staging VRF",
        "enforce_unique": True,
    },
    {
        "name": "MGMT-VRF",
        "rd": "65000:300",
        "description": "Out-of-band management VRF",
        "enforce_unique": True,
    },
    {
        "name": "DMZ-VRF",
        "rd": "65000:400",
        "description": "Demilitarized zone VRF for public-facing services",
        "enforce_unique": False,
    },
]

# (prefix, rir_slug, description, date_added)
AGGREGATES = [
    # RFC 1918 private ranges
    ("10.0.0.0/8",      "rfc1918", "Class A private range (RFC 1918)",          "2010-01-01"),
    ("172.16.0.0/12",   "rfc1918", "Class B private range (RFC 1918)",          "2010-01-01"),
    ("192.168.0.0/16",  "rfc1918", "Class C private range (RFC 1918)",          "2010-01-01"),
    # CGNAT
    ("100.64.0.0/10",   "rfc6598", "Shared address space for CGNAT (RFC 6598)", "2012-04-01"),
    # Public blocks (illustrative — not actual allocations)
    ("8.0.0.0/8",       "arin",    "ARIN — illustrative /8 block",             "2000-06-15"),
    ("44.0.0.0/8",      "arin",    "ARIN — amateur radio / AWS range",         "1992-03-01"),
    ("185.0.0.0/8",     "ripe-ncc","RIPE NCC — European allocation block",     "2013-07-01"),
    ("2.0.0.0/8",       "ripe-ncc","RIPE NCC — public allocation",             "2011-01-01"),
    ("1.0.0.0/8",       "apnic",   "APNIC — Asia-Pacific allocation",          "2011-01-13"),
    ("27.0.0.0/8",      "apnic",   "APNIC — Asia-Pacific allocation",          "2010-01-01"),
]


async def seed_rirs(col) -> dict[str, str]:
    """Insert RIRs, return slug→_id mapping."""
    rir_ids: dict[str, str] = {}
    for rir in RIRS:
        existing = await col.find_one({"slug": rir["slug"]})
        if existing:
            logger.info("RIR already exists: %s (skipped)", rir["slug"])
            rir_ids[rir["slug"]] = str(existing["_id"])
            continue
        doc = {
            **rir,
            "created_at": NOW,
            "updated_at": NOW,
            "created_by": "seed",
            "updated_by": "seed",
        }
        result = await col.insert_one(doc)
        rir_ids[rir["slug"]] = str(result.inserted_id)
        logger.info("Inserted RIR: %s → %s", rir["slug"], result.inserted_id)
    return rir_ids


async def seed_vrfs(col) -> None:
    for vrf in VRFS:
        existing = await col.find_one({"name": vrf["name"]})
        if existing:
            logger.info("VRF already exists: %s (skipped)", vrf["name"])
            continue
        doc = {
            **vrf,
            "created_at": NOW,
            "updated_at": NOW,
            "created_by": "seed",
            "updated_by": "seed",
        }
        result = await col.insert_one(doc)
        logger.info("Inserted VRF: %s → %s", vrf["name"], result.inserted_id)


async def seed_aggregates(col, rir_ids: dict[str, str]) -> None:
    for prefix, rir_slug, description, date_added in AGGREGATES:
        existing = await col.find_one({"prefix": prefix})
        if existing:
            logger.info("Aggregate already exists: %s (skipped)", prefix)
            continue
        rir_id = rir_ids.get(rir_slug)
        if not rir_id:
            logger.warning("Unknown RIR slug '%s' for prefix %s — skipping", rir_slug, prefix)
            continue
        prefix_len = ipaddress.ip_network(prefix, strict=False).prefixlen
        doc = {
            "prefix": prefix,
            "prefix_len": prefix_len,
            "rir_id": rir_id,
            "description": description,
            "date_added": date_added,
            "created_at": NOW,
            "updated_at": NOW,
            "created_by": "seed",
            "updated_by": "seed",
        }
        result = await col.insert_one(doc)
        logger.info("Inserted Aggregate: %s → %s", prefix, result.inserted_id)


async def main() -> None:
    await connect_to_mongo()
    db = get_database()

    logger.info("=== Seeding RIRs ===")
    rir_ids = await seed_rirs(db["rirs"])

    logger.info("=== Seeding VRFs ===")
    await seed_vrfs(db["vrfs"])

    logger.info("=== Seeding Aggregates ===")
    await seed_aggregates(db["aggregates"], rir_ids)

    logger.info("=== Seed complete ===")
    await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(main())
