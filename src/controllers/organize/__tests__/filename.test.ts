import type { Scene } from "stashapp-api";
import { describe, expect, it } from "vitest";
import { buildFileName, getResolution } from "../filename.js";
import type { UserOrganizationDetails } from "../types.js";

const makeScene = (overrides: Partial<Scene> = {}): Scene => ({
    id: "123",
    title: "Test Title",
    date: "2024-01-15",
    studio: { id: "s1", name: "TestStudio" },
    performers: [
        { id: "p1", name: "Jane", gender: "FEMALE" },
        { id: "p2", name: "John", gender: "MALE" },
    ],
    tags: [{ id: "t1", name: "TagA" }],
    files: [{ path: "/data/test.mp4", basename: "test.mp4", size: "1000", height: 1080, width: 1920 }],
    ...overrides,
} as Scene);

const makeDetails = (overrides: Partial<UserOrganizationDetails> = {}): UserOrganizationDetails => ({
    organizationType: "Studio",
    sceneFilter: {},
    stashDataPath: "/data",
    maleFilter: false,
    femaleFilter: false,
    filenameFormatString: "{date} - {title}.{ext}",
    ...overrides,
});

describe("getResolution", () => {
    it("returns 1080p for 1080 height", () => {
        expect(getResolution({ height: 1080 })).toBe("1080p");
    });

    it("returns 4K for 2160 height", () => {
        expect(getResolution({ height: 2160 })).toBe("4K");
    });

    it("returns 720p for 720 height", () => {
        expect(getResolution({ height: 720 })).toBe("720p");
    });

    it("returns unknown for 0 height", () => {
        expect(getResolution({ height: 0 })).toBe("unknown");
    });

    it("returns unknown for missing height", () => {
        expect(getResolution({})).toBe("unknown");
    });

    it("returns exact pixels for non-standard heights", () => {
        expect(getResolution({ height: 144 })).toBe("144p");
    });
});

describe("buildFileName", () => {
    it("builds filename from template", () => {
        const scene = makeScene();
        const details = makeDetails({ filenameFormatString: "{date} - {title}.{ext}" });
        const result = buildFileName(scene, details);
        expect(result).toBe("2024-01-15 - Test Title.mp4");
    });

    it("includes performers when template has them", () => {
        const scene = makeScene();
        const details = makeDetails({
            filenameFormatString: "{performers_female} - {title}.{ext}",
        });
        const result = buildFileName(scene, details);
        expect(result).toBe("Jane - Test Title.mp4");
    });

    it("includes studio in filename", () => {
        const scene = makeScene();
        const details = makeDetails({
            filenameFormatString: "{studio} - {title}.{ext}",
        });
        const result = buildFileName(scene, details);
        expect(result).toBe("TestStudio - Test Title.mp4");
    });

    it("includes resolution in filename", () => {
        const scene = makeScene();
        const details = makeDetails({
            filenameFormatString: "{title} [{resolution}].{ext}",
        });
        const result = buildFileName(scene, details);
        expect(result).toBe("Test Title [1080p].mp4");
    });
});
