import { StashClient } from "stashapp-api";

let stashInstance: StashClient | null = null;

export function setStashInstance(instance: StashClient) {
    stashInstance = instance;
}

export function getStashInstance(): StashClient {
    if (!stashInstance) {
        throw new Error(
            "StashClient instance not initialized. Call setStashInstance() first."
        );
    }
    return stashInstance;
}
