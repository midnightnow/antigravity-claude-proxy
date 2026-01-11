/**
 * Protocol Transcoder: Anthropic Messages -> OpenAI Chat Completions (for Local Agents/LM Studio)
 */
export class OpenAITranscoder {
    /**
     * Converts Anthropic request body to OpenAI format
     */
    static toOpenAI(anthropicBody) {
        const { messages, system, stream, model, temperature, max_tokens, stop_sequences } = anthropicBody;

        // 1. Convert Messages
        // OpenAI puts system prompt in the messages array
        const openAIMessages = [];

        if (system) {
            openAIMessages.push({ role: 'system', content: system });
        }

        messages.forEach(msg => {
            const content = typeof msg.content === 'string' ? msg.content : msg.content.map(c => c.text).join('');
            openAIMessages.push({
                role: msg.role,
                content: content
            });
        });

        // 2. Build OpenAI Request Payload
        return {
            model: model, // Pass through or map if needed
            messages: openAIMessages,
            stream: stream,
            temperature: temperature,
            max_tokens: max_tokens,
            stop: stop_sequences
        };
    }

    /**
     * Transforms an OpenAI streaming chunk back into an Anthropic SSE chunk
     */
    static fromOpenAIStream(openaiChunk, index) {
        // Handle OpenAI streaming format
        const delta = openaiChunk.choices?.[0]?.delta;
        const text = delta?.content || "";

        if (!text) return null;

        return {
            type: "content_block_delta",
            index: index,
            delta: {
                type: "text_delta",
                text: text
            }
        };
    }
}
