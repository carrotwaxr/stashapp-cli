import {
    CriterionModifier,
    GenderEnum,
    Performer,
    Scene,
    Studio,
    Tag,
} from "stashapp-api";
import { getStashInstance } from "../stash.js";
import { formatBytes } from "./format.js";
import { loadingText, print, rotatingColors } from "./terminal.js";

export const addScenesToFillSpace = async (
    availableBytes: number,
    scenesAlreadyIncluded: Scene[]
): Promise<Scene[]> => {
    const stash = getStashInstance();

    const { femalePerformers, malePerformers, studios, tags } =
        await getAllStashData();

    const favorites = {
        femalePerformers: filterFavorites(femalePerformers),
        malePerformers: filterFavorites(malePerformers),
        studios: filterFavorites(studios),
        tags: filterFavorites(tags),
    };

    print("Your favorite Female Performers are:", "yellow");
    rotatingColors(flattenByKey(favorites.femalePerformers, "name"));
    print("\n\n");

    print("Your favorite Male Performers are:", "yellow");
    rotatingColors(flattenByKey(favorites.malePerformers, "name"));
    print("\n\n");

    print("Your favorite Studios are:", "yellow");
    rotatingColors(flattenByKey(favorites.studios, "name"));
    print("\n\n");

    print("Your favorite Tags are:", "yellow");
    rotatingColors(flattenByKey(favorites.tags, "name"));
    print("\n\n");

    print(
        "Let's figure out how much space it would take to grab everything from these Favorites that you've cum to.",
        "green"
    );
    let clearLoading = await loadingText("Calculating, maybe fapping a little");

    const favoriteStudioIDs = flattenByKey(favorites.studios, "id").map(String);
    const {
        findScenes: { scenes: scenesFromFavoriteStudios } = { scenes: [] },
    } = await stash.findScenes({
        filter: { per_page: -1 },
        scene_filter: {
            studios: {
                modifier: CriterionModifier.Includes,
                value: favoriteStudioIDs,
            },
            o_counter: {
                modifier: CriterionModifier.GreaterThan,
                value: 0,
            },
        },
    });

    const favoriteTagIDs = flattenByKey(favorites.tags, "id").map(String);
    const { findScenes: { scenes: scenesFromFavoriteTags } = { scenes: [] } } =
        await stash.findScenes({
            filter: { per_page: -1 },
            scene_filter: {
                tags: {
                    modifier: CriterionModifier.Includes,
                    value: favoriteTagIDs,
                },
                o_counter: {
                    modifier: CriterionModifier.GreaterThan,
                    value: 0,
                },
            },
        });

    const {
        findScenes: { scenes: scenesFromFavoritePerformers } = { scenes: [] },
    } = await stash.findScenes({
        filter: { per_page: -1 },
        scene_filter: {
            performer_favorite: true,
        },
    });

    const favoriteScenes: any[] = [
        ...scenesFromFavoritePerformers,
        ...scenesFromFavoriteStudios,
        ...scenesFromFavoriteTags,
    ];

    const uniqueFavoriteScenes: any[] = dedupeScenes(favoriteScenes).filter(
        (scene: any) => {
            // remove Scenes already included by user selections
            const isAlreadyIncluded = scenesAlreadyIncluded.find(({ id }) => {
                return id === scene.id;
            });
            return !isAlreadyIncluded;
        }
    );
    const allFavoritesSize = getTotalSize(uniqueFavoriteScenes);
    const countDuplicates = favoriteScenes.length - uniqueFavoriteScenes.length;

    clearLoading(
        `I finished! I found ${uniqueFavoriteScenes.length} Scenes after removing ${countDuplicates} duplicates.`
    );

    print("The total size would be ", "cyan");
    print(formatBytes(allFavoritesSize, 2), "green");
    print("\n");

    let scenesToAdd = [...uniqueFavoriteScenes];

    if (allFavoritesSize > availableBytes) {
        print("Ah but this is too much, you horny devil!\n", "red");
        print(
            "Let me try to give each Scene a score based on just how much you love it.\n",
            "green"
        );

        const scored = scoreScenes(uniqueFavoriteScenes, favorites as any);
        const sortedByScore = sortScenesByCustomScore(scored);

        const reduced = reduceScenesToSize(sortedByScore, availableBytes);
        const reducedSize = getTotalSize(reduced);

        print(`Alright, I've reduced it by just enough to fit.\n`, "cyan");
        print("Filling with ");
        print(`${reduced.length} `, "green");
        print("Scenes totalling ");
        print(`${formatBytes(reducedSize, 2)}\n`, "blue");

        scenesToAdd = reduced;
    }

    return [...scenesAlreadyIncluded, ...scenesToAdd];
};

