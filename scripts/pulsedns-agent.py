#!/usr/bin/env python3
"""
PulseDNS Reference Agent - Lightweight Python 3 Client
Zero third-party dependencies (uses standard library urllib).
Reports current public IP to your self-hosted PulseDNS Dashboard.
"""
import os
import sys
import json
import urllib.request
import urllib.error

PULSEDNS_URL = os.environ.get("PULSEDNS_URL", "http://localhost:3000").rstrip("/")
AGENT_TOKEN = os.environ.get("AGENT_TOKEN", "")
CHECK_IPV6 = os.environ.get("CHECK_IPV6", "false").lower() in ("true", "1", "yes")

IPV4_SERVICES = [
    "https://api.ipify.org",
    "https://icanhazip.com",
    "https://ifconfig.me/ip",
]

IPV6_SERVICES = [
    "https://api6.ipify.org",
    "https://ipv6.icanhazip.com",
]


def detect_ip(services):
    for url in services:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "PulseDNS-Agent/1.0"})
            with urllib.request.urlopen(req, timeout=5) as res:
                return res.read().decode("utf-8").strip()
        except Exception:
            continue
    return None


def main():
    if not AGENT_TOKEN:
        print("Error: AGENT_TOKEN environment variable is required.", file=sys.stderr)
        print("Usage: AGENT_TOKEN='pulse_xxx' PULSEDNS_URL='https://ddns.example.com' python3 pulsedns-agent.py", file=sys.stderr)
        sys.exit(1)

    services = IPV6_SERVICES if CHECK_IPV6 else IPV4_SERVICES
    print(f"[PulseDNS Agent] Detecting public {'IPv6' if CHECK_IPV6 else 'IPv4'}...")
    ip = detect_ip(services)

    payload = {}
    if ip:
        print(f"[PulseDNS Agent] Detected IP: {ip}")
        payload["ip"] = ip
    else:
        print("[PulseDNS Agent] Could not reach public IP mirrors. Falling back to server-side socket detection.")

    target_url = f"{PULSEDNS_URL}/api/agent/update"
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        target_url,
        data=data,
        headers={
            "Authorization": f"Bearer {AGENT_TOKEN}",
            "Content-Type": "application/json",
            "User-Agent": "PulseDNS-Agent/1.0",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            response_data = json.loads(res.read().decode("utf-8"))
            print(f"[PulseDNS Agent] Success! Server response: {json.dumps(response_data, indent=2)}")
            sys.exit(0)
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        print(f"[PulseDNS Agent] HTTP Error {e.code}: {error_body}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"[PulseDNS Agent] Connection error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
