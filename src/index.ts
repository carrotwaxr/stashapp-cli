import "dotenv/config";
import { StashApp } from "stashapp-api";
import { buildMenu } from "./commands/menus/buildMenu.js";
import { getMainMenuItems } from "./commands/menus/menuItems.js";
import { ensureConfigFile, promptForConfig, saveConfig } from "./config.js";
import { setStashInstance } from "./stash.js";

export const start = async () => {
    let config = ensureConfigFile();
    if (!config || !config.url || !config.apiKey) {
        config = await promptForConfig();
        saveConfig(config);
        console.log("Config saved. Please restart the app.");
        process.exit(0);
    }
    // Establish connection to StashApp
    const stash = StashApp.init({ url: config.url, apiKey: config.apiKey });
    setStashInstance(stash);

    buildMenu(getMainMenuItems());
};

start();
