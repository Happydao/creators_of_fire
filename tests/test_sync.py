import importlib.util
import unittest
from unittest.mock import patch
from pathlib import Path
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

    def test_foreign_channel_feed_rejected(self):
        with patch.object(sync, 'request', return_value=b'<feed/>'):
            with self.assertRaises(ValueError):
                sync.rss_catalog([])

if __name__ == '__main__':
    unittest.main()
