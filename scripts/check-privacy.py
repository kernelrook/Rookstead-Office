"""Heuristic public-source scan. Reports filenames only, never matching values."""
import ipaddress
import pathlib
import re
import subprocess
import sys

root = pathlib.Path(__file__).resolve().parents[1]
names = subprocess.check_output(['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z'], cwd=root).decode().split('\0')
patterns = [
    r'-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----',
    r'(?i)(?:api[_-]?key|access[_-]?token|client[_-]?secret)\s*[:=]\s*[\x22\x27][A-Za-z0-9_/-]{20,}',
    r'\b(?:ghp_|github_pat_|sk_live_)[A-Za-z0-9_]{16,}',
    r'https?://[^\s/]+\.(?:local|lan|internal|lab)(?:[:/\s]|$)',
    r'/(?:home|root|Users)/[A-Za-z0-9._-]+/',
    r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b',
]
issues = []
for name in sorted(set(filter(None, names))):
    p = root / name
    if not p.is_file() or name == 'bun.lock':
        continue
    try:
        text = p.read_text()
    except (UnicodeDecodeError, OSError):
        issues.append(name)
        continue
    found = any(re.search(pattern, text) for pattern in patterns)
    for candidate in re.findall(r'(?<![\w.])(?:\d{1,3}\.){3}\d{1,3}(?![\w.])', text):
        try:
            ip = ipaddress.ip_address(candidate)
            if not ip.is_global and not ip.is_loopback and not ip.is_unspecified:
                found = True
        except ValueError:
            pass
    if found:
        issues.append(name)
print(f'Privacy scan: {len(issues)} flagged files')
for name in issues:
    print(name)
sys.exit(bool(issues))
