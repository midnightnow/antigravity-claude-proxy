import express from 'express';
import { getModelQuotas, getSubscriptionTier } from '../cloudcode/index.js';
import { forceRefresh } from '../auth/token-extractor.js';
import { logger } from '../utils/logger.js';
import { sanitizeAccountForResponse } from '../utils/error-sanitizer.js';

const router = express.Router();

export default function (accountManager) {
    // Get account quotas and status
    router.get('/account-limits', async (req, res) => {
        try {
            const status = accountManager.getStatus();
            const accountsWithQuotas = await Promise.all(
                status.accounts.map(async (acc) => {
                    try {
                        const fullAcc = accountManager.getAllAccounts().find(a => a.email === acc.email);
                        if (!fullAcc || acc.isInvalid) return acc;

                        const token = await accountManager.getTokenForAccount(fullAcc);
                        const quotas = await getModelQuotas(token);
                        const { tier } = await getSubscriptionTier(token);

                        return { ...acc, quotas, tier };
                    } catch (e) {
                        return { ...acc, quotaError: e.message };
                    }
                })
            );

            res.json({
                ...status,
                accounts: accountsWithQuotas.map(sanitizeAccountForResponse)
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Force token refresh
    router.post('/refresh-token', async (req, res) => {
        try {
            logger.info('[API] Manual token refresh requested');
            await forceRefresh();
            accountManager.resetAllRateLimits();
            res.json({ success: true, message: 'Tokens refreshed successfully' });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    return router;
}
