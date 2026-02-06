/**
 * Express Server - Antigravity Claude Proxy
 * Deep Code Review & Refactor (Remediation 2026-02)
 *
 * This version uses modular routing to reduce bloat and improve maintainability.
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { REQUEST_BODY_LIMIT } from './constants.js';
import { AccountManager } from './account-manager/index.js';
import { logger } from './utils/logger.js';
import usageStats from './modules/usage-stats.js';
import { mountWebUI } from './webui/index.js';
import { config } from './config.js';
import { startBackgroundRefresh } from './utils/proactive-token-refresh.js';
import TerminalLauncher from './launcher.js';

// Import Route Handlers
import messagesRouter from './routes/messages.js';
import modelsRouter from './routes/models.js';
import accountsRouter from './routes/accounts.js';
import launcherRouter from './routes/launcher.js';
import sessionsRouter from './routes/sessions.js';
import usageRouter from './routes/usage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const args = process.argv.slice(2);
const FALLBACK_ENABLED = args.includes('--fallback') || process.env.FALLBACK === 'true';

const app = express();
const accountManager = new AccountManager();

// Initialization state
let isInitialized = false;
let initPromise = null;

/**
 * Middleware: Ensure account manager is initialized
 */
async function ensureInitialized(req, res, next) {
    if (isInitialized) return next();
    if (initPromise) {
        await initPromise;
        return next();
    }

    initPromise = (async () => {
        try {
            await accountManager.initialize();
            isInitialized = true;
            const status = accountManager.getStatus();
            logger.success(`[Server] Account pool initialized: ${status.summary}`);
            startBackgroundRefresh(accountManager);
        } catch (error) {
            initPromise = null;
            logger.error('[Server] Initialization failed:', error.message);
            throw error;
        }
    })();

    await initPromise;
    next();
}

/**
 * Middleware: Model Mapping
 */
function modelMappingMiddleware(req, res, next) {
    if (req.body && req.body.model) {
        const modelMapping = config.modelMapping || {};
        if (modelMapping[req.body.model]?.mapping) {
            const original = req.body.model;
            req.body.model = modelMapping[original].mapping;
            logger.debug(`[Mapping] ${original} -> ${req.body.model}`);
        }
    }
    next();
}

// === Global Middleware ===
app.use(cors());
app.use(express.json({ limit: REQUEST_BODY_LIMIT }));

// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://unpkg.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'");
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

usageStats.setupMiddleware(app);
mountWebUI(app, __dirname, accountManager);

// === Terminal Launcher ===
const launcher = new TerminalLauncher({
    port: process.env.PORT || 8080,
    defaultModel: 'claude-opus-4-5-thinking',
    apiKey: 'dummy'
});

// === Routes ===

// Health Check (Lightweight)
app.get('/health', (req, res) => res.json({ status: 'ok', version: '1.3.0' }));

// Apply mapping and initialization only to relevant routes
app.use('/v1', ensureInitialized, modelMappingMiddleware);

// Anthropic API Routes
app.use('/v1', messagesRouter(accountManager, FALLBACK_ENABLED));
app.use('/v1', modelsRouter(accountManager));

// Management Routes
app.use('/api/launcher', ensureInitialized, launcherRouter(launcher));
app.use('/api/sessions', ensureInitialized, sessionsRouter());
app.use('/api/stats', usageRouter());
app.use('/account', ensureInitialized, accountsRouter(accountManager));

// Legacy compatibility redirects
app.get('/account-limits', (req, res) => res.redirect(301, '/account/account-limits'));
app.post('/refresh-token', (req, res) => res.redirect(307, '/account/refresh-token'));
app.get('/sessions', (req, res) => res.redirect(301, '/api/sessions'));
app.post('/api/launch', (req, res) => res.redirect(307, '/api/launcher/launch'));

// Catch-all 404
app.use('*', (req, res) => {
    res.status(404).json({
        type: 'error',
        error: {
            type: 'not_found_error',
            message: `Endpoint ${req.method} ${req.originalUrl} not found`
        }
    });
});

export default app;
