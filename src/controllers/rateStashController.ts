/**
 * Rate Stash Controller
 *
 * This controller calculates ratings for Studios, Tags, Performers, and Scenes,
 * then optionally updates the Stash server with these calculated ratings.
 *
 * Features:
 * - User prompts after each rating category (except Tags - they don't support ratings)
 * - Throttled API calls with configurable delays to prevent server overload
 * - Progress bars during update operations
 * - Individual updates for performers, studios, and scenes (each with unique ratings)
 *
 * Configuration:
 * - Adjust `updateConfig` values in the main function to control throttling
 * - `delayBetweenRequests`: Time between individual API calls (default: 500ms)
 */

import chalk from "chalk";
import {
    CriterionModifier,
    GenderEnum,
    Performer,
    Scene,
    Studio,
    Tag,
} from "stashapp-api";
import { backCommand } from "../commands/back.js";
import { buildMenu } from "../commands/menus/buildMenu.js";
import { getAnalyzeMenuItems } from "../commands/menus/menuItems.js";
import { getStashInstance } from "../stash.js";
import {
    ArtifactRated,
    logArtifactRatings,
    PerformerRated,
    rateArtifacts,
    rateScenes,
    SceneRated,
    StudioRated,
    TagRated,
} from "../utils/rating.js";
import { loadingText, print, yesOrNo } from "../utils/terminal.js";

// Configuration for rate limiting
interface UpdateConfig {
    delayBetweenRequests: number; // milliseconds between individual requests
    maxBatchSize: number; // maximum items per batch for bulk operations
    delayBetweenBatches: number; // milliseconds between batches
}

// Default configuration - easily adjustable
const DEFAULT_UPDATE_CONFIG: UpdateConfig = {
    delayBetweenRequests: 200, // 200ms between individual requests
    maxBatchSize: 100, // 100 scenes per batch
    delayBetweenBatches: 1000, // 1 second between batches
};

// Sleep utility
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Progress bar utility using terminal-kit
const createProgressBar = (total: number, label: string) => {
    let current = 0;
    const update = (increment: number = 1) => {
        current += increment;
        const percentage = Math.round((current / total) * 100);
        const filled = Math.round((current / total) * 30);
        const empty = 30 - filled;
        const bar = "█".repeat(filled) + "░".repeat(empty);
        process.stdout.write(
            `\r${chalk.blue(label)}: [${chalk.green(bar)}] ${percentage}% (${current}/${total})`
        );
        if (current >= total) {
            console.log(); // New line when complete
        }
    };
    return { update };
};

// Update scenes in batches
const updateScenesWithRatings = async (
    scenesToUpdate: { id: string; rating: number }[],
    config: UpdateConfig = DEFAULT_UPDATE_CONFIG
) => {
    const stash = getStashInstance();
    const progressBar = createProgressBar(
        scenesToUpdate.length,
        "Updating scenes"
    );

    // Since each scene has a different rating, we need to update them individually
    // even though we have a bulk update method, it only supports one rating for all scenes
    for (const scene of scenesToUpdate) {
        try {
            await stash.sceneUpdate({
                input: {
                    id: scene.id,
                    rating100: scene.rating,
                },
            });
            progressBar.update();
            await sleep(config.delayBetweenRequests);
        } catch (error) {
            console.error(`\nError updating scene ${scene.id}: ${error}`);
            progressBar.update(); // Still update progress
        }
    }
};

// Update performers individually
const updatePerformersWithRatings = async (
    performersToUpdate: { id: string; rating: number }[],
    config: UpdateConfig = DEFAULT_UPDATE_CONFIG
) => {
    const stash = getStashInstance();
    const progressBar = createProgressBar(
        performersToUpdate.length,
        "Updating performers"
    );

    for (const performer of performersToUpdate) {
        try {
            await stash.performerUpdate({
                input: {
                    id: performer.id,
                    rating100: performer.rating,
                },
            });
            progressBar.update();
            await sleep(config.delayBetweenRequests);
        } catch (error) {
            console.error(
                `\nError updating performer ${performer.id}: ${error}`
            );
            progressBar.update(); // Still update progress
        }
    }
};

