import express from 'express';
import { sendMessage, sendMessageStream } from '../cloudcode/index.js';
import { validateMessages } from '../utils/validators.js';
import { logger } from '../utils/logger.js';
import { handleLocalRequest } from '../gateway.js';
import { broadcastRequest, broadcastResponse, broadcastError } from '../websocket-server.js';
import * as sessionManager from '../session-manager.js';
import { forceRefresh } from '../auth/token-extractor.js';

const router = express.Router();

/**
 * Parse API error messages into user-friendly responses with appropriate HTTP status codes
 * 
 * @param {Error} error - The error object to parse
 * @returns {{errorType: string, statusCode: number, errorMessage: string}} Parsed error details
 * 
 * @example
 * const { errorType, statusCode, errorMessage } = parseError(new Error('401 UNAUTHENTICATED'));
 * // Returns: { errorType: 'authentication_error', statusCode: 401, errorMessage: '...' }
 */
function parseError(error) {
    let errorType = 'api_error';
    let statusCode = 500;
    let errorMessage = error.message;

    if (error.message.includes('401') || error.message.includes('UNAUTHENTICATED')) {
        errorType = 'authentication_error';
        statusCode = 401;
        errorMessage = 'Authentication failed. Make sure Antigravity is running with a valid token.';
    } else if (error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED') || error.message.includes('QUOTA_EXHAUSTED')) {
        errorType = 'invalid_request_error';
        statusCode = 400;

        const resetMatch = error.message.match(/quota will reset after ([\dh\dm\ds]+)/i);
        const modelMatch = error.message.match(/Rate limited on ([^.]+)\./) || error.message.match(/"model":\s*"([^"]+)"/);
        const model = modelMatch ? modelMatch[1] : 'the model';

        if (resetMatch) {
            errorMessage = `You have exhausted your capacity on ${model}. Quota will reset after ${resetMatch[1]}.`;
        } else {
            errorMessage = `You have exhausted your capacity on ${model}. Please wait for your quota to reset.`;
        }
    } else if (error.message.includes('invalid_request_error') || error.message.includes('INVALID_ARGUMENT')) {
        errorType = 'invalid_request_error';
        statusCode = 400;
    } else if (error.message.includes('overloaded_error') || error.message.includes('503')) {
        errorType = 'overloaded_error';
        statusCode = 503;
        errorMessage = 'The Antigravity API is currently overloaded. Please try again in a few seconds.';
    }

    return { errorType, statusCode, errorMessage };
}

/**
 * Messages API Endpoint
 * Handles both streaming and non-streaming requests
 */
export default function (accountManager, FALLBACK_ENABLED) {
    router.post('/messages', async (req, res) => {
        try {
            // === Model Mapping ===
            if (req.body.model) {
                // Note: config is imported in server.js, we might need to pass it or re-import
                // For simplicity, we assume server.js handles global mapping before routing
            }

            // === Gateway Routing ===
            const gwModel = req.body.model;
            if (gwModel && (gwModel.startsWith('local-') || gwModel.startsWith('gemma-'))) {
                return handleLocalRequest(req, res);
            }

            // === Input Validation ===
            const validation = validateMessages(req.body);
            if (!validation.valid) {
                logger.warn(`[API] Validation failed: ${validation.errors[0]}`);
                return res.status(400).json({
                    type: 'error',
                    error: {
                        type: 'invalid_request_error',
                        message: validation.errors[0]
                    }
                });
            }

            const {
                model,
                messages,
                stream,
                system,
                max_tokens,
                tools,
                tool_choice,
                thinking,
                top_p,
                top_k,
                temperature
            } = validation.data;

            const modelId = model || 'claude-3-5-sonnet-20241022';

            // Optimistic Retry
            if (accountManager.isAllRateLimited(modelId)) {
                logger.warn(`[Server] All accounts rate-limited for ${modelId}. Resetting state for optimistic retry.`);
                accountManager.resetAllRateLimits();
            }

            const request = {
                model: modelId,
                messages,
                max_tokens: max_tokens || 4096,
                stream,
                system,
                tools,
                tool_choice,
                thinking,
                top_p,
                top_k,
                temperature
            };

            logger.info(`[API] Request for model: ${request.model}, stream: ${!!stream}`);

            const session = sessionManager.detectOrCreateSession(req);
            sessionManager.updateSessionActivity(session.id, request.model);
            broadcastRequest(request.model, '/v1/messages');

            if (stream) {
                res.setHeader('Content-Type', 'text/event-stream');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Connection', 'keep-alive');
                res.setHeader('X-Accel-Buffering', 'no');
                if (res.flushHeaders) res.flushHeaders();

                try {
                    for await (const event of sendMessageStream(request, accountManager, FALLBACK_ENABLED)) {
                        res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
                        if (res.flush) res.flush();
                    }
                    res.end();
                    broadcastResponse(200, request.model);
                } catch (streamError) {
                    logger.error('[API] Stream error:', streamError);
                    const { errorType, errorMessage } = parseError(streamError);
                    broadcastError(streamError, 'streaming');
                    sessionManager.recordSessionError(session.id, streamError);

                    res.write(`event: error\ndata: ${JSON.stringify({
                        type: 'error',
                        error: { type: errorType, message: errorMessage }
                    })}\n\n`);
                    res.end();
                }
            } else {
                const response = await sendMessage(request, accountManager, FALLBACK_ENABLED);
                res.json(response);
                broadcastResponse(200, request.model);
            }

        } catch (error) {
            logger.error('[API] Error:', error);
            let { errorType, statusCode, errorMessage } = parseError(error);

            if (errorType === 'authentication_error') {
                logger.warn('[API] Token authentication failed, attempting account refresh...');
                try {
                    const allAccounts = accountManager.getAllAccounts();
                    const oauthAccounts = allAccounts.filter(a => a.source === 'oauth' && a.refreshToken);

                    if (oauthAccounts.length > 0) {
                        for (const account of oauthAccounts) {
                            accountManager.clearTokenCache(account.email);
                            accountManager.clearProjectCache(account.email);
                        }

                        const results = await Promise.allSettled(
                            oauthAccounts.map(a => accountManager.getTokenForAccount(a))
                        );

                        const succeeded = results.filter(r => r.status === 'fulfilled').length;
                        if (succeeded > 0) {
                            errorMessage = `Authentication refreshed (${succeeded}/${oauthAccounts.length} accounts). Please retry your request.`;
                        } else {
                            errorMessage = `All accounts failed to refresh. Re-authentication required via 'npm run accounts'.`;
                        }
                    } else {
                        await forceRefresh();
                        errorMessage = 'Token was expired and has been refreshed. Please retry your request.';
                    }
                } catch (refreshError) {
                    logger.error('[API] Token refresh failed:', refreshError.message);
                    errorMessage = 'Could not refresh token. Re-authentication required via \'npm run accounts\'.';
                }
            }

            broadcastError(error, errorType);
            const errorSession = sessionManager.getSessionByRequest(req);
            if (errorSession) {
                sessionManager.recordSessionError(errorSession.id, error);
            }

            if (res.headersSent) {
                res.write(`event: error\ndata: ${JSON.stringify({
                    type: 'error',
                    error: { type: errorType, message: errorMessage }
                })}\n\n`);
                res.end();
            } else {
                res.status(statusCode).json({
                    type: 'error',
                    error: { type: errorType, message: errorMessage }
                });
            }
        }
    });

    return router;
}
