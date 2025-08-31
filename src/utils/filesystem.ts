import fs from "fs/promises";
import http from "http";
import path from "path";
import { Scene } from "stashapp-api";
import { buildSceneNFO } from "./nfo.js";
import { getUniquePerformers } from "./scenes.js";
import { loadingText } from "./terminal.js";

export const copyScene = async (
    scene: Scene,
    destFolder: string,
    srcBaseFolder: string
): Promise<void> => {
    const [stashFile] = scene.files;
    const videoSrcLocalized = localizePath(
        stashFile.path.replaceAll("/data", srcBaseFolder)
    );

    const videoFile = path.parse(videoSrcLocalized);

    const studioName = sanitizeFilename(scene.studio?.name || "UNKNOWN");

    const sceneTitle = scene.title || videoFile.name;

    const performersSorted = scene.performers.sort((a, b) => {
        const aGender = a.gender || "ZZZZZZZZZZZZZZZZZZsortlast";
        const bGender = b.gender || "ZZZZZZZZZZZZZZZZZZsortlast";
        const aOCounter = a.o_counter ?? 0;
        const bOCounter = b.o_counter ?? 0;
        return aGender.localeCompare(bGender) || bOCounter - aOCounter;
    });

    const performersSortedAndTruncatedForSize = performersSorted.slice(0, 5);

    const performerNames = performersSortedAndTruncatedForSize
        .map(({ name }) => name)
        .join(", ");
    const newFileNameNoExt = sanitizeFilename(
        `${sceneTitle} - ${performerNames || scene.id}`
    );
    const newFileNameWithExt = `${newFileNameNoExt}${videoFile.ext}`;

    const finalDestinationFolder = localizePath(
        path.join(destFolder, studioName)
    );

    await ensureDirectoriesExist(finalDestinationFolder);

    const videoFileDest = path.join(finalDestinationFolder, newFileNameWithExt);

    const nfoXML = buildSceneNFO(scene);
    const nfoFileDest = path.join(
        finalDestinationFolder,
        `${newFileNameNoExt}.nfo`
    );

    const finishProcessing = await loadingText(
        `Processing ${studioName} - ${newFileNameNoExt}`
    );

    try {
        await fs.copyFile(
            videoSrcLocalized,
            videoFileDest,
            fs.constants.COPYFILE_EXCL
        );
    } catch {}

    try {
        await fs.writeFile(nfoFileDest, nfoXML);
    } catch (err) {
        console.error(err);
    }

    if (scene.paths?.screenshot) {
        const posterURL = `${scene.paths.screenshot}&apikey=${process.env.GRAPHQL_API_KEY}`;
        const posterDestPath = path.join(
            finalDestinationFolder,
            `${newFileNameNoExt}-poster.jpg`
        );
        await downloadJPG(posterURL, posterDestPath);
    }

    finishProcessing(`Processed ${studioName} - ${newFileNameNoExt}`);

    return;
};

export const ensureDirectoriesExist = async (
    filepath: string
): Promise<void> => {
    let doesExist = true;
    try {
        await fs.access(filepath, fs.constants.F_OK);
    } catch {
        doesExist = false;
    }

    if (!doesExist) {
        await fs.mkdir(filepath, { recursive: true });
    }
};

export const generateActorsMetadata = async (
    scenes: Scene[],
    destFolder: string
): Promise<void> => {
    const performers = getUniquePerformers(scenes);

    const destBasePath = localizePath(
        path.join(destFolder, "generated-metadata", "People")
    );

    const finishProcessing = await loadingText("Generating Actor images");

    for (const performer of performers) {
        if (performer.image_path) {
            const nameFirstLetter = performer.name.slice(0, 1).toUpperCase();
            const finalDestinationFolder = path.join(
                destBasePath,
                nameFirstLetter,
                performer.name
            );

            await ensureDirectoriesExist(finalDestinationFolder);

            const imageURL = `${performer.image_path}&apikey=${process.env.GRAPHQL_API_KEY}`;
            const destFilePath = path.join(
                finalDestinationFolder,
                "folder.jpg"
            );

            await downloadJPG(imageURL, destFilePath);
        }
    }

    finishProcessing(`Downloaded Actor images to ${destBasePath}`);
};

export const downloadJPG = async (
    url: string,
    filepath: string
): Promise<void> => {
    try {
        const image = await new Promise<http.IncomingMessage>(
            (resolve, reject) => {
                http.get(url, (response) => {
                    if (response.statusCode === 200) {
                        resolve(response);
                    } else {
                        reject(
                            new Error(
                                `Failed to download image. HTTP Status Code: ${response.statusCode}`
                            )
                        );
                    }
                }).on("error", (err) => reject(err));
            }
        );

        const file = await fs.open(filepath, "w");
        const writeStream = file.createWriteStream();

        image.pipe(writeStream);

        await new Promise<void>((resolve, reject) => {
            writeStream.on("finish", () => resolve()).on("error", reject);
        });
    } catch (err) {
        console.error("Error during download:", err);
    }
};

export const getFreeSpace = async (filepath: string): Promise<number> => {
    const stats = await fs.statfs(filepath);

    return stats.bsize * stats.bavail;
};

export const localizePath = (filepath: string): string => {
    return filepath.replaceAll("/", path.sep);
};

export const sanitizeFilename = (filename: string): string => {
    // List of invalid characters for file names on Windows
    const invalidCharsWindows = /[<>:"/\\|?*\x00-\x1F]/g;
    // Invalid character for Linux: the forward slash '/'
    const invalidCharsLinux = /[/\0]/g;

    // Remove invalid characters for Windows and Linux
    const sanitized = filename
        .replace(invalidCharsWindows, "_") // Remove Windows invalid chars
        .replace(invalidCharsLinux, "_"); // Remove Linux invalid chars

    return sanitized;
};

export const validateFolder = async (filepath: string): Promise<boolean> => {
    try {
        await fs.access(filepath, fs.constants.F_OK);
        return true;
    } catch {
        throw new Error(
            `${filepath} does not exist on the filesystem or you do not have read/write access to it`
        );
    }
};
