const { exec } = require('child_process');
const os = require('os');
const path = require('path');

/**
 * Production-ready terminal launcher for Antigravity Claude Proxy
 * Spawns Claude CLI terminals with pre-configured environment
 */

class ClaudeTerminalLauncher {
    constructor(config = {}) {
        this.baseUrl = config.baseUrl || 'http://localhost:8080';
        this.apiKey = config.apiKey || 'antigravity';
        this.defaultModel = config.defaultModel || 'claude-opus-4-5-thinking';
        
        // Core Claude Code environment variables
        this.envVars = {
            ANTHROPIC_BASE_URL: this.baseUrl,
            ANTHROPIC_API_KEY: this.apiKey,
            ANTHROPIC_MODEL: this.defaultModel,
            CLAUDE_CODE_DONT_INHERIT_ENV: 'true'
        };
    }

    /**
     * Build the shell command sequence for Claude CLI
     */
    buildCommand() {
        const exports = Object.entries(this.envVars)
            .map(([key, val]) => `export ${key}="${val}"`)
            .join(' && ');
        
        const banner = [
            'echo "╔════════════════════════════════════════╗"',
            'echo "║   Antigravity Proxy Connected          ║"',
            'echo "╚════════════════════════════════════════╝"',
            'echo "📡 Proxy: $ANTHROPIC_BASE_URL"',
            'echo "🤖 Model: $ANTHROPIC_MODEL"',
            'echo ""'
        ].join(' && ');

        return `${exports} && ${banner} && claude`;
    }

    /**
     * Spawn terminal on macOS using AppleScript
     */
    async spawnMacOS() {
        const command = this.buildCommand();
        const script = `tell app "Terminal" to do script "${command}"`;
        
        return new Promise((resolve, reject) => {
            exec(`osascript -e '${script}'`, (error, stdout, stderr) => {
                if (error) {
                    console.error('[Launcher] macOS spawn failed:', error);
                    reject(new Error(`macOS terminal spawn failed: ${error.message}`));
                    return;
                }
                console.log('[Launcher] ✓ Terminal spawned on macOS');
                resolve({ platform: 'darwin', success: true });
            });
        });
    }

    /**
     * Spawn terminal on Linux using gnome-terminal or xterm
     */
    async spawnLinux() {
        const command = this.buildCommand();
        
        // Try multiple terminal emulators in order of preference
        const terminals = [
            `gnome-terminal -- bash -c "${command}; exec bash"`,
            `xterm -e "${command}; bash"`,
            `konsole -e bash -c "${command}; exec bash"`,
            `terminator -e "${command}"`
        ];

        for (const termCmd of terminals) {
            try {
                await new Promise((resolve, reject) => {
                    exec(termCmd, (error) => {
                        if (error) reject(error);
                        else resolve();
                    });
                });
                console.log('[Launcher] ✓ Terminal spawned on Linux');
                return { platform: 'linux', success: true };
            } catch (err) {
                continue; // Try next terminal
            }
        }

        throw new Error('No compatible terminal emulator found. Install gnome-terminal, xterm, konsole, or terminator.');
    }

    /**
     * Spawn terminal on Windows using cmd.exe
     */
    async spawnWindows() {
        const envVars = Object.entries(this.envVars)
            .map(([key, val]) => `set ${key}=${val}`)
            .join(' && ');

        const banner = [
            'echo ╔════════════════════════════════════════╗',
            'echo ║   Antigravity Proxy Connected          ║',
            'echo ╚════════════════════════════════════════╝',
            'echo 📡 Proxy: %ANTHROPIC_BASE_URL%',
            'echo 🤖 Model: %ANTHROPIC_MODEL%',
            'echo.'
        ].join(' && ');

        const command = `${envVars} && ${banner} && claude`;
        const shellCmd = `start cmd /k "${command}"`;

        return new Promise((resolve, reject) => {
            exec(shellCmd, (error, stdout, stderr) => {
                if (error) {
                    console.error('[Launcher] Windows spawn failed:', error);
                    reject(new Error(`Windows terminal spawn failed: ${error.message}`));
                    return;
                }
                console.log('[Launcher] ✓ Terminal spawned on Windows');
                resolve({ platform: 'win32', success: true });
            });
        });
    }

    /**
     * Main entry point - detects OS and spawns appropriate terminal
     */
    async launch() {
        const platform = os.platform();
        
        // Validate Claude CLI is installed
        const cliInstalled = await this.validateClaudeCLI();
        if (!cliInstalled) {
            throw new Error(
                'Claude CLI not found. Install with:\n' +
                'npm install -g @anthropic-ai/claude-cli'
            );
        }

        console.log(`[Launcher] Spawning terminal on ${platform}...`);

        switch (platform) {
            case 'darwin':
                return await this.spawnMacOS();
            case 'linux':
                return await this.spawnLinux();
            case 'win32':
                return await this.spawnWindows();
            default:
                throw new Error(`Unsupported platform: ${platform}`);
        }
    }

    /**
     * Check if Claude CLI is installed and accessible
     */
    validateClaudeCLI() {
        return new Promise((resolve) => {
            const command = os.platform() === 'win32' ? 'where claude' : 'which claude';
            
            exec(command, (error) => {
                if (error) {
                    console.warn('[Launcher] ⚠️  Claude CLI not found in PATH');
                    resolve(false);
                    return;
                }
                console.log('[Launcher] ✓ Claude CLI detected');
                resolve(true);
            });
        });
    }

    /**
     * Generate manual setup instructions for copy-paste
     */
    getManualInstructions() {
        const platform = os.platform();
        const shell = process.env.SHELL?.includes('zsh') ? 'zsh' : 'bash';
        
        if (platform === 'win32') {
            return {
                platform: 'Windows',
                commands: Object.entries(this.envVars)
                    .map(([key, val]) => `set ${key}=${val}`)
                    .concat(['claude'])
            };
        }

        return {
            platform: platform === 'darwin' ? 'macOS' : 'Linux',
            shell,
            commands: Object.entries(this.envVars)
                .map(([key, val]) => `export ${key}="${val}"`)
                .concat(['claude'])
        };
    }

    /**
     * Get system information for debugging
     */
    getSystemInfo() {
        return {
            platform: os.platform(),
            arch: os.arch(),
            release: os.release(),
            nodeVersion: process.version,
            shell: process.env.SHELL || 'unknown',
            proxyUrl: this.baseUrl
        };
    }
}

// Export both class and convenience function
module.exports = ClaudeTerminalLauncher;

// Convenience function for backward compatibility
module.exports.spawnClaudeTerminal = async function() {
    const launcher = new ClaudeTerminalLauncher();
    return await launcher.launch();
};
