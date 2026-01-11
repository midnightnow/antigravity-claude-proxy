/**
 * CLI Launcher
 * Spawns Claude CLI in a new terminal window with Antigravity configuration
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import { logger } from './utils/logger.js';

const execAsync = promisify(exec);

/**
 * Detect if Claude CLI is installed
 */
export async function detectCLI() {
    try {
        const { stdout } = await execAsync('which claude');
        return {
            installed: true,
            path: stdout.trim()
        };
    } catch (error) {
        return {
            installed: false,
            path: null
        };
    }
}

/**
 * Get platform-specific terminal launch command
 */
function getTerminalCommand(port) {
    const platform = os.platform();

    // Build complete command as a single sequence (all on one line to avoid parse errors)
    const command = `echo "╔══════════════════════════════════════════════════════════════╗" && echo "║              🚀 ANTIGRAVITY CLAUDE SESSION 🚀                ║" && echo "╠══════════════════════════════════════════════════════════════╣" && echo "║                                                              ║" && echo "║  Proxy: http://localhost:${port.toString().padEnd(44)} ║" && echo "║  Status: Connected via Antigravity                           ║" && echo "║                                                              ║" && echo "║  You are now using Claude with Antigravity credits!          ║" && echo "║                                                              ║" && echo "╚══════════════════════════════════════════════════════════════╝" && echo "" && export ANTHROPIC_BASE_URL=http://localhost:${port} && export ANTHROPIC_API_KEY=dummy && claude`;

    if (platform === 'darwin') {
        // macOS - use AppleScript to open Terminal
        const script = `
tell application "Terminal"
    activate
    do script "${command.replace(/"/g, '\\"')}"
end tell
        `.trim();

        return `osascript -e '${script.replace(/'/g, "'\\''")}'`;
    } else if (platform === 'linux') {
        // Linux - try common terminal emulators
        return `x-terminal-emulator -e bash -c '${command}' || gnome-terminal -- bash -c '${command}' || xterm -e bash -c '${command}'`;
    } else if (platform === 'win32') {
        // Windows - use cmd
        return `start cmd /k "${command.replace(/&&/g, '&')}"`;
    }

    throw new Error(`Unsupported platform: ${platform}`);
}

/**
 * Launch Claude CLI in a new terminal
 */
export async function launchCLI(port = 8080) {
    try {
        // Check if CLI is installed
        const cliStatus = await detectCLI();
        if (!cliStatus.installed) {
            throw new Error('Claude CLI is not installed. Install it with: npm install -g @anthropic-ai/claude-cli');
        }

        // Get platform-specific command
        const command = getTerminalCommand(port);

        logger.info('[CLI Launcher] Launching Claude CLI in new terminal...');
        logger.debug('[CLI Launcher] Command:', command);

        // Execute the command (don't wait for it to finish)
        exec(command, (error) => {
            if (error) {
                logger.error('[CLI Launcher] Error launching terminal:', error.message);
            } else {
                logger.success('[CLI Launcher] Terminal launched successfully');
            }
        });

        return {
            success: true,
            message: 'Terminal launched successfully'
        };
    } catch (error) {
        logger.error('[CLI Launcher] Failed to launch CLI:', error.message);
        throw error;
    }
}

/**
 * Get manual setup commands for copy-paste
 */
export function getManualCommands(port = 8080) {
    const platform = os.platform();

    const commands = {
        bash: [
            `export ANTHROPIC_BASE_URL=http://localhost:${port}`,
            `export ANTHROPIC_API_KEY=dummy`,
            `claude`
        ],
        zsh: [
            `export ANTHROPIC_BASE_URL=http://localhost:${port}`,
            `export ANTHROPIC_API_KEY=dummy`,
            `claude`
        ],
        fish: [
            `set -x ANTHROPIC_BASE_URL http://localhost:${port}`,
            `set -x ANTHROPIC_API_KEY dummy`,
            `claude`
        ],
        powershell: [
            `$env:ANTHROPIC_BASE_URL="http://localhost:${port}"`,
            `$env:ANTHROPIC_API_KEY="dummy"`,
            `claude`
        ],
        cmd: [
            `set ANTHROPIC_BASE_URL=http://localhost:${port}`,
            `set ANTHROPIC_API_KEY=dummy`,
            `claude`
        ]
    };

    // Return platform-appropriate default
    if (platform === 'win32') {
        return {
            powershell: commands.powershell.join('\n'),
            cmd: commands.cmd.join('\n')
        };
    } else {
        return {
            bash: commands.bash.join('\n'),
            zsh: commands.zsh.join('\n'),
            fish: commands.fish.join('\n')
        };
    }
}
