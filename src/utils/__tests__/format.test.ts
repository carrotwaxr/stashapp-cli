import { describe, expect, it } from "vitest";
import {
    calculatePercent,
    convertMbToBytes,
    formatBytes,
    formatHeight,
    formatPercent,
    formatWeight,
} from "../format.js";

describe("calculatePercent", () => {
    it("calculates percentage from two numbers", () => {
        expect(calculatePercent(50, 200)).toBe(25);
    });

    it("handles string inputs", () => {
        expect(calculatePercent("25", "100")).toBe(25);
    });
});

describe("convertMbToBytes", () => {
    it("converts megabytes to bytes", () => {
        expect(convertMbToBytes(1)).toBe(1048576);
        expect(convertMbToBytes(0)).toBe(0);
    });
});

describe("formatBytes", () => {
    it("formats 0 bytes", () => {
        expect(formatBytes(0)).toBe("0 Bytes");
    });

    it("formats bytes to KB", () => {
        expect(formatBytes(1024)).toBe("1 KB");
    });

    it("formats bytes to MB", () => {
        expect(formatBytes(1048576)).toBe("1 MB");
    });

    it("formats bytes to GB", () => {
        expect(formatBytes(1073741824)).toBe("1 GB");
    });

    it("respects decimals parameter", () => {
        expect(formatBytes(1500, 1)).toBe("1.5 KB");
    });
});

describe("formatHeight", () => {
    it("converts cm to feet and inches", () => {
        expect(formatHeight(170)).toBe(`5'6"`);
    });

    it("handles short heights", () => {
        expect(formatHeight(152)).toBe(`4'11"`);
    });
});

describe("formatPercent", () => {
    it("formats number as percentage with ceiling", () => {
        expect(formatPercent(33.3)).toBe("34%");
        expect(formatPercent(100)).toBe("100%");
    });
});

describe("formatWeight", () => {
    it("formats weight in pounds", () => {
        expect(formatWeight(130)).toBe("130lbs");
    });
});
