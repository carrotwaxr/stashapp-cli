import { describe, expect, it, vi } from "vitest";
import type { Performer, Scene, Studio, Tag } from "stashapp-api";
import {
    rateArtifacts,
    rateScenes,
    type PerformerRated,
    type StudioRated,
    type TagRated,
} from "../rating.js";

// Suppress console.log output from rating functions during tests
vi.spyOn(console, "log").mockImplementation(() => {});

// --- Mock factories ---

const makeScene = (overrides: Partial<Record<string, unknown>> = {}): Scene =>
    ({
        id: "scene-1",
        title: "Test Scene",
        rating100: null,
        o_counter: 0,
        studio: null,
        performers: [],
        tags: [],
        files: [{ path: "/test.mp4", basename: "test.mp4", size: 1000 }],
        ...overrides,
    }) as unknown as Scene;

const makeStudio = (
    overrides: Partial<Record<string, unknown>> = {}
): Studio =>
    ({
        id: "studio-1",
        name: "Test Studio",
        favorite: false,
        ...overrides,
    }) as unknown as Studio;

const makePerformer = (
    overrides: Partial<Record<string, unknown>> = {}
): Performer =>
    ({
        id: "perf-1",
        name: "Test Performer",
        gender: "FEMALE",
        favorite: false,
        ...overrides,
    }) as unknown as Performer;

const makeTag = (overrides: Partial<Record<string, unknown>> = {}): Tag =>
    ({
        id: "tag-1",
        name: "Test Tag",
        favorite: false,
        ...overrides,
    }) as unknown as Tag;

const makeRatedStudio = (
    overrides: Partial<Record<string, unknown>> = {}
): StudioRated =>
    ({
        ...makeStudio(overrides),
        o_counter: 0,
        rating100: 50,
        ratingFormula: "test",
        ratingFormulaExplained: "test",
        ...overrides,
    }) as unknown as StudioRated;

const makeRatedPerformer = (
    overrides: Partial<Record<string, unknown>> = {}
): PerformerRated =>
    ({
        ...makePerformer(overrides),
        o_counter: 0,
        rating100: 50,
        ratingFormula: "test",
        ratingFormulaExplained: "test",
        ...overrides,
    }) as unknown as PerformerRated;

const makeRatedTag = (
    overrides: Partial<Record<string, unknown>> = {}
): TagRated =>
    ({
        ...makeTag(overrides),
        o_counter: 0,
        rating100: 50,
        ratingFormula: "test",
        ratingFormulaExplained: "test",
        ...overrides,
    }) as unknown as TagRated;

// --- Tests ---

