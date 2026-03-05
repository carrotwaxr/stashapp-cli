import type { Scene, Studio } from "stashapp-api";
import type { UserOrganizationDetails } from "./types.js";

export const filterScenesByPerformerSelections = (
    scenes: Scene[],
    maleFilter: boolean,
    femaleFilter: boolean
): Scene[] => {
    if (!maleFilter && !femaleFilter) return scenes;

    return scenes.filter((scene) => {
        const hasMalePerformer = scene.performers.some(
            (p) => p.gender === 'MALE'
        );
        const hasFemalePerformer = scene.performers.some(
            (p) => p.gender === 'FEMALE'
        );

        if (maleFilter && femaleFilter)
            return hasMalePerformer && hasFemalePerformer;

        if (maleFilter) return hasMalePerformer;

        if (femaleFilter) return hasFemalePerformer;

        return false;
    });
};

export const generatePerformerFolders = (
    scene: Scene,
    organizationDetails: UserOrganizationDetails
) => {
    const matchingPerformers = scene.performers.filter(
        (p) => p.gender === organizationDetails.performerGender
    );

    const favoritedPerformers = matchingPerformers.filter(
        (p) => p.favorite === true
    );
    const filteredPerformers =
        favoritedPerformers.length > 0
            ? favoritedPerformers
            : matchingPerformers;

    const sortedPerformers = [...filteredPerformers].sort(
        (a, b) => (b.o_counter ?? 0) - (a.o_counter ?? 0)
    );
    const topPerformer = sortedPerformers[0];
    return [topPerformer.name];
};

export const generateStudioFolders = (
    scene: Scene,
    studios: Studio[],
    organizationDetails: UserOrganizationDetails
) => {
    if (organizationDetails.studioStructure === "Flat") {
        return [scene.studio?.name];
    }

    const ancestors: Studio[] = [];
    let currentStudio: Studio | undefined = studios.find(
        (s) => s.name === scene.studio?.name
    );
    ancestors.push(currentStudio as Studio);
    while (currentStudio && currentStudio.parent_studio) {
        const parent = studios.find(
            (s) => s.name === (currentStudio as Studio).parent_studio?.name
        );
        if (parent) {
            ancestors.push(parent);
            currentStudio = parent;
        } else {
            break;
        }
    }

    return ancestors.reverse().map((a) => a.name);
};
