import { ChatOpenAI } from "@langchain/openai";
export function createOptionalModel() {
    // Try DeepSeek first if API key is available
    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    if (deepseekKey) {
        return new ChatOpenAI({
            apiKey: deepseekKey,
            model: "deepseek-chat",
            temperature: 0.7,
            configuration: {
                baseURL: "https://api.deepseek.com",
            },
        });
    }
    // Fallback to OpenAI if API key is available
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
        return new ChatOpenAI({
            apiKey: openaiKey,
            model: "gpt-4o-mini",
            temperature: 0.7
        });
    }
    // No API key available
    return null;
}
