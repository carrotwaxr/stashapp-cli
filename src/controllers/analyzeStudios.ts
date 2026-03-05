import chalk from "chalk";
import { CriterionModifier } from "stashapp-api";
import { buildMenu } from "../commands/menus/buildMenu.js";
import { getAnalyzeMenuItems } from "../commands/menus/menuItems.js";
import { getStashInstance } from "../stash.js";
import { calculatePercent, formatBytes } from "../utils/format.js";
import { convertToTable } from "../utils/table.js";

const columns = [
    "name",
    { name: "o_percent", render: (value: number) => `${Math.ceil(value)}%` },
    "scene_count",
    "filesize",
    "o_counter",
    "performer_count",
];

export const analyzeStudiosController = async () => {
    console.log(chalk.blue("Analyzing Studios in the Stash..."));

    const stash = getStashInstance();
    // Fetch all studios using stash instance
    const {
        findStudios: { count, studios },
    } = await stash.findStudios({
        filter: {
            per_page: -1,
        },
    });
    console.log(chalk.green("Found", count, "Studios containing at least one Scene."));

    let hydratedResults = [];
    console.log(chalk.blue("Hydrating Studios with Scene data..."));
    for (const studio of studios) {
        // Fetch scenes for each studio using stash instance
        const {
            findScenes: { count: sceneCount, filesize, scenes },
        } = await stash.findScenes({
            filter: {
                per_page: -1,
            },
            scene_filter: {
                studios: {
                    modifier: CriterionModifier.Includes,
                    value: [studio.id],
                },
            },
        });

        const totalOs = scenes.reduce((acc: any, scene: any) => {
            return (
                acc +
                (scene.o_counter !== undefined
                    ? parseInt(scene.o_counter as any)
                    : 0)
            );
        }, 0);

        const oPercent = calculatePercent(totalOs, sceneCount);

        hydratedResults.push({
            ...studio,
            count: sceneCount,
            filesize,
            o_counter: totalOs,
            o_percent: oPercent,
        });
    }
    console.log(chalk.green("Hydration completed."));

    const sortedByTotalDesc = hydratedResults.sort((a, b) => {
        return b.o_counter - a.o_counter;
    });
    const favoritesByTotal = sortedByTotalDesc.slice(0, 100);
    const favoritesByTotalTable = convertToTable(favoritesByTotal, columns);
    console.log(chalk.green('Your Top 100 Studios by "Total Os" are:'));
    console.table(favoritesByTotalTable);

    const sortedByPercentDesc = hydratedResults.sort((a, b) => {
        return b.o_percent - a.o_percent;
    });
    const favoritesByPercent = sortedByPercentDesc.slice(0, 100);
    const favoritesByPercentTable = convertToTable(favoritesByPercent, columns);
    console.log(chalk.green('Your Top 100 Studios by "O Frequency" are:'));
    console.table(favoritesByPercentTable);

    const cleanupCandidates = [...hydratedResults]
        .filter(({ o_percent }) => {
            return Math.floor(o_percent) < 10;
        })
        .sort((a, b) => b.filesize - a.filesize)
        .map((studio) => ({
            ...studio,
            filesize: formatBytes(studio.filesize),
        }));

    const cleanupCandidatesTable = convertToTable(cleanupCandidates, columns);

    console.log(chalk.green("Here are some Studios that are candidates for cleanup:"));
    console.table(cleanupCandidatesTable);

    await buildMenu(getAnalyzeMenuItems());
};
