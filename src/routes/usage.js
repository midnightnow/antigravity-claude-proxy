import express from 'express';
import usageStats from '../modules/usage-stats.js';

const router = express.Router();

export default function () {
    router.get('/history', (req, res) => {
        const history = usageStats.getHistory();
        res.json(history);
    });

    return router;
}
