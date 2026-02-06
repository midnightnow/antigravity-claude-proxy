import express from 'express';
import * as sessionManager from '../session-manager.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

export default function () {
    // Get all sessions
    router.get('/', (req, res) => {
        try {
            const sessions = sessionManager.getAllSessions();
            const stats = sessionManager.getSessionStats();
            res.json({ sessions, stats });
        } catch (error) {
            logger.error('[API] Failed to get sessions:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Get specific session
    router.get('/:id', (req, res) => {
        try {
            const id = parseInt(req.params.id, 10);
            const session = sessionManager.getSession(id);
            if (!session) return res.status(404).json({ error: 'Session not found' });
            res.json(session);
        } catch (error) {
            logger.error('[API] Failed to get session:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Update session name
    router.patch('/:id', (req, res) => {
        try {
            const id = parseInt(req.params.id, 10);
            const { name } = req.body;
            if (!name) return res.status(400).json({ error: 'Name is required' });
            const session = sessionManager.updateSessionName(id, name);
            if (!session) return res.status(404).json({ error: 'Session not found' });
            res.json(session);
        } catch (error) {
            logger.error('[API] Failed to update session:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Delete session
    router.delete('/:id', (req, res) => {
        try {
            const id = parseInt(req.params.id, 10);
            const deleted = sessionManager.deleteSession(id);
            if (!deleted) return res.status(404).json({ error: 'Session not found' });
            res.json({ success: true, message: 'Session deleted' });
        } catch (error) {
            logger.error('[API] Failed to delete session:', error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
}
