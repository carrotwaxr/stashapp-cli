import "dotenv/config";
import { StashApp } from "stashapp-api";
import { buildMenu } from "./commands/menus/buildMenu.js";
import { getMainMenuItems } from "./commands/menus/menuItems.js";
import { loadConfig, promptForConfig, saveConfigToEnv } from "./config.js";
import { setStashInstance } from "./stash.js";

export const start = async () => {
    let config = loadConfig();
    if (!config) {
        config = await promptForConfig();
        saveConfigToEnv(config);
        // Re-set env vars so the rest of the app can use them
        process.env.STASH_URL = config.url;
        process.env.STASH_API_KEY = config.apiKey;
    }

    const stash = StashApp.init({ url: config.url, apiKey: config.apiKey });
    setStashInstance(stash);

    buildMenu(getMainMenuItems());
};

start();