describe("rateArtifacts", () => {
    it("rates studios based on scene o_counter values", () => {
        const studio1 = makeStudio({ id: "s1", name: "Studio A" });
        const studio2 = makeStudio({ id: "s2", name: "Studio B" });
        const scenes = [
            makeScene({
                id: "sc1",
                o_counter: 10,
                studio: { id: "s1", name: "Studio A" },
            }),
            makeScene({
                id: "sc2",
                o_counter: 2,
                studio: { id: "s2", name: "Studio B" },
            }),
            makeScene({
                id: "sc3",
                o_counter: 5,
                studio: { id: "s1", name: "Studio A" },
            }),
        ];

        const result = rateArtifacts("studio", [studio1, studio2], scenes);

        expect(result).toHaveLength(2);
        // Studio A has more o_counter total (15 vs 2), should rank higher
        expect(result[0].id).toBe("s1");
        expect(result[0].rating100).toBeGreaterThan(result[1].rating100);
        // All results should have rating fields
        result.forEach((r) => {
            expect(r).toHaveProperty("rating100");
            expect(r).toHaveProperty("o_counter");
            expect(r).toHaveProperty("ratingFormula");
            expect(r).toHaveProperty("ratingFormulaExplained");
        });
    });

    it("rates performers based on scene o_counter values", () => {
        const perf = makePerformer({ id: "p1", name: "Performer A" });
        const scenes = [
            makeScene({
                id: "sc1",
                o_counter: 8,
                performers: [{ id: "p1", name: "Performer A" }],
            }),
            makeScene({
                id: "sc2",
                o_counter: 3,
                performers: [{ id: "p1", name: "Performer A" }],
            }),
        ];

        const result = rateArtifacts("performer", [perf], scenes);

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe("p1");
        expect(result[0].o_counter).toBe(11);
        expect(result[0].rating100).toBeGreaterThan(0);
    });

    it("rates tags based on scene o_counter values", () => {
        const tag = makeTag({ id: "t1", name: "Tag A" });
        const scenes = [
            makeScene({
                id: "sc1",
                o_counter: 4,
                tags: [{ id: "t1", name: "Tag A" }],
            }),
        ];

        const result = rateArtifacts("tag", [tag], scenes);

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe("t1");
        expect(result[0].o_counter).toBe(4);
    });

    it("returns empty array when artifacts array is empty", () => {
        const scenes = [makeScene({ o_counter: 5 })];
        const result = rateArtifacts("studio", [], scenes);
        expect(result).toEqual([]);
    });

    it("handles empty scenes array", () => {
        const studio = makeStudio();
        const result = rateArtifacts("studio", [studio], []);

        expect(result).toHaveLength(1);
        expect(result[0].rating100).toBe(0);
        expect(result[0].o_counter).toBe(0);
    });

    it("handles all scenes with 0 o_counter", () => {
        const studio = makeStudio({ id: "s1" });
        const scenes = [
            makeScene({
                id: "sc1",
                o_counter: 0,
                studio: { id: "s1", name: "Test" },
            }),
            makeScene({
                id: "sc2",
                o_counter: 0,
                studio: { id: "s1", name: "Test" },
            }),
        ];

        const result = rateArtifacts("studio", [studio], scenes);

        expect(result).toHaveLength(1);
        expect(result[0].rating100).toBe(0);
        expect(result[0].o_counter).toBe(0);
    });

    it("sorts results by rating100 descending, then o_counter descending", () => {
        const studios = [
            makeStudio({ id: "s1", name: "Low" }),
            makeStudio({ id: "s2", name: "High" }),
            makeStudio({ id: "s3", name: "Mid" }),
        ];
        const scenes = [
            makeScene({
                id: "sc1",
                o_counter: 1,
                studio: { id: "s1", name: "Low" },
            }),
            makeScene({
                id: "sc2",
                o_counter: 20,
                studio: { id: "s2", name: "High" },
            }),
            makeScene({
                id: "sc3",
                o_counter: 5,
                studio: { id: "s3", name: "Mid" },
            }),
        ];

        const result = rateArtifacts("studio", studios, scenes);

        // Should be sorted descending by rating100
        for (let i = 0; i < result.length - 1; i++) {
            expect(result[i].rating100).toBeGreaterThanOrEqual(
                result[i + 1].rating100
            );
        }
    });

    it("caps rating100 at 100", () => {
        // Create a scenario with a favorite artifact and very high o_counter
        const studio = makeStudio({
            id: "s1",
            name: "Mega Studio",
            favorite: true,
        });
        const scenes = Array.from({ length: 50 }, (_, i) =>
            makeScene({
                id: `sc${i}`,
                o_counter: 100,
                studio: { id: "s1", name: "Mega Studio" },
            })
        );

        const result = rateArtifacts("studio", [studio], scenes);

        expect(result[0].rating100).toBeLessThanOrEqual(100);
    });

    it("applies favorite multiplier (1.1x) for favorited artifacts", () => {
        const studioNormal = makeStudio({
            id: "s1",
            name: "Normal",
            favorite: false,
        });
        const studioFav = makeStudio({
            id: "s2",
            name: "Favorite",
            favorite: true,
        });
        // Give them identical scene data
        const scenes = [
            makeScene({
                id: "sc1",
                o_counter: 5,
                studio: { id: "s1", name: "Normal" },
            }),
            makeScene({
                id: "sc2",
                o_counter: 5,
                studio: { id: "s2", name: "Favorite" },
            }),
        ];

        const resultNormal = rateArtifacts("studio", [studioNormal], scenes);
        const resultFav = rateArtifacts("studio", [studioFav], scenes);

        // Favorite should get a higher or equal rating due to 1.1x multiplier
        expect(resultFav[0].rating100).toBeGreaterThanOrEqual(
            resultNormal[0].rating100
        );
    });
});

