import express from 'express';
import { listModels } from '../cloudcode/index.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

export default function (accountManager) {
    router.get('/models', async (req, res) => {
        try {
            const account = accountManager.pickNext();
            if (!account) {
                return res.status(503).json({ error: 'No active accounts available' });
            }

            const token = await accountManager.getTokenForAccount(account);
            const models = await listModels(token);
            res.json(models);
        } catch (error) {
            logger.error('[API] Failed to list models:', error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
}
