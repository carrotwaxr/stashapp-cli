import type { Performer, Scene } from "stashapp-api";
import { describe, expect, it } from "vitest";
import { dedupeScenes, getTotalSize, getUniquePerformers } from "../scenes.js";

const makeScene = (overrides: Partial<Scene> = {}): Scene => ({
    id: "1",
    title: "Test Scene",
    rating100: 50,
    o_counter: 1,
    date: "2024-01-01",
    details: "",
    studio: { id: "s1", name: "Studio A" },
    performers: [],
    tags: [],
    files: [{ path: "/data/test.mp4", basename: "test.mp4", size: "1000" }],
    paths: { screenshot: "" },
    ...overrides,
} as Scene);

describe("dedupeScenes", () => {
    it("removes duplicate scenes by id", () => {
        const scenes = [
            makeScene({ id: "1" }),
            makeScene({ id: "2" }),
            makeScene({ id: "1" }),
        ];
        const result = dedupeScenes(scenes);
        expect(result).toHaveLength(2);
        expect(result.map((s) => s.id)).toEqual(["1", "2"]);
    });

    it("returns empty array for empty input", () => {
        expect(dedupeScenes([])).toEqual([]);
    });

    it("returns same array when no duplicates", () => {
        const scenes = [makeScene({ id: "1" }), makeScene({ id: "2" })];
        expect(dedupeScenes(scenes)).toHaveLength(2);
    });
});

describe("getTotalSize", () => {
    it("sums file sizes across scenes", () => {
        const scenes = [
            makeScene({ files: [{ path: "/a.mp4", basename: "a.mp4", size: "500" }] } as Partial<Scene>),
            makeScene({ files: [{ path: "/b.mp4", basename: "b.mp4", size: "300" }] } as Partial<Scene>),
        ];
        expect(getTotalSize(scenes)).toBe(800);
    });

    it("returns 0 for empty array", () => {
        expect(getTotalSize([])).toBe(0);
    });
});

describe("getUniquePerformers", () => {
    it("extracts unique performers across scenes", () => {
        const performer1 = { id: "p1", name: "Alice" } as Performer;
        const performer2 = { id: "p2", name: "Bob" } as Performer;

        const scenes = [
            makeScene({ performers: [performer1, performer2] as Performer[] }),
            makeScene({ performers: [performer1] as Performer[] }),
        ];

        const result = getUniquePerformers(scenes);
        expect(result).toHaveLength(2);
        expect(result.map((p) => p.name)).toEqual(["Alice", "Bob"]);
    });

    it("returns empty array for scenes with no performers", () => {
        const scenes = [makeScene({ performers: [] })];
        expect(getUniquePerformers(scenes)).toEqual([]);
    });
});
