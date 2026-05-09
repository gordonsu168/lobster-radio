import { ChatOpenAI } from "@langchain/openai";

export function createOptionalModel() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  return new ChatOpenAI({
    apiKey,
    model: "gpt-4o-mini",
    temperature: 0.7
  });
}
