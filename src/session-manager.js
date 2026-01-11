/**
 * Claude CLI Session Manager
 * Tracks and manages active Claude CLI sessions (similar to Antigravity's agent manager)
 */

import { logger } from './utils/logger.js';
import { broadcastSystem } from './websocket-server.js';

// In-memory session store
const sessions = new Map();
let sessionIdCounter = 1;

/**
 * Session structure:
 * {
 *   id: number,
 *   name: string,
 *   status: 'active' | 'idle' | 'error',
 *   createdAt: Date,
 *   lastActivity: Date,
 *   requestCount: number,
 *   model: string | null,
 *   pid: number | null
 * }
 */

/**
 * Create a new session
 */
export function createSession(name = null) {
    const id = sessionIdCounter++;
    const session = {
        id,
        name: name || `Session ${id}`,
        status: 'active',
        createdAt: new Date(),
        lastActivity: new Date(),
        requestCount: 0,
        model: null,
        pid: null,
        errors: []
    };

    sessions.set(id, session);
    logger.info(`[SessionManager] Created session #${id}: ${session.name}`);
    broadcastSystem(`New session created: ${session.name}`);

    return session;
}

/**
 * Get session by ID
 */
export function getSession(id) {
    return sessions.get(id);
}

/**
 * Get all sessions
 */
export function getAllSessions() {
    return Array.from(sessions.values()).sort((a, b) => b.lastActivity - a.lastActivity);
}

/**
 * Update session activity
 */
export function updateSessionActivity(id, model = null) {
    const session = sessions.get(id);
    if (!session) return null;

    session.lastActivity = new Date();
    session.requestCount++;
    if (model) {
        session.model = model;
    }
    session.status = 'active';

    return session;
}

/**
 * Mark session as idle (no activity for a while)
 */
export function markSessionIdle(id) {
    const session = sessions.get(id);
    if (!session) return null;

    session.status = 'idle';
    logger.debug(`[SessionManager] Session #${id} marked as idle`);

    return session;
}

/**
 * Record session error
 */
export function recordSessionError(id, error) {
    const session = sessions.get(id);
    if (!session) return null;

    session.status = 'error';
    session.errors.push({
        message: error.message || String(error),
        timestamp: new Date()
    });

    // Keep only last 10 errors
    if (session.errors.length > 10) {
        session.errors = session.errors.slice(-10);
    }

    logger.warn(`[SessionManager] Session #${id} error: ${error.message || error}`);

    return session;
}

/**
 * Update session name
 */
export function updateSessionName(id, name) {
    const session = sessions.get(id);
    if (!session) return null;

    session.name = name;
    logger.info(`[SessionManager] Session #${id} renamed to: ${name}`);
    broadcastSystem(`Session renamed: ${name}`);

    return session;
}

/**
 * Delete session
 */
export function deleteSession(id) {
    const session = sessions.get(id);
    if (!session) return false;

    sessions.delete(id);
    logger.info(`[SessionManager] Deleted session #${id}: ${session.name}`);
    broadcastSystem(`Session deleted: ${session.name}`);

    return true;
}

/**
 * Auto-cleanup idle sessions (older than 1 hour with no activity)
 */
export function cleanupIdleSessions() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    let cleaned = 0;

    for (const [id, session] of sessions.entries()) {
        if (session.lastActivity < oneHourAgo && session.status === 'idle') {
            sessions.delete(id);
            cleaned++;
            logger.debug(`[SessionManager] Auto-cleaned idle session #${id}`);
        }
    }

    if (cleaned > 0) {
        logger.info(`[SessionManager] Auto-cleanup: removed ${cleaned} idle session(s)`);
    }

    return cleaned;
}

/**
 * Get session statistics
 */
export function getSessionStats() {
    const all = getAllSessions();

    return {
        total: all.length,
        active: all.filter(s => s.status === 'active').length,
        idle: all.filter(s => s.status === 'idle').length,
        error: all.filter(s => s.status === 'error').length,
        totalRequests: all.reduce((sum, s) => sum + s.requestCount, 0)
    };
}

/**
 * Detect session from request headers or create new one
 */
export function detectOrCreateSession(req) {
    // Try to get session ID from custom header
    const sessionId = req.headers['x-session-id'];

    if (sessionId) {
        const id = parseInt(sessionId, 10);
        const session = sessions.get(id);
        if (session) {
            return session;
        }
    }

    // Create new session if none found
    return createSession();
}

/**
 * Start auto-cleanup interval (runs every 30 minutes)
 */
let cleanupInterval = null;

export function startAutoCleanup() {
    if (cleanupInterval) return;

    cleanupInterval = setInterval(() => {
        cleanupIdleSessions();
    }, 30 * 60 * 1000); // 30 minutes

    logger.info('[SessionManager] Auto-cleanup started (30min interval)');
}

export function stopAutoCleanup() {
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
        logger.info('[SessionManager] Auto-cleanup stopped');
    }
}

/**
 * Mark sessions as idle if no activity in last 5 minutes
 */
export function checkIdleSessions() {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    for (const [id, session] of sessions.entries()) {
        if (session.status === 'active' && session.lastActivity < fiveMinutesAgo) {
            markSessionIdle(id);
        }
    }
}

// Start idle check interval (every minute)
let idleCheckInterval = setInterval(checkIdleSessions, 60 * 1000);

export function stopIdleCheck() {
    if (idleCheckInterval) {
        clearInterval(idleCheckInterval);
        idleCheckInterval = null;
    }
}
