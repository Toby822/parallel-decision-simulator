"""Exercise HTTP handlers without starting a preview or listening server."""
import io
import json
import unittest
from unittest.mock import Mock

from parallel.engine import default_scenario
from parallel.server import Handler


def handler(path,body=b''):
    h=Handler.__new__(Handler)
    h.path=path
    h.headers={'Content-Length':str(len(body))}
    h.rfile=io.BytesIO(body)
    h.reply=Mock()
    h.send_error=Mock()
    return h


class APIHandlers(unittest.TestCase):
    def test_valid_run_uses_python_engine(self):
        s=default_scenario();s.update(paths=100,months=1)
        h=handler('/api/simulate',json.dumps(s).encode());h.do_POST()
        status,result=h.reply.call_args.args
        self.assertEqual(status,200)
        self.assertEqual(result['scenario'],s)
        self.assertEqual(len(result['terminal']['b']),100)

    def test_bad_json_is_400(self):
        h=handler('/api/simulate',b'{not json');h.do_POST()
        self.assertEqual(h.reply.call_args.args[0],400)

    def test_excessive_world_count_is_rejected(self):
        s=default_scenario();s['paths']=100000000
        h=handler('/api/simulate',json.dumps(s).encode());h.do_POST()
        self.assertEqual(h.reply.call_args.args[0],400)

    def test_oversized_body_is_rejected(self):
        h=handler('/api/simulate');h.headers['Content-Length']='99999';h.do_POST()
        self.assertEqual(h.reply.call_args.args[0],413)

    def test_path_traversal_is_rejected(self):
        h=handler('/../../etc/passwd');h.do_GET();h.send_error.assert_called_once_with(404)

    def test_health_identifies_the_real_runtime(self):
        h=handler('/api/health');h.do_GET()
        self.assertEqual(h.reply.call_args.args[1]['engine'],'Python / NumPy')
