# Antigravity Claude Proxy

> **The Universal AI Gateway for Claude Code CLI**
> Connect *any* LLM — Antigravity, Gemini, Local Agents (LM Studio/Ollama), or OpenAI — directly to your Claude Code terminal.

## 🚀 Why Antigravity Claude Proxy?

Claude Code CLI is powerful, but it's locked to Anthropic's API. **Antigravity Claude Proxy** breaks these chains.

It acts as a **smart proxy** that sits between your terminal and the AI world, providing:

*   **⚡ Antigravity Integration**: Use your unlimited Antigravity credits instead of paying per-token API fees.
*   **🤖 Local Agent Support**: Run `gemma-2b`, `llama-3`, or `mistral` locally via LM Studio/Ollama and use them in Claude CLI.
*   **💎 Gemini & External APIs**: seamlessly bridge Google's Gemini models using the same interface.
*   **🔌 Universal Translation Layer**: Automatically converts Anthropic's strict protocol to OpenAI (for local agents) or Google REST formats on the fly.
*   **🖥️ Dashboard & Session Manager**: Manage multiple terminal sessions, monitor real-time traffic, and track usage from a beautiful UI.

---

## 🛠️ Installation & Quick Start

### 1. Prerequisites
*   Node.js v18+
*   Claude Code CLI (`npm install -g @anthropic-ai/claude-code`)
*   *(Optional)* LM Studio or Ollama for local agents

### 2. Setup (2 Minutes)

```bash
# Clone the repository
git clone https://github.com/midnightnow/antigravity-claude-proxy.git
cd antigravity-claude-proxy

# Install dependencies
npm install

# Start the proxy server
npm start
```

The server will start on **http://localhost:8080**

### 3. Configure Accounts

**Option A: Use Antigravity (Recommended)**
The proxy will automatically extract credentials from your Antigravity installation if you have a chat panel open.

**Option B: Add Google OAuth Accounts**
```bash
npm run accounts
```
Follow the interactive prompts to add Google accounts with Gemini Code Assist access.

### 4. Connect Claude CLI

Set environment variables to point Claude CLI to the proxy:

```bash
export ANTHROPIC_BASE_URL=http://localhost:8080
export ANTHROPIC_API_KEY=dummy

# Launch Claude CLI
claude
```

You're now connected! 🎉

### 5. Optional: Web Dashboard

Open **http://localhost:8080** in your browser to:
- Monitor real-time API traffic
- View session statistics
- Launch new terminal sessions
- Manage account quotas

---

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `8080` |
| `DEBUG` | Enable debug logging | `false` |
| `FALLBACK` | Enable model fallback on quota exhaustion | `false` |
| `LOCAL_LLM_URL` | Local OpenAI-compatible endpoint | `http://localhost:1234/v1/chat/completions` |
| `LOCAL_LLM_KEY` | API key for local endpoint | *(none)* |

### Model Mapping

Edit `~/.config/antigravity-proxy/config.json` to map model names:

```json
{
  "modelMapping": {
    "claude-3-5-sonnet-20241022": { "mapping": "claude-sonnet-4-5-thinking" },
    "claude-haiku-3-5-20241022": { "mapping": "gemini-pro" }
  }
}
```

---

## 🎮 Using Different Models

### 💎 Antigravity (Default)
Use your Antigravity credits for premium models. The Gateway automatically maps CLI models to your plan:
*   `claude-3-5-sonnet` → Use normally
*   `claude-3-5-opus` → Use normally

### 🤖 Local Agents (LM Studio / Ollama)
Run models on your own machine for free.

1.  Start your local server (e.g., LM Studio on port `1234`).
2.  In Claude CLI, switch models:
    ```bash
    /model local-gemma
    ```
    *(Any model starting with `local-` routes to your local server)*

### 🌌 Gemini
Using a local bridge or compatible endpoint:
    ```bash
    /model gemini-pro
    ```

---

## ⛩️ Architecture: The Universal Translation Layer

Antigravity Claude Proxy implements a robust transcoding pipeline:

1.  **Intercept**: The proxy receives the strict Anthropic Messages API request from Claude CLI.
2.  **Route**: Based on the model prefix (`local-`, `gemma-`), it routes to Local Agents; everything else (Claude, Gemini) goes to Antigravity.
3.  **Transcode**: 
    *   **Anthropic -> OpenAI**: For local agents (messages structure conversion).
    *   **Anthropic -> Google**: For Gemini (via Antigravity Cloud Code client).
4.  **Forward**: Sends the payload to the destination (Antigravity Cloud or Localhost).
5.  **Stream**: Converts the response stream back to Anthropic's SSE format in real-time.

---

## ✨ Features

### 🎯 Core Capabilities
- **Multi-Account Support**: Rotate between multiple Google accounts for higher quotas
- **Automatic Failover**: Seamlessly switch accounts when rate limits are hit
- **Model Fallback**: Automatically fall back to alternative models on quota exhaustion
- **Tool Usage**: Full support for function calling with local and cloud models
- **Thinking Models**: Support for Claude and Gemini thinking/reasoning models
- **Streaming**: Real-time SSE streaming for all model types

### 📊 Dashboard Features
- **Live Traffic Monitor**: Watch requests and responses flow in real-time via WebSocket
- **Session Management**: View, rename, and kill active CLI sessions
- **Account Quotas**: Track usage and remaining capacity per model
- **One-Click Launcher**: Auto-generates the correct environment variables for your OS
- **Usage Statistics**: Historical tracking of API calls and token consumption

### 🔌 Supported Backends
- **Antigravity Cloud Code**: Claude and Gemini models via Google's API
- **Local Agents**: LM Studio, Ollama, or any OpenAI-compatible endpoint
- **Direct Gemini**: Google Gemini models with thinking support

---

## 🐛 Troubleshooting

### "Requested entity was not found" (404)
**Cause**: Your Google account doesn't have Gemini Code Assist enabled.

**Solution**: 
1. Ensure you have access to Google Cloud Code Assist
2. Try running `npm run accounts:verify` to check account status
3. Add a different Google account with proper access

### "Authentication failed"
**Cause**: OAuth tokens expired or Antigravity not running.

**Solution**:
```bash
# Refresh OAuth tokens
npm run accounts

# Or restart Antigravity and ensure a chat panel is open
```

### Local models not working
**Cause**: Local LLM server not accessible.

**Solution**:
1. Verify your local server is running (e.g., LM Studio on port 1234)
2. Set the correct endpoint:
   ```bash
   export LOCAL_LLM_URL=http://localhost:1234/v1/chat/completions
   ```
3. Use `local-` prefix: `/model local-llama-3`

### Server won't start
**Cause**: Port 8080 already in use.

**Solution**:
```bash
# Use a different port
PORT=3000 npm start

# Or kill the process using port 8080
lsof -ti:8080 | xargs kill -9
```

---

## 🤝 Contributing

We welcome contributions! Whether it's adding new transcoders (e.g., for Mistral API, Cohere) or improving the dashboard.

1.  Fork the repo
2.  Create your feature branch (`git checkout -b feature/amazing-transcoder`)
3.  Commit your changes
4.  Push to the branch
5.  Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Built on top of [Antigravity](https://cloud.google.com/code-assist) Cloud Code API
- Inspired by the [Claude CLI](https://github.com/anthropics/anthropic-sdk-typescript) ecosystem
- Thanks to the open-source community for LM Studio, Ollama, and other local LLM tools

---

**Questions or Issues?** Open an issue on [GitHub](https://github.com/midnightnow/antigravity-claude-proxy/issues)

*Built with ❤️ for the AI development community*
