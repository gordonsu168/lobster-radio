import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createOptionalModel } from "../lib/model.js";
export class MoodAnalyzerAgent {
    async analyze(input) {
        const model = createOptionalModel();
        if (!model) {
            return {
                summary: `The listener selected ${input.selectedMood} during the ${input.timeOfDay}. Keep the station aligned with that pacing and avoid abrupt transitions.`
            };
        }
        const result = await model.invoke([
            new SystemMessage("You are MoodAnalyzer, an assistant for an AI radio app. Summarize the user's likely listening state in 2 concise sentences."),
            new HumanMessage(`Selected mood: ${input.selectedMood}\nTime of day: ${input.timeOfDay}\nWeather API available: ${Boolean(input.weatherApiKey)}`)
        ]);
        return {
            summary: typeof result.content === "string" ? result.content : JSON.stringify(result.content)
        };
    }
}
