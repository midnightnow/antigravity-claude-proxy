# Bullrider Roadmap

## ✅ 1. Input API (Complete)
Implemented `POST /api/sessions/input` to send raw data. Allows bypassing CLI prompts:
```bash
curl -d '{ "id": "...", "data": "\r" }' ...
```

## 2. Automated Prompt Handling
Update `bullrider/main.go` to **automatically** detect:
- "Do you want to use this API key?" -> Send "2\r"
- "Select a model" -> Send default model ID
go func() {
    buf := make([]byte, 1024)
    for {
        n, err := pty.Read(buf)
        if err != nil { break }
        output := string(buf[:n])
        if strings.Contains(output, "Do you want to use this API key?") {
            pty.Write([]byte("1\n"))
        }
    }
}()
```

## 2. Session Attachment
Implement a WebSocket endpoint in Bullrider to allow the WebUI to "attach" to a running session, streaming stdin/stdout.

**Endpoints:**
- `GET /api/sessions/:id/attach` (WebSocket)

**Frontend:**
- Add `xterm.js` to the WebUI for full terminal emulation.

## 3. Persistent Configuration
Modify `launcher.js` to write `ANTHROPIC_API_KEY=dummy` directly to `~/.claude/config.json` (or project-local config) instead of using ENV vars, which might bypass the prompt.
