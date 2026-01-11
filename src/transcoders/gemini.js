/**
 * Protocol Transcoder: Anthropic Messages -> Google Gemini REST
 */
export class GeminiTranscoder {
    /**
     * Converts Anthropic request body to Gemini format
     */
    static toGemini(anthropicBody) {
        const { messages, system, stream, model, temperature, max_tokens, stop_sequences } = anthropicBody;

        // 1. Convert System Prompt
        // Gemini expects system_instruction as { parts: [{ text: "..." }] }
        const systemInstruction = system ? {
            parts: [{ text: system }]
        } : undefined;

        // 2. Map Roles and Contents (Anthropic 'assistant' -> Gemini 'model')
        const contents = messages.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: typeof msg.content === 'string' ? msg.content : msg.content.map(c => c.text).join('') }]
        }));

        // 3. Build Gemini Request Payload
        return {
            contents,
            system_instruction: systemInstruction,
            generationConfig: {
                temperature: temperature || 0.7, // Default slightly lower for Gemini
                maxOutputTokens: max_tokens || 8192,
                stopSequences: stop_sequences || []
            }
        };
    }

    /**
     * Transforms a Gemini response chunk back into an Anthropic SSE chunk
     * Essential for real-time streaming in the CLI
     */
    static fromGeminiStream(geminiChunk, index) {
        // Handle Gemini 1.5/2.0 streaming format
        const text = geminiChunk.candidates?.[0]?.content?.parts?.[0]?.text || "";

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
