import { Performer, PerformerFields } from "stashapp-api";
import { buildMenu } from "../commands/menus/buildMenu.js";
import { getAnalyzeMenuItems } from "../commands/menus/menuItems.js";
import { getStashInstance } from "../stash.js";
import { calculatePercent } from "../utils/format.js";
import { hydratePerformersWithMetadata } from "../utils/performers.js";
import {
    input,
    loadingText,
    print,
    selectMenu,
    yesOrNo,
} from "../utils/terminal.js";
import { favoritePerformersController } from "./performers/favoritePerformers.js";

export const analyzePerformersController = async () => {
    const stash = getStashInstance();

    print("Which Performers would you like to analyze?", "yellow");

    const { selectedText: gender } = await selectMenu(["Female", "Male"]);

    const sceneCountMinStr = await input(
        "Enter the minimum number of Scenes a Performer can have to be considered (default 3)",
        "3"
    );
    const sceneCountMin = parseInt(sceneCountMinStr, 10);

    print(
        `\nGreat! We'll look for ${gender} Performers appearing in ${sceneCountMin} or more Scenes.\n`,
        "cyan"
    );

    const finishQuerying = await loadingText("Querying your Stash instance");

    const {
        findPerformers: { count, performers: rawPerformers } = { count: 0, performers: [] },
    } = await stash.query({
        findPerformers: {
            __args: {
                filter: {
                    per_page: -1,
                },
                performer_filter: {
                    gender: {
                        modifier: 'EQUALS',
                        value: gender.toUpperCase() as 'MALE' | 'FEMALE',
                    },
                    scene_count: {
                        modifier: 'GREATER_THAN',
                        value: sceneCountMin - 1,
                    },
                },
            },
            count: true,
            performers: {
                ...PerformerFields,
                scenes: { id: true, o_counter: true },
            },
        },
    });

    const performers = rawPerformers as Performer[];

    finishQuerying(`\nSuccess! Found ${count} matching Performers.`);

    const finishAnalyzing = await loadingText("\nPerforming analysis");

    const performersHydrated = hydratePerformersWithMetadata(performers);

    const performersCumTo = [...performersHydrated].filter((performer) => {
        return (
            performer.o_counter !== undefined &&
            (performer.o_counter ?? 0) > 0
        );
    });

    const percentCumTo = calculatePercent(
        performersCumTo.length,
        count
    ).toFixed(2);

    finishAnalyzing();

    print("I've completed my analysis of your Performers.\n", "green");

    print("Out of ");
    print(count.toString(), "green");
    print(` ${gender}`, "magenta");
    print(" Performers, you've cum to Scenes from ");
    print(performersCumTo.length.toString(), "green");
    print(` (${percentCumTo}%)`, "magenta");
    print(" of them.\n");

    const shouldShowFavorites = await yesOrNo(
        "Would you like to hear about your favorites?"
    );
    print("\n");
    if (shouldShowFavorites) {
        await favoritePerformersController(performersCumTo);
    }

    await buildMenu(getAnalyzeMenuItems());
};
