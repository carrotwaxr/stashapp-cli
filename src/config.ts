import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { input, print } from "./utils/terminal.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.resolve(__dirname, "../config/secrets.json");

export type StashConfig = {
    url: string;
    apiKey: string;
};

export function ensureConfigFile(): StashConfig | null {
    if (!fs.existsSync(CONFIG_PATH)) {
        // Prompt user for URL and API Key
        // For now, create an empty config file
        fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
        fs.writeFileSync(
            CONFIG_PATH,
            JSON.stringify({ url: "", apiKey: "" }, null, 2)
        );
        return null;
    }
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    return JSON.parse(raw);
}

export function saveConfig(config: StashConfig) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

export async function promptForConfig(): Promise<StashConfig> {
    print("Please enter your Stash GraphQL server URL:", "yellow");
    const url = await input("Stash GraphQL server URL");
    print("\nPlease enter your Stash API Key:", "yellow");
    const apiKey = await input("Stash API Key");
    return { url, apiKey };
}
