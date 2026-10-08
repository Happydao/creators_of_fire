#!/usr/bin/env python3
"""One-time historical publish-date backfill from public YouTube watch metadata.

The regular six-hour sync still uses Atom / the official Data API. This script
only fills legacy catalog rows that predate the feed's recent-upload window.
It reads HTML metadata, never video or audio, and verifies channel ownership.
"""
import concurrent.futures
import json
from pathlib import Path
import re
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
CATALOG = ROOT / 'data/catalog.json'
CHANNEL = 'UCebUIqV2bAL9L2e_apvQSFw'
DATE = re.compile(r'"publishDate":"(\d{4}-\d{2}-\d{2}T[^"\\]+)"')
OWNER = re.compile(r'"(?:externalChannelId|channelId)":"([\w-]+)"')


def published(track):
    request = urllib.request.Request(track['url'], headers={'User-Agent': 'Mozilla/5.0 (compatible; CreatorsOfFireMetadata/1.0)'})
    with urllib.request.urlopen(request, timeout=25) as response:
        page = response.read().decode('utf-8', errors='replace')
    if CHANNEL not in OWNER.findall(page):
        raise ValueError(f'Unexpected channel for {track["id"]}')
    match = DATE.search(page)
    if not match:
        raise ValueError(f'No public publish date for {track["id"]}')
    return track['id'], match.group(1)


def main():
    document = json.loads(CATALOG.read_text())
    missing = [track for track in document['tracks'] if not track.get('publishedAt')]
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        dates = dict(pool.map(published, missing))
    for track in document['tracks']:
        if track['id'] in dates:
            track['publishedAt'] = dates[track['id']]
    CATALOG.write_text(json.dumps(document, ensure_ascii=False, indent=2) + '\n')
    print(f'Backfilled {len(dates)} verified publication dates.')


if __name__ == '__main__':
    main()
