/**
 * Claude CLI Sessions Component
 * Displays and manages active Claude CLI sessions
 */

window.Components = window.Components || {};

window.Components.sessions = function () {
    return {
        sessions: [],
        stats: { total: 0, active: 0, idle: 0, error: 0 },
        loading: false,
        cliInstalled: false,
        launching: false,

        async init() {
            await this.checkCLI();
            await this.fetchSessions();

            // Auto-refresh every 5 seconds
            setInterval(() => this.fetchSessions(), 5000);
        },

        async checkCLI() {
            try {
                const response = await fetch('/cli/detect');
                const data = await response.json();
                this.cliInstalled = data.installed;
            } catch (error) {
                console.error('Failed to check CLI:', error);
                this.cliInstalled = false;
            }
        },

        async fetchSessions() {
            try {
                const response = await fetch('/sessions');
                const data = await response.json();
                this.sessions = data.sessions || [];
                this.stats = data.stats || { total: 0, active: 0, idle: 0, error: 0 };
            } catch (error) {
                console.error('Failed to fetch sessions:', error);
            }
        },

        async launchCLI() {
            if (!this.cliInstalled) {
                this.$store.global.showToast('Claude CLI is not installed', 'error');
                return;
            }

            this.launching = true;
            try {
                const response = await fetch('/cli/launch', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: `Session ${this.stats.total + 1}`,
                        port: 8080
                    })
                });

                const data = await response.json();

                if (data.success) {
                    this.$store.global.showToast('Terminal launched successfully!', 'success');
                    await this.fetchSessions();
                } else {
                    this.$store.global.showToast(data.error || 'Failed to launch terminal', 'error');
                }
            } catch (error) {
                console.error('Failed to launch CLI:', error);
                this.$store.global.showToast('Failed to launch terminal', 'error');
            } finally {
                this.launching = false;
            }
        },

        async renameSession(id, currentName) {
            const newName = prompt('Enter new session name:', currentName);
            if (!newName || newName === currentName) return;

            try {
                const response = await fetch(`/sessions/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: newName })
                });

                if (response.ok) {
                    this.$store.global.showToast('Session renamed', 'success');
                    await this.fetchSessions();
                } else {
                    this.$store.global.showToast('Failed to rename session', 'error');
                }
            } catch (error) {
                console.error('Failed to rename session:', error);
                this.$store.global.showToast('Failed to rename session', 'error');
            }
        },

        async deleteSession(id) {
            if (!confirm('Delete this session?')) return;

            try {
                const response = await fetch(`/sessions/${id}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    this.$store.global.showToast('Session deleted', 'success');
                    await this.fetchSessions();
                } else {
                    this.$store.global.showToast('Failed to delete session', 'error');
                }
            } catch (error) {
                console.error('Failed to delete session:', error);
                this.$store.global.showToast('Failed to delete session', 'error');
            }
        },

        getStatusColor(status) {
            switch (status) {
                case 'active': return 'text-neon-green';
                case 'idle': return 'text-yellow-500';
                case 'error': return 'text-red-500';
                default: return 'text-gray-500';
            }
        },

        getStatusIcon(status) {
            switch (status) {
                case 'active': return '●';
                case 'idle': return '○';
                case 'error': return '✕';
                default: return '?';
            }
        },

        formatTime(date) {
            const d = new Date(date);
            const now = new Date();
            const diff = now - d;

            if (diff < 60000) return 'just now';
            if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
            if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
            return d.toLocaleDateString();
        }
    };
};
