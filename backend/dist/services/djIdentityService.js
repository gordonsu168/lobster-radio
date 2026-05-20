import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
const __dirname = fileURLToPath(new URL(".", import.meta.url));
// 假设 DJ_IDENTITY.md 位于项目根目录
const IDENTITY_FILE = join(__dirname, "../../../DJ_IDENTITY.md");
const PERSONA_FILE = join(__dirname, "../../../DJ_PERSONA.md");
export function getDJIdentity() {
    try {
        const content = readFileSync(IDENTITY_FILE, "utf-8");
        return parseIdentityMarkdown(content);
    }
    catch (error) {
        console.error("Failed to read DJ identity file, using default:", error);
        return {
            name: "星河",
            englishName: "Echo",
            programName: "星河捕手",
            englishProgramName: "Galaxy Catcher",
            persona: "深夜治愈系电台 DJ",
            englishPersona: "Healing late-night radio DJ"
        };
    }
}
export function saveDJIdentity(identity) {
    const content = `# DJ Identity

- **Name**: ${identity.name}
- **English Name**: ${identity.englishName}
- **Program Name**: ${identity.programName}
- **English Program Name**: ${identity.englishProgramName}
- **Persona**: ${identity.persona}
- **English Persona**: ${identity.englishPersona}
`;
    writeFileSync(IDENTITY_FILE, content, "utf-8");
}
export function getDJPersona() {
    try {
        return readFileSync(PERSONA_FILE, "utf-8");
    }
    catch (error) {
        console.error("Failed to read DJ persona file:", error);
        return "";
    }
}
export function saveDJPersona(content) {
    writeFileSync(PERSONA_FILE, content, "utf-8");
}
function parseIdentityMarkdown(content) {
    const identity = {};
    const mappings = {
        "Name": "name",
        "English Name": "englishName",
        "Program Name": "programName",
        "English Program Name": "englishProgramName",
        "Persona": "persona",
        "English Persona": "englishPersona"
    };
    const lines = content.split("\n");
    for (const line of lines) {
        const match = line.match(/-\s*\*\*(.*?)\*\*:\s*(.*)/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim();
            if (mappings[key]) {
                identity[mappings[key]] = value;
            }
        }
    }
    return {
        name: identity.name || "星河",
        englishName: identity.englishName || "Echo",
        programName: identity.programName || "星河捕手",
        englishProgramName: identity.englishProgramName || "Galaxy Catcher",
        persona: identity.persona || "深夜治愈系电台 DJ",
        englishPersona: identity.englishPersona || "Healing late-night radio DJ"
    };
}
