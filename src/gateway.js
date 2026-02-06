import { logger } from './utils/logger.js';
import { OpenAITranscoder } from './transcoders/openai.js';
import { Readable } from 'stream';

/**
 * Route requests for local/external agents to the appropriate handler
 * 
 * Handles models with `local-*` or `gemma-*` prefixes by routing them to
 * local OpenAI-compatible endpoints (LM Studio, Ollama, etc.)
 * 
 * @param {import('express').Request} req - Express request object with Anthropic-format body
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>}
 */
export async function handleLocalRequest(req, res) {
    const model = req.body.model;

    // === ROUTE: Local Agents (LM Studio/Ollama) ===
    // All local-* model requests go here
    return handleOpenAIProxyRequest(req, res);
}

/**
 * Proxy requests to local OpenAI-compatible endpoints
 * 
 * Transcodes Anthropic Messages API format to OpenAI Chat Completions format,
 * forwards to local endpoint, and converts the response back to Anthropic format.
 * 
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>}
 */
async function handleOpenAIProxyRequest(req, res) {
    const model = req.body.model;
    const targetUrl = process.env.LOCAL_LLM_URL || 'http://localhost:1234/v1/chat/completions';
    logger.info(`[Gateway] Routing ${model} to Local Agent at ${targetUrl}`);

    try {
        const openAIBody = OpenAITranscoder.toOpenAI(req.body);

        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(process.env.LOCAL_LLM_KEY ? { 'Authorization': `Bearer ${process.env.LOCAL_LLM_KEY}` } : {})
            },
            body: JSON.stringify(openAIBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Local Agent Error (${response.status}): ${errorText}`);
        }

        if (req.body.stream) {
            streamResponse(res, response.body, OpenAITranscoder.fromOpenAIStream, 'openai');
        } else {
            const data = await response.json();
            const content = data.choices[0].message.content;
            res.json(createAnthropicResponse(content, model));
        }

    } catch (error) {
        handleError(res, error);
    }
}

// === Helpers ===

function streamResponse(res, bodyStream, transcoderFn, type) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // We treat the stream as text chunks for simplicity in this proxy implementation.
    // A production implementation would parse the JSON structure properly.
    bodyStream.on('data', (chunk) => {
        try {
            const str = chunk.toString();

            if (type === 'openai') {
                const lines = str.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                        try {
                            const json = JSON.parse(line.substring(6));
                            const anthropicChunk = transcoderFn(json);
                            if (anthropicChunk) {
                                writeSSE(res, anthropicChunk);
                            }
                        } catch (e) { }
                    }
                }
            }
        } catch (e) {
            logger.error('[Gateway] Stream parse error', e);
        }
    });

    bodyStream.on('end', () => {
        res.write('event: message_stop\ndata: {"type": "message_stop"}\n\n');
        res.end();
    });
}

function writeSSE(res, chunk) {
    res.write(`event: ${chunk.type}\n`);
    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
}

function createAnthropicResponse(content, model) {
    return {
        id: `msg_${Date.now()}`,
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: content }],
        model: model,
        stop_reason: 'end_turn',
        usage: { input_tokens: 0, output_tokens: 0 }
    };
}

function handleError(res, error) {
    logger.error(`[Gateway] Error: ${error.message}`);

    // Antigravity rate limit errors are specific, but here we might get generic API errors
    // We try to return a format Claude CLI respects.
    res.status(502).json({
        type: 'error',
        error: {
            type: 'api_error',
            message: error.message
        }
    });
}
