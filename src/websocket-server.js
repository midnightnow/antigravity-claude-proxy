/**
 * WebSocket Server for Live Monitoring
 * Broadcasts proxy events to connected dashboard clients
 */

import { WebSocketServer } from 'ws';
import { logger } from './utils/logger.js';

let wss = null;
const clients = new Set();

/**
 * Initialize WebSocket server
 */
export function initWebSocket(server) {
    wss = new WebSocketServer({ server, path: '/ws' });

    wss.on('connection', (ws) => {
        clients.add(ws);
        logger.info('[WebSocket] Client connected');
        
        // Send welcome message
        ws.send(JSON.stringify({
            type: 'sys',
            message: 'Connected to Antigravity Proxy Monitor',
            timestamp: new Date().toISOString()
        }));

        ws.on('close', () => {
            clients.delete(ws);
            logger.info('[WebSocket] Client disconnected');
        });

        ws.on('error', (error) => {
            logger.error('[WebSocket] Client error:', error.message);
            clients.delete(ws);
        });
    });

    logger.success('[WebSocket] Server initialized on /ws');
}

/**
 * Broadcast event to all connected clients
 */
export function broadcast(event) {
    if (!wss || clients.size === 0) return;

    const message = JSON.stringify({
        ...event,
        timestamp: event.timestamp || new Date().toISOString()
    });

    clients.forEach((client) => {
        if (client.readyState === 1) { // OPEN
            try {
                client.send(message);
            } catch (error) {
                logger.error('[WebSocket] Broadcast error:', error.message);
            }
        }
    });
}

/**
 * Broadcast request event
 */
export function broadcastRequest(model, path = '/v1/messages') {
    broadcast({
        type: 'request',
        model,
        path,
        message: `Routing to ${model}...`
    });
}

/**
 * Broadcast response event
 */
export function broadcastResponse(status, model) {
    broadcast({
        type: 'response',
        status,
        model,
        message: `Response: ${status}`
    });
}

/**
 * Broadcast error event
 */
export function broadcastError(error, context = '') {
    broadcast({
        type: 'error',
        message: `Error${context ? ` (${context})` : ''}: ${error.message || error}`,
        error: error.message || String(error)
    });
}

/**
 * Broadcast system event
 */
export function broadcastSystem(message) {
    broadcast({
        type: 'sys',
        message
    });
}

/**
 * Close WebSocket server
 */
export function closeWebSocket() {
    if (wss) {
        clients.forEach(client => client.close());
        clients.clear();
        wss.close();
        logger.info('[WebSocket] Server closed');
    }
}
