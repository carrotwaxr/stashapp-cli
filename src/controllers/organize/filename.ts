import type { Scene } from "stashapp-api";
import { MAX_FILENAME_LENGTH, type UserOrganizationDetails } from "./types.js";

export const buildFileName = (
    scene: Scene,
    organizationDetails: UserOrganizationDetails
) => {
    const { id, date, performers, studio, files, tags } = scene;
    const { filenameFormatString: template } = organizationDetails;

    const hasMalePerformers = template.includes("{performers_male}");
    const hasFemalePerformers = template.includes("{performers_female}");
    const hasTags = template.includes("{tags}");
    const hasTitle = template.includes("{title}");

    const fileExtension = files[0].path.split(".").pop() as string;

    let titleStr = scene.title ?? "";
    let malePerformersStr = performers
        .filter((p) => p.gender === 'MALE')
        .map((p) => p.name)
        .join(" ");
    let femalePerformersStr = performers
        .filter((p) => p.gender === 'FEMALE')
        .map((p) => p.name)
        .join(" ");
    let tagsStr = tags.map((t) => t.name).join(" ");

    const fullReplaceResult = `${template}`
        .replace("{id}", id)
        .replace("{title}", titleStr as string)
        .replace("{date}", date as string)
        .replace("{performers_male}", malePerformersStr)
        .replace("{performers_female}", femalePerformersStr)
        .replace("{tags}", tagsStr)
        .replace("{resolution}", getResolution(files[0]) as string)
        .replace("{studio}", studio?.name as string)
        .replace("{ext}", fileExtension);

    let overflowCharCount = fullReplaceResult.length - MAX_FILENAME_LENGTH;

    if (overflowCharCount <= 0) {
        return fullReplaceResult;
    }

    if (hasTags) {
        const keptTags = tagsStr.slice(0, -overflowCharCount);
        overflowCharCount -= tagsStr.length - keptTags.length;
        tagsStr = keptTags;
    }

    if (hasMalePerformers && overflowCharCount > 0) {
        const keptMalePerformers = malePerformersStr.slice(
            0,
            -overflowCharCount
        );
        overflowCharCount -= malePerformersStr.length - keptMalePerformers.length;
        malePerformersStr = keptMalePerformers;
    }

    if (hasFemalePerformers && overflowCharCount > 0) {
        const keptFemalePerformers = femalePerformersStr.slice(
            0,
            -overflowCharCount
        );
        overflowCharCount -= femalePerformersStr.length - keptFemalePerformers.length;
        femalePerformersStr = keptFemalePerformers;
    }

    if (hasTitle && overflowCharCount > 0) {
        const keptTitle = titleStr.slice(0, -overflowCharCount);
        overflowCharCount -= titleStr.length - keptTitle.length;
        titleStr = keptTitle;
    }

    if (overflowCharCount <= 0) {
        return `${template}`
            .replace("{id}", id)
            .replace("{title}", titleStr as string)
            .replace("{date}", date as string)
            .replace("{performers_male}", malePerformersStr)
            .replace("{performers_female}", femalePerformersStr)
            .replace("{tags}", tagsStr)
            .replace("{resolution}", getResolution(files[0]) as string)
            .replace("{studio}", studio?.name as string)
            .replace("{ext}", fileExtension);
    }

    const keptFileExt = fullReplaceResult.slice(-fileExtension.length - 1);
    return (
        fullReplaceResult.slice(0, -keptFileExt.length - overflowCharCount) +
        keptFileExt
    );
};

export function getResolution(file: { height?: number; width?: number }): string {
    const h = file.height ?? 0;
    if (h >= 4320) return "8K";
    if (h >= 2160) return "4K";
    if (h >= 1440) return "2K";
    if (h >= 1080) return "1080p";
    if (h >= 720) return "720p";
    if (h >= 480) return "480p";
    if (h >= 360) return "360p";
    if (h >= 240) return "240p";
    if (h > 0) return `${h}p`;
    return "unknown";
}