// Update studios individually
const updateStudiosWithRatings = async (
    studiosToUpdate: { id: string; rating: number }[],
    config: UpdateConfig = DEFAULT_UPDATE_CONFIG
) => {
    const stash = getStashInstance();
    const progressBar = createProgressBar(
        studiosToUpdate.length,
        "Updating studios"
    );

    for (const studio of studiosToUpdate) {
        try {
            await stash.studioUpdate({
                input: {
                    id: studio.id,
                    rating100: studio.rating,
                },
            });
            progressBar.update();
            await sleep(config.delayBetweenRequests);
        } catch (error) {
            console.error(`\nError updating studio ${studio.id}: ${error}`);
            progressBar.update(); // Still update progress
        }
    }
};

// Prompt user and update ratings - generic version
const promptAndUpdateRatings = async (
    ratedItems: ArtifactRated[],
    type: "studios" | "performers",
    displayName: string,
    config: UpdateConfig = DEFAULT_UPDATE_CONFIG
) => {
    console.log(); // Add spacing
    const shouldUpdate = await yesOrNo(
        `Would you like to update the ${displayName.toLowerCase()} on your Stash server with these calculated ratings?`
    );

    if (!shouldUpdate) {
        print(`Skipping ${displayName.toLowerCase()} updates.`, "yellow");
        return;
    }

    const itemsToUpdate = ratedItems.map((item) => ({
        id: item.id,
        rating: Math.floor(item.rating100),
    }));

    print(
        `\nUpdating ${itemsToUpdate.length} ${displayName.toLowerCase()}...`,
        "blue"
    );

    switch (type) {
        case "performers":
            await updatePerformersWithRatings(itemsToUpdate, config);
            break;
        case "studios":
            await updateStudiosWithRatings(itemsToUpdate, config);
            break;
    }

    print(`✅ ${displayName} ratings updated successfully!`, "green");
};

// Specific function for scenes
const promptAndUpdateSceneRatings = async (
    ratedScenes: SceneRated[],
    displayName: string,
    config: UpdateConfig = DEFAULT_UPDATE_CONFIG
) => {
    console.log(); // Add spacing
    const shouldUpdate = await yesOrNo(
        `Would you like to update the ${displayName.toLowerCase()} on your Stash server with these calculated ratings?`
    );

    if (!shouldUpdate) {
        print(`Skipping ${displayName.toLowerCase()} updates.`, "yellow");
        return;
    }

    const scenesToUpdate = ratedScenes.map((scene) => ({
        id: scene.id,
        rating: Math.floor(scene.rating100),
    }));

    print(
        `\nUpdating ${scenesToUpdate.length} ${displayName.toLowerCase()}...`,
        "blue"
    );
    await updateScenesWithRatings(scenesToUpdate, config);
    print(`✅ ${displayName} ratings updated successfully!`, "green");
};

