import type { Scene } from "stashapp-api";
import { describe, expect, it } from "vitest";
import { filterScenesByPerformerSelections } from "../folders.js";

const makeScene = (performers: Array<{ gender: string }> = []): Scene => ({
    id: "1",
    performers: performers.map((p, i) => ({
        id: `p${i}`,
        name: `Performer ${i}`,
        ...p,
    })),
} as Scene);

describe("filterScenesByPerformerSelections", () => {
    const scenes = [
        makeScene([{ gender: "MALE" }, { gender: "FEMALE" }]),
        makeScene([{ gender: "FEMALE" }]),
        makeScene([{ gender: "MALE" }]),
    ];

    it("returns all scenes when no filter", () => {
        expect(filterScenesByPerformerSelections(scenes, false, false)).toHaveLength(3);
    });

    it("filters to male-only scenes", () => {
        const result = filterScenesByPerformerSelections(scenes, true, false);
        expect(result).toHaveLength(2); // first and third have males
    });

    it("filters to female-only scenes", () => {
        const result = filterScenesByPerformerSelections(scenes, false, true);
        expect(result).toHaveLength(2); // first and second have females
    });

    it("filters to scenes with both male and female", () => {
        const result = filterScenesByPerformerSelections(scenes, true, true);
        expect(result).toHaveLength(1); // only first has both
    });

    it("returns empty for no matches", () => {
        const femaleOnly = [makeScene([{ gender: "FEMALE" }])];
        expect(filterScenesByPerformerSelections(femaleOnly, true, false)).toHaveLength(0);
    });
});
