# Bullrider 🐂
> The Canonical Process Supervisor for Antigravity & MacAgent

Bullrider is a lightweight, Go-based process supervisor that manages Claude Code sessions in detached PTYs (Pseudo-Terminals). It acts as a sidecar service, allowing multiple applications (Claude Proxy, MacAgent, etc.) to spawn, monitor, and control persistent terminal sessions.

## 🚀 Quick Start

### 1. Build
```bash
go mod init bullrider
go mod tidy
go build -o bullrider-darwin-arm64 main.go
```

### 2. Run
```bash
./bullrider-darwin-arm64
# Starts on port 9000 by default
```

### 3. Spawn a Session
```bash
curl -X POST http://localhost:9000/api/sessions/spawn \
  -H "Content-Type: application/json" \
  -d '{
    "cwd": "/path/to/project",
    "model": "gemini-3.0-flash" 
  }'
```

## 🔌 API Reference

### `POST /api/sessions/spawn`
Spawns a new Claude Code session.
- **Body**:
  - `cwd` (string, optional): Working directory. Defaults to current.
  - `model` (string, optional): Model ID. Defaults to `claude-3-5-sonnet-20241022`.

### `GET /api/sessions`
List all active sessions.

### `DELETE /api/sessions/kill?id=<id>`
Terminate a session by ID.

### `POST /api/sessions/input`
Send raw input to a session's PTY (e.g., to bypass prompts).
- **Body**:
  - `id` (string): Session ID
  - `data` (string): Raw input (e.g., `"\r"` for Enter)

### `GET /health`
Health check endpoint. Returns "OK".

## ⚙️ Configuration
Set via environment variables:
- `BULLRIDER_PORT`: Port to listen on (default: `9000`)
- `BULLRIDER_PROXY_URL`: Upstream proxy URL (default: `http://localhost:8080`)
- `BULLRIDER_LOG_DIR`: Directory for session logs (default: `/tmp`)