export const rateStashController = async () => {
    print(
        "\nThis command will look up all Studios, Tags, Performers, and Scenes and give them a rating on a scale of 1 to 100.\n",
        "yellow"
    );

    const updateConfig = DEFAULT_UPDATE_CONFIG;

    const stash = getStashInstance();

    let finishLoading = await loadingText("Loading Scenes...");
    const {
        findScenes: { scenes },
    } = await stash.findScenes({
        filter: {
            per_page: -1,
        },
    });
    finishLoading();

    finishLoading = await loadingText("Loading Male Performers...");
    const {
        findPerformers: { performers: malePerformers },
    } = await stash.findPerformers({
        filter: {
            per_page: -1,
        },
        performer_filter: {
            gender: {
                modifier: CriterionModifier.Equals,
                value: GenderEnum.Male,
            },
            scene_count: {
                modifier: CriterionModifier.GreaterThan,
                value: 0,
            },
        },
    });
    finishLoading();

    finishLoading = await loadingText("Loading Female Performers...");
    const {
        findPerformers: { performers: femalePerformers },
    } = await stash.findPerformers({
        filter: {
            per_page: -1,
        },
        performer_filter: {
            gender: {
                modifier: CriterionModifier.Equals,
                value: GenderEnum.Female,
            },
            o_counter: {
                modifier: CriterionModifier.GreaterThan,
                value: 0,
            },
            scene_count: {
                modifier: CriterionModifier.GreaterThan,
                value: 0,
            },
        },
    });
    finishLoading();

    finishLoading = await loadingText("Loading Studios...");

    const {
        findStudios: { studios },
    } = await stash.findStudios({
        filter: { per_page: -1 },
        studio_filter: {
            scene_count: {
                modifier: CriterionModifier.GreaterThan,
                value: 0,
            },
        },
    });
    finishLoading();

    finishLoading = await loadingText("Loading Tags...");
    const {
        findTags: { tags },
    } = await stash.findTags({
        filter: {
            per_page: -1,
        },
        tag_filter: {
            scene_count: {
                modifier: CriterionModifier.GreaterThan,
                value: 0,
            },
        },
    });
    finishLoading();

    console.log();
    console.log(chalk.gray("----------------------------------------"));
    console.log(chalk.blue(`Studios found:    ${studios.length}`));
    console.log(chalk.magenta(`Tags found:      ${tags.length}`));
    console.log(
        chalk.yellow(`Male Performers found: ${malePerformers.length}`)
    );
    console.log(
        chalk.yellow(`Female Performers found: ${femalePerformers.length}`)
    );
    console.log(chalk.green(`Scenes found:    ${scenes.length}`));
    console.log(chalk.gray("----------------------------------------"));

    const ratedStudios: ArtifactRated[] = rateArtifacts(
        "studio",
        studios as Studio[],
        scenes.filter((scene) => scene.studio?.id) as Scene[]
    );

    logArtifactRatings(ratedStudios, "Studios");

    // Prompt to update studios
    await promptAndUpdateRatings(
        ratedStudios,
        "studios",
        "Studios",
        updateConfig
    );

    const ratedTags: ArtifactRated[] = rateArtifacts(
        "tag",
        tags as Tag[],
        scenes.filter((scene) => scene.tags?.length) as Scene[]
    );

    logArtifactRatings(ratedTags, "Tags");
    // Note: Tags cannot have ratings on the server, so we skip the update prompt

    const ratedMalePerformers: ArtifactRated[] = rateArtifacts(
        "performer",
        malePerformers as Performer[],
        scenes.filter((scene) =>
            scene.performers?.some((p) => p.gender === GenderEnum.Male)
        ) as Scene[]
    );

    logArtifactRatings(ratedMalePerformers, "Male Performers");

    // Prompt to update male performers
    await promptAndUpdateRatings(
        ratedMalePerformers,
        "performers",
        "Male Performers",
        updateConfig
    );

    const ratedFemalePerformers: ArtifactRated[] = rateArtifacts(
        "performer",
        femalePerformers as Performer[],
        scenes.filter((scene) =>
            scene.performers?.some((p) => p.gender === GenderEnum.Female)
        ) as Scene[]
    );

    logArtifactRatings(ratedFemalePerformers, "Female Performers");

    // Prompt to update female performers
    await promptAndUpdateRatings(
        ratedFemalePerformers,
        "performers",
        "Female Performers",
        updateConfig
    );

    const ratedScenes: SceneRated[] = rateScenes(
        scenes as Scene[],
        ratedStudios as StudioRated[],
        ratedTags as TagRated[],
        [...ratedMalePerformers, ...ratedFemalePerformers] as PerformerRated[]
    );

    console.log(`Using formula: ${ratedScenes[0].ratingFormulaExplained}`);
    console.log(chalk.blue("Your Top 50 Scenes:"));
    ratedScenes.slice(0, 50).forEach((scene) => {
        console.log(
            chalk.green(
                `- ${scene.studio?.name} - ${scene.title}: ${scene.rating100} = ${scene.ratingFormula}`
            )
        );
    });

    // Prompt to update scenes
    await promptAndUpdateSceneRatings(ratedScenes, "Scenes", updateConfig);

    // Return to previous menu
    await backCommand(() => buildMenu(getAnalyzeMenuItems()));
};