const getAllStashData = async (): Promise<any> => {
    const stash = getStashInstance();
    let clearLoading = await loadingText("Getting female Performers");
    const {
        findPerformers: { performers: femalePerformers } = { performers: [] },
    } = await stash.findPerformers({
        filter: { per_page: -1 },
        performer_filter: {
            gender: {
                modifier: CriterionModifier.Equals,
                value: GenderEnum.Female,
            },
        },
    });
    clearLoading("Done");

    clearLoading = await loadingText("Getting male Performers");
    const {
        findPerformers: { performers: malePerformers } = { performers: [] },
    } = await stash.findPerformers({
        filter: { per_page: -1 },
        performer_filter: {
            gender: {
                modifier: CriterionModifier.Equals,
                value: GenderEnum.Male,
            },
        },
    });
    clearLoading("Done");

    clearLoading = await loadingText("Getting Studios");
    const { findStudios: { studios } = { studios: [] } } =
        await stash.findStudios({ filter: { per_page: -1 } });
    clearLoading("Done");

    clearLoading = await loadingText("Getting Tags");
    const { findTags: { tags } = { tags: [] } } = await stash.findTags({
        filter: { per_page: -1 },
    });
    clearLoading("Done");

    return {
        femalePerformers,
        malePerformers,
        studios,
        tags,
    };
};

const getSceneTitle = (scene: Scene): string => {
    if (scene.title) {
        return scene.title;
    }

    const [videoFile] = scene.files;
    return videoFile.basename;
};

export const getTotalSize = (scenes: Scene[]): number => {
    return scenes.reduce((acc, scene) => {
        return acc + getVideoFileSize(scene);
    }, 0);
};

const getVideoFileSize = (scene: Scene): number => {
    const [videoFile] = scene.files;
    return videoFile.size;
};

const filterFavorites = <T extends { favorite?: boolean }>(arr: T[]): T[] => {
    return arr.filter(({ favorite }) => Boolean(favorite));
};

const flattenByKey = (arr: any[], key: string): any[] => {
    return arr.map((item) => item[key]);
};

const reduceScenesToSize = (scenes: Scene[], bytes: number): Scene[] => {
    let remainingBytes = bytes;

    return scenes.filter((scene) => {
        const sceneSize = getVideoFileSize(scene);
        const isAbleToFit = remainingBytes - sceneSize > 0;

        if (isAbleToFit) {
            remainingBytes -= sceneSize;
            return true;
        } else {
            return false;
        }
    });
};

const scoreScene = (
    scene: any,
    weights: { female: number; male: number; studio: number; tag: number }
): number => {
    // initial score will be the o_counter on the Scene
    const initialScore =
        typeof scene.o_counter === "number"
            ? scene.o_counter
            : parseInt(scene.o_counter as any) || 0;

    const performerScore = (scene.performers as any[]).reduce(
        (acc, performer) => {
            if (performer.favorite) {
                if (performer.gender === "FEMALE") {
                    acc += (performer.o_counter ?? 0) * weights.female;
                } else if (performer.gender === "MALE") {
                    acc += (performer.o_counter ?? 0) * weights.male;
                }
            }
            return acc;
        },
        0
    );

    const studioScore = scene.studio?.favorite ? weights.studio : 0;

    const tagScore = scene.tags.reduce((acc: number, tag: any) => {
        if (tag.favorite) {
            acc += weights.tag;
        }
        return acc;
    }, 0);

    const sceneScore = initialScore + performerScore + studioScore + tagScore;
    return sceneScore;
};

const scoreScenes = (
    scenes: Scene[],
    favorites: {
        femalePerformers: Performer[];
        malePerformers: Performer[];
        studios: Studio[];
        tags: Tag[];
    }
): Scene[] => {
    /** Calculate how heavily we should weight the o_counter for a Performer.
     * If there are more favorites Females than Males (male-centric hetero),
     *      the males will get a sub 1 multiplier making them being a favorite affect the score less
     * The inverses are of course true as well
     */

    const mfRatio =
        favorites.malePerformers.length / favorites.femalePerformers.length;
    const fmRatio =
        favorites.femalePerformers.length / favorites.malePerformers.length;

    const weights = {
        female: fmRatio >= 1 ? 1 : fmRatio,
        male: mfRatio >= 1 ? 1 : mfRatio,
        studio: 5,
        tag: 5,
    };

    // Use a type assertion to allow custom scoring property
    return scenes.map((scene) => {
        return Object.assign(scene, {
            phoenixCustomScoring: {
                score: scoreScene(scene, weights),
                title: getSceneTitle(scene),
            },
        });
    });
};

const sortScenesByCustomScore = (scenes: Scene[]): Scene[] => {
    return scenes.sort((a: any, b: any) => {
        return (
            (b.phoenixCustomScoring?.score ?? 0) -
            (a.phoenixCustomScoring?.score ?? 0)
        );
    });
};

export const dedupeScenes = (scenes: any[]): any[] => {
    return scenes.reduce<any[]>((acc, scene) => {
        const isAlreadyAccumulated = Boolean(
            acc.find(({ id }) => id === scene.id)
        );
        if (!isAlreadyAccumulated) {
            acc.push(scene);
        }
        return acc;
    }, []);
};

export const getUniquePerformers = (scenes: any[]): any[] => {
    return scenes.reduce<any[]>((acc, { performers }) => {
        (performers as any[]).forEach((performer: any) => {
            const isAlreadyAccumulated = Boolean(
                acc.find(({ id }) => id === performer.id)
            );
            if (!isAlreadyAccumulated) {
                acc.push(performer);
            }
        });
        return acc;
    }, []);
};
