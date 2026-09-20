"""
AI Study Recovery Coach - Local Dev Server
Emulates Amazon API Gateway HTTP API v2 and routes requests to lambda_handler.
Zero external server dependencies required (uses Python standard library).
"""

import sys
import os
import json
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

import importlib.util
app_path = os.path.join(os.path.dirname(__file__), "lambda", "app.py")
spec = importlib.util.spec_from_file_location("lambda_app", app_path)
lambda_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lambda_module)
lambda_handler = lambda_module.lambda_handler

PORT = int(os.environ.get("PORT", 8000))

class APIGatewaySimulatorHandler(BaseHTTPRequestHandler):
    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        self._handle_request("GET")

    def do_POST(self):
        self._handle_request("POST")

    def do_PATCH(self):
        self._handle_request("PATCH")

    def _handle_request(self, method: str):
        parsed = urlparse(self.path)
        path = parsed.path
        query_params = {k: v[0] for k, v in parse_qs(parsed.query).items()}

        body_data = ""
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length > 0:
            body_data = self.rfile.read(content_length).decode("utf-8")

        # Construct API Gateway HTTP API v2 Event
        event = {
            "version": "2.0",
            "routeKey": f"{method} {path}",
            "rawPath": path,
            "rawQueryString": parsed.query,
            "headers": dict(self.headers),
            "queryStringParameters": query_params,
            "requestContext": {
                "http": {
                    "method": method,
                    "path": path,
                    "protocol": "HTTP/1.1",
                    "sourceIp": self.client_address[0]
                }
            },
            "body": body_data,
            "isBase64Encoded": False
        }

        response = lambda_handler(event, None)

        status_code = response.get("statusCode", 200)
        self.send_response(status_code)
        for h_key, h_val in response.get("headers", {}).items():
            self.send_header(h_key, h_val)
        self._send_cors_headers()
        self.end_headers()

        body_output = response.get("body", "")
        if isinstance(body_output, str):
            self.wfile.write(body_output.encode("utf-8"))
        else:
            self.wfile.write(json.dumps(body_output).encode("utf-8"))

def run_server():
    server_address = ("127.0.0.1", PORT)
    httpd = HTTPServer(server_address, APIGatewaySimulatorHandler)
    print(f">> Replan AI - API Gateway Simulator running on http://127.0.0.1:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        httpd.server_close()

if __name__ == "__main__":
    run_server()