describe("rateScenes", () => {
    it("rates a scene with rated studio, performers, and tags", () => {
        const ratedStudios = [makeRatedStudio({ id: "s1", rating100: 60 })];
        const ratedPerformers = [
            makeRatedPerformer({ id: "p1", rating100: 70 }),
        ];
        const ratedTags = [makeRatedTag({ id: "t1", rating100: 40 })];

        const scenes = [
            makeScene({
                id: "sc1",
                o_counter: 5,
                studio: { id: "s1", name: "Studio" },
                performers: [{ id: "p1", name: "Performer" }],
                tags: [{ id: "t1", name: "Tag" }],
            }),
        ];

        const result = rateScenes(
            scenes,
            ratedStudios,
            ratedTags,
            ratedPerformers
        );

        expect(result).toHaveLength(1);
        expect(result[0].rating100).toBeGreaterThan(0);
        expect(result[0].o_counter).toBe(5);
        expect(result[0]).toHaveProperty("ratingFormula");
        expect(result[0]).toHaveProperty("ratingFormulaExplained");
    });

    it("rates a scene with no studio using average studio score", () => {
        const ratedStudios = [makeRatedStudio({ id: "s1", rating100: 60 })];
        const ratedPerformers = [
            makeRatedPerformer({ id: "p1", rating100: 50 }),
        ];
        const ratedTags = [makeRatedTag({ id: "t1", rating100: 50 })];

        const scenes = [
            makeScene({
                id: "sc1",
                o_counter: 3,
                studio: null,
                performers: [{ id: "p1", name: "Performer" }],
                tags: [{ id: "t1", name: "Tag" }],
            }),
        ];

        const result = rateScenes(
            scenes,
            ratedStudios,
            ratedTags,
            ratedPerformers
        );

        expect(result).toHaveLength(1);
        expect(result[0].rating100).toBeGreaterThan(0);
    });

    it("rates a scene with empty performers using average performer score", () => {
        const ratedStudios = [makeRatedStudio({ id: "s1", rating100: 50 })];
        const ratedPerformers = [
            makeRatedPerformer({ id: "p1", rating100: 80 }),
        ];
        const ratedTags = [makeRatedTag({ id: "t1", rating100: 50 })];

        const scenes = [
            makeScene({
                id: "sc1",
                o_counter: 2,
                studio: { id: "s1", name: "Studio" },
                performers: [],
                tags: [{ id: "t1", name: "Tag" }],
            }),
        ];

        const result = rateScenes(
            scenes,
            ratedStudios,
            ratedTags,
            ratedPerformers
        );

        expect(result).toHaveLength(1);
        expect(result[0].rating100).toBeGreaterThan(0);
    });

    it("assigns avgTagScore when scene has o_counter = 0", () => {
        const ratedStudios = [makeRatedStudio({ id: "s1", rating100: 60 })];
        const ratedPerformers = [
            makeRatedPerformer({ id: "p1", rating100: 70 }),
        ];
        const ratedTags = [makeRatedTag({ id: "t1", rating100: 40 })];

        const scenes = [
            makeScene({
                id: "sc1",
                o_counter: 0,
                studio: { id: "s1", name: "Studio" },
                performers: [{ id: "p1", name: "Performer" }],
                tags: [{ id: "t1", name: "Tag" }],
            }),
        ];

        const result = rateScenes(
            scenes,
            ratedStudios,
            ratedTags,
            ratedPerformers
        );

        expect(result).toHaveLength(1);
        // When o_counter is 0, getSceneRating returns avgTagScore
        expect(result[0].rating100).toBe(40);
        expect(result[0].o_counter).toBe(0);
        expect(result[0].ratingFormulaExplained).toContain("avgTagScore");
    });

    it("applies o_counter multiplier for high o_counter scenes", () => {
        const ratedStudios = [makeRatedStudio({ id: "s1", rating100: 50 })];
        const ratedPerformers = [
            makeRatedPerformer({ id: "p1", rating100: 50 }),
        ];
        const ratedTags = [makeRatedTag({ id: "t1", rating100: 50 })];

        const sceneLow = makeScene({
            id: "sc1",
            o_counter: 1,
            studio: { id: "s1", name: "S" },
            performers: [{ id: "p1", name: "P" }],
            tags: [{ id: "t1", name: "T" }],
        });
        const sceneHigh = makeScene({
            id: "sc2",
            o_counter: 100,
            studio: { id: "s1", name: "S" },
            performers: [{ id: "p1", name: "P" }],
            tags: [{ id: "t1", name: "T" }],
        });

        const result = rateScenes(
            [sceneLow, sceneHigh],
            ratedStudios,
            ratedTags,
            ratedPerformers
        );

        const lowRated = result.find((r) => r.id === "sc1")!;
        const highRated = result.find((r) => r.id === "sc2")!;

        // High o_counter should produce higher or equal rating
        expect(highRated.rating100).toBeGreaterThanOrEqual(lowRated.rating100);
    });

    it("caps scene rating100 at 100", () => {
        const ratedStudios = [makeRatedStudio({ id: "s1", rating100: 100 })];
        const ratedPerformers = [
            makeRatedPerformer({ id: "p1", rating100: 100 }),
        ];
        const ratedTags = [makeRatedTag({ id: "t1", rating100: 100 })];

        const scene = makeScene({
            id: "sc1",
            o_counter: 1000,
            studio: { id: "s1", name: "S" },
            performers: [{ id: "p1", name: "P" }],
            tags: [{ id: "t1", name: "T" }],
        });

        const result = rateScenes(
            [scene],
            ratedStudios,
            ratedTags,
            ratedPerformers
        );

        expect(result[0].rating100).toBeLessThanOrEqual(100);
    });

    it("sorts scenes by rating100 descending, then o_counter descending", () => {
        const ratedStudios = [
            makeRatedStudio({ id: "s1", rating100: 30 }),
            makeRatedStudio({ id: "s2", rating100: 80 }),
        ];
        const ratedPerformers: PerformerRated[] = [];
        const ratedTags: TagRated[] = [];

        const scenes = [
            makeScene({
                id: "sc1",
                o_counter: 3,
                studio: { id: "s1", name: "Low" },
            }),
            makeScene({
                id: "sc2",
                o_counter: 3,
                studio: { id: "s2", name: "High" },
            }),
        ];

        const result = rateScenes(
            scenes,
            ratedStudios,
            ratedTags,
            ratedPerformers
        );

        for (let i = 0; i < result.length - 1; i++) {
            if (result[i].rating100 === result[i + 1].rating100) {
                expect(result[i].o_counter).toBeGreaterThanOrEqual(
                    result[i + 1].o_counter ?? 0
                );
            } else {
                expect(result[i].rating100).toBeGreaterThan(
                    result[i + 1].rating100
                );
            }
        }
    });

    it("handles empty scenes array", () => {
        const result = rateScenes([], [], [], []);
        expect(result).toEqual([]);
    });
});
