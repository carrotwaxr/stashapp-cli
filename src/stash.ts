import { StashApp } from "stashapp-api";

let stashInstance: StashApp | null = null;

export function setStashInstance(instance: StashApp) {
    stashInstance = instance;
}

export function getStashInstance(): StashApp {
    if (!stashInstance) {
        throw new Error(
            "StashApp instance not initialized. Call setStashInstance() first."
        );
    }
    return stashInstance;
}
