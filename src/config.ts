import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { input, print } from "./utils/terminal.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENV_PATH = path.resolve(__dirname, "../.env");

export type StashConfig = {
    url: string;
    apiKey: string;
};

export function loadConfig(): StashConfig | null {
    const url = process.env.STASH_URL;
    const apiKey = process.env.STASH_API_KEY;

    if (url && apiKey) {
        return { url, apiKey };
    }
    return null;
}

export function saveConfigToEnv(config: StashConfig) {
    const lines = [
        `STASH_URL=${config.url}`,
        `STASH_API_KEY=${config.apiKey}`,
        "",
        "# Path prefix inside Stash's Docker container (default: /data)",
        "STASH_DATA_PATH=/data",
        "",
    ];
    fs.writeFileSync(ENV_PATH, lines.join("\n"));
}

export async function promptForConfig(): Promise<StashConfig> {
    print("Please enter your Stash GraphQL server URL:", "yellow");
    const url = await input("Stash GraphQL server URL");
    print("\nPlease enter your Stash API Key:", "yellow");
    const apiKey = await input("Stash API Key");
    return { url, apiKey };
}
