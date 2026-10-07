#!/usr/bin/env python3
"""Refresh a static catalog using official YouTube Data API or Atom + oEmbed.
No frontend credentials, media downloads, or undocumented YouTube endpoints.
"""
import concurrent.futures
import datetime as dt
import json
import os
from pathlib import Path
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
CHANNEL = 'UCebUIqV2bAL9L2e_apvQSFw'
UPLOADS = 'UUebUIqV2bAL9L2e_apvQSFw'
NS = {'a': 'http://www.w3.org/2005/Atom', 'yt': 'http://www.youtube.com/xml/schemas/2015'}
NOW = dt.datetime.now(dt.timezone.utc)
STAMP = NOW.isoformat()

def request(url):
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'CreatorsOfFire-CatalogSync/1.0'})
            with urllib.request.urlopen(req, timeout=30) as response:
                return response.read()
        except urllib.error.HTTPError as error:
            if error.code not in (429, 500, 502, 503, 504) or attempt == 2:
                raise
        except (urllib.error.URLError, TimeoutError):
            if attempt == 2:
                raise
        time.sleep(2 ** attempt)

def track(video_id, title, **extra):
    if not re.fullmatch(r'[\w-]{11}', video_id) or not title.strip():
        raise ValueError('Invalid YouTube metadata; refusing catalog update')
    return {'id': video_id, 'title': title, 'thumbnail': f'https://i.ytimg.com/vi/{video_id}/hqdefault.jpg',
            'url': f'https://www.youtube.com/watch?v={video_id}', **extra}

def duration_seconds(value):
    match = re.fullmatch(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', value)
    if not match:
        return 0
    h, m, s = (int(part or 0) for part in match.groups())
    return h * 3600 + m * 60 + s

def api_catalog(key):
    def api(resource, **params):
        params['key'] = key
        # Do not print request URLs: they contain the secret.
        return json.loads(request('https://www.googleapis.com/youtube/v3/' + resource + '?' + urllib.parse.urlencode(params)))
    ids, token = [], None
    while True:
        params = dict(part='contentDetails', playlistId=UPLOADS, maxResults=50)
        if token:
            params['pageToken'] = token
        page = api('playlistItems', **params)
        ids.extend(item['contentDetails']['videoId'] for item in page.get('items', []))
        token = page.get('nextPageToken')
        if not token:
            break
    videos = {}
    for start in range(0, len(ids), 50):
        result = api('videos', part='snippet,contentDetails,status', id=','.join(ids[start:start + 50]))
        for video in result.get('items', []):
            snippet, status = video['snippet'], video['status']
            if snippet['channelId'] != CHANNEL or status.get('privacyStatus') != 'public':
                continue
            videos[video['id']] = track(video['id'], snippet['title'], duration=duration_seconds(video['contentDetails']['duration']),
                                       publishedAt=snippet['publishedAt'], verifiedAt=STAMP, embeddable=status.get('embeddable', True))
    return [videos[i] for i in dict.fromkeys(ids) if i in videos]

def rss_catalog(existing):
    root = ET.fromstring(request(f'https://www.youtube.com/feeds/videos.xml?channel_id={CHANNEL}'))
    if root.findtext('yt:channelId', namespaces=NS) not in (CHANNEL, CHANNEL[2:]):
        raise ValueError('Feed does not belong to the configured artist')
    old = {item['id']: item for item in existing}
    fresh = []
    for entry in root.findall('a:entry', NS):
        video_id = entry.findtext('yt:videoId', namespaces=NS)
        title = entry.findtext('a:title', namespaces=NS)
        item = track(video_id, title, publishedAt=entry.findtext('a:published', namespaces=NS), verifiedAt=STAMP)
        # Preserve durations obtained from the bootstrap/API; RSS does not supply duration.
        if video_id in old and 'duration' in old[video_id]:
            item['duration'] = old[video_id]['duration']
        fresh.append(item)
    if not fresh:
        raise ValueError('Feed returned no uploads; preserving existing catalog')
    fresh_ids = {t['id'] for t in fresh}
    remaining = [t for t in existing if t['id'] not in fresh_ids]
    def verify(item):
        last = item.get('verifiedAt')
        if last and NOW - dt.datetime.fromisoformat(last.replace('Z', '+00:00')) < dt.timedelta(days=25):
            return item
        url = 'https://www.youtube.com/oembed?' + urllib.parse.urlencode({'url': item['url'], 'format': 'json'})
        try:
            result = json.loads(request(url))
        except urllib.error.HTTPError as error:
            if error.code in (400, 401, 403, 404, 410):
                print('Removing unavailable metadata for video', item['id'])
                return None
            raise
        if result.get('author_url', '').rstrip('/') not in (f'https://www.youtube.com/channel/{CHANNEL}', 'https://www.youtube.com/@AISoundCF'):
            raise ValueError('Unexpected artist returned by oEmbed')
        return {**item, 'title': result['title'], 'verifiedAt': STAMP}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        refreshed = list(pool.map(verify, remaining))
    return fresh + [t for t in refreshed if t]

def main():
    path = ROOT / 'data/catalog.json'
    existing = json.loads(path.read_text())
    key = os.environ.get('YOUTUBE_API_KEY')
    result = api_catalog(key) if key else rss_catalog(existing['tracks'])
    if not result or len({t['id'] for t in result}) != len(result):
        raise ValueError('Empty or duplicate catalog; refusing to overwrite')
    document = {'channelId': CHANNEL, 'updatedAt': STAMP, 'source': 'YouTube Data API v3' if key else 'YouTube Atom feed + oEmbed verification', 'tracks': result}
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(document, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(path)
    print(f'Synchronized {len(result)} tracks via {document["source"]}.')

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # urllib exceptions can include URLs containing API keys. Never print them.
        print(f'Catalog synchronization failed ({type(error).__name__}). Existing catalog preserved. Check feed availability or API secret/quota.', file=sys.stderr)
        sys.exit(1)
