import importlib.util
import json
import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path
from urllib.error import HTTPError
spec = importlib.util.spec_from_file_location('sync', Path(__file__).parents[1] / 'scripts/sync_catalog.py')
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)

class SyncTests(unittest.TestCase):
    def test_duration(self):
        self.assertEqual(sync.duration_seconds('PT1H2M3S'), 3723)
        self.assertEqual(sync.duration_seconds('PT52S'), 52)

    def test_malformed_id_rejected(self):
        with self.assertRaises(ValueError):
            sync.track('bad', 'Track')

    def test_feed_merges_without_losing_history(self):
        feed = f'''<feed xmlns="http://www.w3.org/2005/Atom" xmlns:yt="http://www.youtube.com/xml/schemas/2015"><yt:channelId>{sync.CHANNEL[2:]}</yt:channelId><entry><yt:videoId>abcdefghijk</yt:videoId><title>New title</title><published>2026-10-07T00:00:00Z</published></entry></feed>'''.encode()
        older = sync.track('12345678901', 'Older', verifiedAt=sync.STAMP)
        previous = sync.track('abcdefghijk', 'Old title', duration=123)
        with patch.object(sync, 'request', return_value=feed):
            result = sync.rss_catalog([previous, older])
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]['title'], 'New title')
        self.assertEqual(result[0]['duration'], 123)
        self.assertEqual(result[1]['id'], older['id'])

    def test_unchanged_feed_preserves_verification_time(self):
        old = sync.track('abcdefghijk', 'Same title', publishedAt='2026-10-07T00:00:00Z',
                         verifiedAt='2026-10-08T00:00:00Z', duration=123)
        feed = f'''<feed xmlns="http://www.w3.org/2005/Atom" xmlns:yt="http://www.youtube.com/xml/schemas/2015"><yt:channelId>{sync.CHANNEL}</yt:channelId><entry><yt:videoId>abcdefghijk</yt:videoId><title>Same title</title><published>2026-10-07T00:00:00Z</published></entry></feed>'''.encode()
        with patch.object(sync, 'request', return_value=feed) as fetch:
            self.assertEqual(sync.rss_catalog([old]), [old])
        self.assertTrue(fetch.call_args.kwargs['retry_missing'])

    def test_feed_404_is_retried_but_missing_video_is_not(self):
        missing = HTTPError('https://www.youtube.com/feeds/videos.xml', 404, 'missing', {}, None)
        response = unittest.mock.MagicMock()
        response.__enter__.return_value.read.return_value = b'<feed/>'
        with patch.object(sync.urllib.request, 'urlopen', side_effect=[missing, response]), patch.object(sync.time, 'sleep') as sleep:
            self.assertEqual(sync.request('https://www.youtube.com/feeds/videos.xml', retry_missing=True), b'<feed/>')
            sleep.assert_called_once()
        with patch.object(sync.urllib.request, 'urlopen', side_effect=missing) as fetch:
            with self.assertRaises(HTTPError):
                sync.request('https://www.youtube.com/oembed')
            self.assertEqual(fetch.call_count, 1)

    def test_unchanged_catalog_is_not_rewritten(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'data' / 'catalog.json'
            path.parent.mkdir()
            item = sync.track('abcdefghijk', 'Song', publishedAt='2026-10-07T00:00:00Z')
            original = {'updatedAt': '2026-10-08T00:00:00Z', 'tracks': [item]}
            path.write_text(json.dumps(original))
            with patch.object(sync, 'ROOT', Path(directory)), patch.dict(sync.os.environ, {'YOUTUBE_API_KEY': ''}), patch.object(sync, 'rss_catalog', return_value=[item]):
                sync.main()
            self.assertEqual(json.loads(path.read_text()), original)

    def test_foreign_channel_feed_rejected(self):
        with patch.object(sync, 'request', return_value=b'<feed/>'):
            with self.assertRaises(ValueError):
                sync.rss_catalog([])

if __name__ == '__main__':
    unittest.main()
