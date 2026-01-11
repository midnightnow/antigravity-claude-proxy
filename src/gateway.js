import { logger } from './utils/logger.js';
// fetch is global in Node 18+
import { OpenAITranscoder } from './transcoders/openai.js';

/**
 * Handles requests to local/external OpenAI-compatible agents (LM Studio, Ollama, etc.)
 */
export async function handleLocalRequest(req, res) {
    const model = req.body.model;
    const targetUrl = process.env.LOCAL_LLM_URL || 'http://localhost:1234/v1/chat/completions';

    logger.info(`[Gateway] Routing ${model} to Local Agent at ${targetUrl}`);

    try {
        // Transcode Anthropic -> OpenAI
        const openAIBody = OpenAITranscoder.toOpenAI(req.body);

        // Remove 'local-' prefix if the local server expects clean names, 
        // or keep it if mapped. Usually local servers take the model name as is.
        // openAIBody.model = openAIBody.model.replace('local-', ''); 

        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Add Authorization if needed via env
                ...(process.env.LOCAL_LLM_KEY ? { 'Authorization': `Bearer ${process.env.LOCAL_LLM_KEY}` } : {})
            },
            body: JSON.stringify(openAIBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Local Agent Error (${response.status}): ${errorText}`);
        }

        // Handle Streaming
        if (req.body.stream) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            // Listen to data events
            // Note: node-fetch body is a stream
            const stream = response.body;

            // We need to parse SSE chunks and transcode them back to Anthropic
            // This is a simplified parser; for robust SSE, dedicated parsing is better.
            stream.on('data', (chunk) => {
                const lines = chunk.toString().split('\n');
                for (const line of lines) {
                    if (line.trim() === '' || line.trim() === 'data: [DONE]') continue;
                    if (line.startsWith('data: ')) {
                        try {
                            const dataStr = line.replace('data: ', '');
                            const data = JSON.parse(dataStr);
                            const anthropicChunk = OpenAITranscoder.fromOpenAIStream(data);

                            if (anthropicChunk) {
                                res.write(`event: ${anthropicChunk.type}\n`);
                                res.write(`data: ${JSON.stringify(anthropicChunk)}\n\n`);
                            }
                        } catch (e) {
                            // ignore parse errors for partial chunks
                        }
                    }
                }
            });

            stream.on('end', () => {
                res.write('event: message_stop\ndata: {"type": "message_stop"}\n\n');
                res.end();
            });

            stream.on('error', (err) => {
                logger.error('[Gateway] Stream error:', err);
                res.end();
            });

        } else {
            // Non-streaming
            const data = await response.json();
            // TODO: Transcode Response OpenAI -> Anthropic (Non-streaming)
            // For now, assume CLI mostly uses streaming.
            // Simplified fallback for non-streaming:
            const content = data.choices[0].message.content;
            res.json({
                id: data.id,
                type: 'message',
                role: 'assistant',
                content: [{ type: 'text', text: content }],
                model: model,
                stop_reason: 'end_turn',
                stop_sequence: null,
                usage: { input_tokens: 0, output_tokens: 0 } // Placeholder
            });
        }

    } catch (error) {
        logger.error('[Gateway] Request Failed:', error);
        res.status(502).json({
            type: 'error',
            error: {
                type: 'api_error',
                message: `Gateway Error: ${error.message}`
            }
        });
    }
}
