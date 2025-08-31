import { Performer, Scene } from "stashapp-api";
import {
    calculatePercent,
    formatHeight,
    formatInches,
    formatPercent,
    formatWeight,
} from "./format.js";
import { print } from "./terminal.js";

const getPerformerMetadata = (
    performer: Performer
): {
    countScenesCumTo: number;
    percentCumsToScenes: number;
    percentScenesCumTo: number;
} => {
    const scenesCumTo = performer.scenes.filter((scene: Scene) => {
        const oCounter = scene.o_counter ?? 0;
        return typeof oCounter === "number"
            ? oCounter > 0
            : parseInt(oCounter as any) > 0;
    });

    const countScenesCumTo = scenesCumTo.length;

    const percentCumsToScenes = calculatePercent(
        performer.o_counter ?? 0,
        performer.scene_count ?? 0
    );
    const percentScenesCumTo = calculatePercent(
        countScenesCumTo,
        performer.scene_count ?? 0
    );

    const metadata = {
        countScenesCumTo,
        percentCumsToScenes,
        percentScenesCumTo,
    };

    return metadata;
};

export type PerformerWithMetadata = Performer & {
    metadata: {
        countScenesCumTo: number;
        percentCumsToScenes: number;
        percentScenesCumTo: number;
    };
};

export const hydratePerformersWithMetadata = (
    performers: Performer[]
): PerformerWithMetadata[] => {
    return performers.map((performer) => {
        const metadata = getPerformerMetadata(performer);

        return {
            ...performer,
            metadata,
        };
    });
};

export const logFemalePerformer = async (
    performer: PerformerWithMetadata
): Promise<void> => {
    const firstName = performer.name.split(" ")[0];
    const tagNames = performer.tags.map(({ name }) => name);

    print(performer.name, "cyan");
    print(" - you've cum to her Scenes ");
    print(String(performer.o_counter ?? "0"), "magenta");
    print(" times! You have ");
    print(String(performer.scene_count ?? "0"), "green");
    print(" total Scenes, and you've cum to ");
    print(String(performer.metadata.countScenesCumTo), "green");
    print(` (${formatPercent(performer.metadata.percentScenesCumTo)})`, "blue");
    print(" of them.\n");

    print("  She's");
    if (performer.ethnicity) {
        print(` ${performer.ethnicity}`, "cyan");
    }
    if (performer.country) {
        const country = new Intl.DisplayNames(["en"], { type: "region" }).of(
            performer.country
        );
        print(" from");
        print(` ${country}`, "yellow");
    }

    let endOfSentence = !performer.eye_color && !performer.hair_color;
    const hasEyeColor = Boolean(performer.eye_color);
    const hasHairColor = Boolean(performer.hair_color);

    if (endOfSentence) {
        print(".\n");
    } else {
        print(" with ");
        if (hasEyeColor && typeof performer.eye_color === "string") {
            print(performer.eye_color, "cyan");
            print(" eyes");
            if (!hasHairColor) {
                print(".\n");
            } else {
                print(" and ");
            }
        }
        if (hasHairColor && typeof performer.hair_color === "string") {
            print(performer.hair_color, "yellow");
            print(" hair.\n");
        }
    }

    const hasHeight = Boolean(performer.height_cm);
    const hasMeasurements = Boolean(performer.measurements);
    const hasTitsRealness = Boolean(performer.fake_tits);
    const hasWeight = Boolean(performer.weight);
    const hasBodyInfo =
        hasHeight || hasMeasurements || hasTitsRealness || hasWeight;

    if (hasBodyInfo) {
        const [bust, waist, hips] = performer.measurements
            ? performer.measurements.split("-")
            : [null, null, null];

        print(`  ${firstName}`);
        if (hasHeight && typeof performer.height_cm === "number") {
            const height = formatHeight(performer.height_cm);
            print(" is ");
            print(height, "green");
            print(" tall");
            endOfSentence = !hasMeasurements && !hasTitsRealness && !hasWeight;
            const hasOneMoreBodyDetail =
                ((hasMeasurements || hasTitsRealness) && !hasWeight) ||
                (!hasMeasurements && !hasTitsRealness && hasWeight);
            if (endOfSentence) {
                print(".\n");
            } else if (hasOneMoreBodyDetail) {
                print(" and");
            } else {
                print(",");
            }
        }
        if (hasWeight && typeof performer.weight === "number") {
            const weight = formatWeight(performer.weight);
            print(" weighs ");
            print(weight, "green");
            endOfSentence = !hasMeasurements && !hasTitsRealness;
            if (endOfSentence) {
                print(".\n");
            } else if (!hasHeight) {
                print(" and");
            } else {
                print(", and");
            }
        }
        if (!endOfSentence) {
            print(" has ");
            if (hasTitsRealness && typeof performer.fake_tits === "string") {
                print(String(performer.fake_tits), "cyan");
                print(" ");
            }
            print("tits");
            if (hasMeasurements && waist !== null && !isNaN(Number(waist))) {
                print(" with a ");
                print(formatInches(Number(waist)), "green");
                print(" waist and ");
            }
            if (hasMeasurements && hips !== null && !isNaN(Number(hips))) {
                print(formatInches(Number(hips)), "magenta");
                print(" hips");
            }
            print(".\n");
        }
        if (tagNames.length) {
            print("  You've given her these tags: ");
            // Cycle through colors for each tag
            const colors: Array<
                "cyan" | "magenta" | "yellow" | "green" | "blue"
            > = ["cyan", "magenta", "yellow", "green", "blue"];
            tagNames.forEach((tag: string, idx: number) => {
                print(tag, colors[idx % colors.length]);
                print(" ");
            });
            print("\n");
        }
    }
};

export const logPerformer = (performer: any): Promise<void> | undefined => {
    if (performer.gender === "FEMALE") {
        return logFemalePerformer(performer);
    }
};
