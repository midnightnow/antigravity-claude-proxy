import { exec } from 'child_process';
import os from 'os';
import fs from 'fs';

/**
 * Terminal Launcher for Antigravity Claude Proxy
 */
class TerminalLauncher {
    constructor(config = {}) {
        this.port = config.port || 8080;
        this.defaultModel = config.defaultModel || 'gemini-3.0-flash';
        this.apiKey = config.apiKey || 'dummy';
    }

    async launch(modelOverride) {
        const platform = os.platform();
        const model = modelOverride || this.defaultModel;

        // Validate CLI first
        const cliInstalled = await this.validateClaudeCLI();
        if (!cliInstalled) {
            throw new Error('Claude CLI not found. Install with: npm install -g @anthropic-ai/claude-cli');
        }

        // Simplified command structure - use wrapper script
        const wrapperPath = '/Users/studio/antigravity-claude-proxy/claude-proxy';
        const commands = [
            `export ANTHROPIC_BASE_URL=http://localhost:${this.port}`,
            `export ANTHROPIC_API_KEY=${this.apiKey}`,
            `export ANTHROPIC_MODEL=${model}`,
            'clear',
            `${wrapperPath}`
        ].join(' && ');

        if (platform === 'darwin') {
            return this._spawnMacOS(commands);
        } else if (platform === 'linux') {
            return this._spawnLinux(commands);
        }
        throw new Error(`Platform ${platform} not supported`);
    }

    _spawnMacOS(commands) {
        return new Promise((resolve, reject) => {
            // Instead of temp file, use Terminal's "do script" with proper escaping
            // We need to make the commands run in an interactive shell
            const safeCommands = commands
                .replace(/\\/g, '\\\\')  // Escape backslashes
                .replace(/"/g, '\\"')     // Escape quotes
                .replace(/\$/g, '\\$')    // Escape dollar signs
                .replace(/`/g, '\\`');    // Escape backticks

            const script = `tell application "Terminal"
                activate
                do script "${safeCommands}"
            end tell`;

            exec(`osascript -e '${script}'`, (error) => {
                if (error) {
                    console.error('[Launcher] macOS spawn failed:', error);
                    reject(error);
                } else {
                    console.log('[Launcher] ✓ Terminal spawned on macOS');
                    resolve({ platform: 'darwin', success: true });
                }
            });
        });
    }

    _spawnLinux(commands) {
        return new Promise((resolve, reject) => {
            exec(`gnome-terminal -- bash -c "${commands}; exec bash"`, (error) => {
                if (error) {
                    exec(`xterm -e "${commands}; bash"`, (err) => {
                        if (err) reject(err);
                        else resolve({ platform: 'linux', success: true });
                    });
                } else {
                    resolve({ platform: 'linux', success: true });
                }
            });
        });
    }

    async validateClaudeCLI() {
        return new Promise((resolve) => {
            const command = os.platform() === 'win32' ? 'where claude' : 'which claude';
            exec(command, (error) => resolve(!error));
        });
    }

    getManualInstructions() {
        const platform = os.platform();
        return {
            platform: platform === 'darwin' ? 'macOS' : 'Linux',
            commands: [
                `export ANTHROPIC_BASE_URL=http://localhost:${this.port}`,
                `export ANTHROPIC_API_KEY=${this.apiKey}`,
                `export ANTHROPIC_MODEL=${this.defaultModel}`,
                'claude'
            ]
        };
    }
}

// Export as default for ESM compatibility
export default TerminalLauncher;
