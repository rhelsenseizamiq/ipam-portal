import asyncio
import ipaddress
import logging
import socket
import time
from enum import Enum
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field, field_validator

from app.dependencies.auth import require_role
from app.models.ip_record import OSType
from app.models.user import UserInToken

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/scan", tags=["scan"])

_OPERATOR_PLUS = require_role("Operator", "Administrator")


# ── Scan profiles ─────────────────────────────────────────────────────────────

class ScanMode(str, Enum):
    QUICK = "quick"
    STANDARD = "standard"
    DEEP = "deep"


_PROFILES: dict[ScanMode, dict] = {
    ScanMode.QUICK: {
        "ports": [22, 80, 443, 3389],
        "port_timeout": 0.2,
        "concurrency": 150,
        "os_detect": False,
        "hostname": False,
        "max_hosts": 4094,   # up to /20
    },
    ScanMode.STANDARD: {
        "ports": [22, 23, 25, 53, 80, 110, 135, 139, 143, 443, 445, 3389, 8080, 8443],
        "port_timeout": 0.5,
        "concurrency": 50,
        "os_detect": True,
        "hostname": True,
        "max_hosts": 1022,   # up to /22
    },
    ScanMode.DEEP: {
        "ports": [
            21, 22, 23, 25, 53, 80, 110, 111, 135, 139, 143,
            389, 443, 445, 512, 513, 514, 548, 587, 631, 993, 995,
            1433, 1521, 3306, 3389, 5432, 5900, 6379, 6443,
            8080, 8443, 8888, 9090, 9200, 27017,
        ],
        "port_timeout": 1.0,
        "concurrency": 25,
        "os_detect": True,
        "hostname": True,
        "max_hosts": 254,    # /24 only
    },
}


# ── Request / response models ──────────────────────────────────────────────────

class ScanRequest(BaseModel):
    cidr: str = Field(..., description="Network CIDR to scan")
    mode: ScanMode = ScanMode.STANDARD

    @field_validator("cidr")
    @classmethod
    def validate_cidr(cls, v: str) -> str:
        try:
            ipaddress.ip_network(v, strict=False)
        except ValueError as exc:
            raise ValueError(f"Invalid CIDR: {v}") from exc
        return v

    def validate_size(self) -> None:
        """Call after mode is known to enforce per-profile host limit."""
        network = ipaddress.ip_network(self.cidr, strict=False)
        hosts = network.num_addresses - 2
        max_hosts = _PROFILES[self.mode]["max_hosts"]
        if hosts > max_hosts:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"{self.mode.value.capitalize()} scan supports at most "
                    f"{max_hosts} hosts. Your CIDR has {hosts}. "
                    f"Use a smaller range or switch to Quick scan."
                ),
            )


class DiscoveredHost(BaseModel):
    ip_address: str
    hostname: Optional[str] = None
    os_hint: Optional[str] = None
    open_ports: list[int] = []


class ScanResult(BaseModel):
    cidr: str
    mode: str
    total_scanned: int
    discovered: list[DiscoveredHost]
    duration_seconds: float


# ── Core scan helpers ──────────────────────────────────────────────────────────

async def _check_port(ip: str, port: int, timeout: float) -> bool:
    try:
        _, writer = await asyncio.wait_for(
            asyncio.open_connection(ip, port),
            timeout=timeout,
        )
        writer.close()
        try:
            await writer.wait_closed()
        except Exception:
            pass
        return True
    except Exception:
        return False


def _reverse_dns(ip: str) -> Optional[str]:
    try:
        hostname, _, _ = socket.gethostbyaddr(ip)
        return hostname if hostname != ip else None
    except (socket.herror, socket.gaierror, OSError):
        return None


def _os_from_open_ports(open_ports: set[int]) -> Optional[str]:
    """Determine OS hint from the set of responding ports."""
    if 6443 in open_ports or (8443 in open_ports and 9090 in open_ports):
        return OSType.OPENSHIFT.value
    if 3389 in open_ports or (135 in open_ports and 445 in open_ports):
        return OSType.WINDOWS.value
    if 1433 in open_ports:
        return OSType.WINDOWS.value   # MSSQL → Windows
    if 548 in open_ports:
        return OSType.MACOS.value     # AFP → macOS
    if 22 in open_ports or 512 in open_ports or 513 in open_ports or 514 in open_ports:
        return OSType.LINUX.value
    return None


async def _scan_host(
    ip: str,
    sem: asyncio.Semaphore,
    ports: list[int],
    port_timeout: float,
    do_os: bool,
    do_hostname: bool,
) -> Optional[DiscoveredHost]:
    async with sem:
        # Check all ports concurrently
        results = await asyncio.gather(*[_check_port(ip, p, port_timeout) for p in ports])
        open_ports = {p for p, up in zip(ports, results) if up}

        if not open_ports:
            return None

        hostname: Optional[str] = None
        os_hint: Optional[str] = None

        tasks = []
        if do_hostname:
            loop = asyncio.get_running_loop()
            tasks.append(loop.run_in_executor(None, _reverse_dns, ip))
        if do_os:
            os_hint = _os_from_open_ports(open_ports)

        if tasks:
            resolved = await asyncio.gather(*tasks)
            if do_hostname:
                hostname = resolved[0]

        return DiscoveredHost(
            ip_address=ip,
            hostname=hostname,
            os_hint=os_hint,
            open_ports=sorted(open_ports),
        )


# ── Endpoint ───────────────────────────────────────────────────────────────────

@router.post("", response_model=ScanResult)
async def scan_network(
    request: Request,
    body: ScanRequest,
    current_user: UserInToken = Depends(_OPERATOR_PLUS),
) -> ScanResult:
    body.validate_size()

    profile = _PROFILES[body.mode]
    network = ipaddress.ip_network(body.cidr, strict=False)
    hosts = [str(ip) for ip in network.hosts()]

    if not hosts:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Network has no scannable hosts",
        )

    logger.info(
        "Scan [%s] of %s started by %s (%d hosts)",
        body.mode.value, body.cidr, current_user.sub, len(hosts),
    )
    start = time.monotonic()
    sem = asyncio.Semaphore(profile["concurrency"])

    tasks = [
        _scan_host(
            ip, sem,
            ports=profile["ports"],
            port_timeout=profile["port_timeout"],
            do_os=profile["os_detect"],
            do_hostname=profile["hostname"],
        )
        for ip in hosts
    ]
    results = await asyncio.gather(*tasks)
    discovered = [r for r in results if r is not None]
    duration = round(time.monotonic() - start, 1)

    logger.info(
        "Scan [%s] of %s by %s: %d/%d found in %.1fs",
        body.mode.value, body.cidr, current_user.sub,
        len(discovered), len(hosts), duration,
    )
    return ScanResult(
        cidr=body.cidr,
        mode=body.mode.value,
        total_scanned=len(hosts),
        discovered=discovered,
        duration_seconds=duration,
    )
