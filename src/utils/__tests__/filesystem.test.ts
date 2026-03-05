import { describe, expect, it } from "vitest";
import { sanitizeFilename } from "../filesystem.js";

describe("sanitizeFilename", () => {
    it("replaces Windows-invalid characters", () => {
        expect(sanitizeFilename('file<>:"/\\|?*.mp4')).toBe("file_________.mp4");
    });

    it("leaves valid filenames unchanged", () => {
        expect(sanitizeFilename("normal-file_name.mp4")).toBe("normal-file_name.mp4");
    });

    it("handles empty string", () => {
        expect(sanitizeFilename("")).toBe("");
    });

    it("replaces forward slashes", () => {
        expect(sanitizeFilename("path/to/file.mp4")).toBe("path_to_file.mp4");
    });
});
