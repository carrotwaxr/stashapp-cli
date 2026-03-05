import chalk from "chalk";
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

    // Fetch all studios in a single query
    const {
        findStudios: { count, studios },
    } = await stash.query({
        findStudios: {
            __args: {
                filter: {
                    per_page: -1,
                },
            },
            count: true,
            studios: {
                id: true,
                name: true,
                performer_count: true,
            },
        },
    });
    console.log(chalk.green("Found", count, "Studios containing at least one Scene."));

    // Fetch ALL scenes in a single query instead of N+1 per-studio queries
    console.log(chalk.blue("Fetching all scenes for aggregation..."));
    const {
        findScenes: { scenes: allScenes },
    } = await stash.query({
        findScenes: {
            __args: {
                filter: {
                    per_page: -1,
                },
            },
            scenes: {
                id: true,
                o_counter: true,
                studio: { id: true },
                files: { size: true },
            },
        },
    });

    // Aggregate scene data per studio in memory
    const studioAggMap = new Map<
        string,
        { scene_count: number; filesize: number; o_counter: number }
    >();

    for (const scene of allScenes) {
        const studioId = scene.studio?.id;
        if (!studioId) continue;

        const agg = studioAggMap.get(studioId) ?? {
            scene_count: 0,
            filesize: 0,
            o_counter: 0,
        };

        agg.scene_count += 1;
        for (const f of scene.files ?? []) {
            agg.filesize += Number(f.size) || 0;
        }
        agg.o_counter += scene.o_counter ?? 0;

        studioAggMap.set(studioId, agg);
    }

    // Build hydrated results by joining studios with aggregated scene data
    const hydratedResults = studios
        .map((studio) => {
            const agg = studioAggMap.get(studio.id) ?? {
                scene_count: 0,
                filesize: 0,
                o_counter: 0,
            };
            return {
                ...studio,
                scene_count: agg.scene_count,
                filesize: agg.filesize,
                o_counter: agg.o_counter,
                o_percent: agg.scene_count > 0
                    ? calculatePercent(agg.o_counter, agg.scene_count)
                    : 0,
            };
        })
        .filter((s) => s.scene_count > 0);

    console.log(chalk.green("Aggregation completed."));

    const sortedByTotalDesc = [...hydratedResults].sort((a, b) => {
        return b.o_counter - a.o_counter;
    });
    const favoritesByTotal = sortedByTotalDesc.slice(0, 100);
    const favoritesByTotalTable = convertToTable(favoritesByTotal, columns);
    console.log(chalk.green('Your Top 100 Studios by "Total Os" are:'));
    console.table(favoritesByTotalTable);

    const sortedByPercentDesc = [...hydratedResults].sort((a, b) => {
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
