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

# Start the Gateway
npm start
```

### 3. Launch Your First Session

1.  Open **http://localhost:8080** in your browser.
2.  Click the **Launch** button (Run Terminal) in the top-right corner.
3.  A new terminal window will appear with the **Antigravity Banner**.
4.  You are now connected! 🎉

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

## 📊 Dashboard Features

*   **Live Traffic Monitor**: Watch requests and responses flow in real-time via WebSocket.
*   **Session Management**: View, rename, and kill active CLI sessions.
*   **One-Click Launcher**: Auto-generates the correct environment variables for your OS (macOS, Linux, Windows).

---

## 🤝 Contributing

We welcome contributions! Whether it's adding new transcoders (e.g., for Mistral API, Cohere) or improving the dashboard.

1.  Fork the repo
2.  Create your feature branch (`git checkout -b feature/amazing-transcoder`)
3.  Commit your changes
4.  Push to the branch
5.  Open a Pull Request

---

*Built with ❤️ by the Antigravity Team*
