/**
 * Protocol Transcoder: Anthropic Messages -> OpenAI Chat Completions (for Local Agents/LM Studio)
 */
export class OpenAITranscoder {
    /**
     * Converts Anthropic request body to OpenAI format
     */
    static toOpenAI(anthropicBody) {
        const { messages, system, stream, model, temperature, max_tokens, stop_sequences, tools, tool_choice } = anthropicBody;

        // 1. Convert Messages and build proper OpenAI message history
        const openAIMessages = [];

        if (system) {
            openAIMessages.push({ role: 'system', content: system });
        }

        messages.forEach(msg => {
            if (Array.isArray(msg.content)) {
                // Check if we have tool results (implies User role in Anthropic, but 'tool' role in OpenAI)
                const hasToolResult = msg.content.some(c => c.type === 'tool_result');

                if (hasToolResult) {
                    // 1. Extract and push any text parts as a User message first
                    const textParts = msg.content
                        .filter(c => c.type === 'text' || typeof c === 'string')
                        .map(c => c.text || c)
                        .join('');

                    if (textParts) {
                        openAIMessages.push({ role: msg.role, content: textParts });
                    }

                    // 2. Push each tool result as a separate 'tool' role message
                    msg.content.filter(c => c.type === 'tool_result').forEach(tr => {
                        openAIMessages.push({
                            role: 'tool',
                            tool_call_id: tr.tool_use_id,
                            content: typeof tr.content === 'string' ? tr.content : JSON.stringify(tr.content)
                        });
                    });
                } else if (msg.role === 'assistant') {
                    // Handle Assistant message with potential text and tool_use
                    const toolUses = msg.content.filter(c => c.type === 'tool_use');
                    const textParts = msg.content
                        .filter(c => c.type === 'text')
                        .map(c => c.text)
                        .join('');

                    const newMessage = {
                        role: 'assistant',
                        content: textParts || null     // OpenAI requires null content if tools are present and no text? Valid.
                    };

                    if (toolUses.length > 0) {
                        newMessage.tool_calls = toolUses.map(tu => ({
                            id: tu.id,
                            type: 'function',
                            function: {
                                name: tu.name,
                                arguments: JSON.stringify(tu.input)
                            }
                        }));
                    }
                    openAIMessages.push(newMessage);
                } else {
                    // Standard User message with text content array
                    const text = msg.content.map(c => c.text || '').join('');
                    openAIMessages.push({ role: msg.role, content: text });
                }
            } else {
                // Simple string content
                openAIMessages.push({ role: msg.role, content: msg.content || '' });
            }
        });

        // 2. Build OpenAI Request Payload
        const payload = {
            model: model,
            messages: openAIMessages,
            stream: stream,
            temperature: temperature,
            max_tokens: max_tokens,
            stop: stop_sequences
        };

        // 3. Map Tools
        if (tools && tools.length > 0) {
            payload.tools = tools.map(t => ({
                type: 'function',
                function: {
                    name: t.name,
                    description: t.description,
                    parameters: t.input_schema
                }
            }));
        }

        // 4. Map Tool Choice
        if (tool_choice) {
            if (tool_choice.type === 'auto') payload.tool_choice = 'auto';
            if (tool_choice.type === 'any') payload.tool_choice = 'required';
            if (tool_choice.type === 'tool') {
                payload.tool_choice = {
                    type: 'function',
                    function: { name: tool_choice.name }
                };
            }
        }

        return payload;
    }

    /**
     * Transforms an OpenAI streaming chunk back into an Anthropic SSE chunk
     */
    static fromOpenAIStream(openaiChunk, index) {
        const delta = openaiChunk.choices?.[0]?.delta;

        // Return null if no delta (e.g. usage chunk or empty)
        if (!delta) return null;

        // 1. Handle Text Content
        if (delta.content) {
            return {
                type: "content_block_delta",
                index: index,
                delta: {
                    type: "text_delta",
                    text: delta.content
                }
            };
        }

        // 2. Handle Tool Calls
        if (delta.tool_calls && delta.tool_calls.length > 0) {
            const toolCall = delta.tool_calls[0];
            const i = toolCall.index;

            // Start of tool call (has ID) -> Map to content_block_start
            if (toolCall.id) {
                return {
                    type: "content_block_start",
                    index: i,  // Use the tool call index as the block index
                    content_block: {
                        type: "tool_use",
                        id: toolCall.id,
                        name: toolCall.function?.name || '',
                        input: {} // Input built via deltas
                    }
                };
            }

            // Tool call arguments delta -> Map to input_json_delta
            if (toolCall.function && toolCall.function.arguments) {
                return {
                    type: "content_block_delta",
                    index: i,
                    delta: {
                        type: "input_json_delta",
                        partial_json: toolCall.function.arguments
                    }
                };
            }
        }

        // 3. Handle Finish (optional, usually handled by message_delta/stop from gateway)
        // But if we wanted to be explicit, we could return message_delta here if finish_reason exists.
        // Gateway likely handles the stream end.

        return null;
    }
}
