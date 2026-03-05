import fs from "fs";
import path from "path";
import chalk from "chalk";
import type { Scene, Studio } from "stashapp-api";
import { buildSceneNFO } from "../../utils/nfo.js";
import { buildFileName } from "./filename.js";
import { generatePerformerFolders, generateStudioFolders } from "./folders.js";
import {
    INVALID_FILENAME_CHARS,
    type OrganizerSceneMetadata,
    type OrganizerSceneResults,
    type SceneWithMetadata,
    type UserOrganizationDetails,
} from "./types.js";

export function sanitizeFilenamePart(part: string): string {
    return part.replace(INVALID_FILENAME_CHARS, "");
}

export function toSystemPath(linuxPath: string): string {
    if (process.platform === "win32") {
        return linuxPath.replace(/\//g, "\\");
    }
    return linuxPath;
}

export const hydrateMetadata = (
    scene: Scene,
    studios: Studio[],
    organizationDetails: UserOrganizationDetails
): OrganizerSceneMetadata => {
    const folders =
        organizationDetails.organizationType === "Performer"
            ? generatePerformerFolders(scene, organizationDetails)
            : generateStudioFolders(scene, studios, organizationDetails);

    const stashDataPath = organizationDetails.stashDataPath;
    const filename = buildFileName(scene, organizationDetails);
    const safeFolders = (folders as string[])
        .filter(Boolean)
        .map(sanitizeFilenamePart);
    const newFilepath = toSystemPath(
        path.join(stashDataPath, ...safeFolders, sanitizeFilenamePart(filename))
    );

    let currentFilepath = "";
    if (scene.files && scene.files.length > 0) {
        currentFilepath = toSystemPath(
            scene.files[0].path.replace(/^\/data/, stashDataPath)
        );
    }

    return {
        newFilepath,
        currentFilepath,
        nfoXML: buildSceneNFO(scene),
    };
};

export function organizeScene(
    scene: SceneWithMetadata,
    isDryRun: boolean
): OrganizerSceneResults {
    try {
        const { organizerMetadata } = scene;
        const { currentFilepath, newFilepath } = organizerMetadata;
        if (!currentFilepath || !newFilepath) {
            return {
                success: false,
                skipped: true,
                message: `Missing filepaths for scene ${scene.scene.id}`,
            };
        }

        const currentDir = path.dirname(currentFilepath);
        const baseName = path.basename(
            currentFilepath,
            path.extname(currentFilepath)
        );
        const newDir = path.dirname(newFilepath);
        const newBaseName = path.basename(
            newFilepath,
            path.extname(newFilepath)
        );

        const files = fs.readdirSync(currentDir);
        const matchingFiles = files.filter(
            (f) => path.basename(f, path.extname(f)) === baseName
        );

        const mainFile = scene.scene.files && scene.scene.files[0];
        const mainFileTargetPath = path.join(
            newDir,
            newBaseName + path.extname(mainFile?.path || "")
        );
        const mainFileCurrentPath = mainFile?.path;
        let skipMove = false;
        if (
            mainFileCurrentPath &&
            path.resolve(mainFileCurrentPath) ===
                path.resolve(mainFileTargetPath)
        ) {
            skipMove = true;
        }

        if (!skipMove) {
            for (const file of matchingFiles) {
                const oldPath = path.join(currentDir, file);
                const ext = path.extname(file);
                const newPath = path.join(newDir, newBaseName + ext);
                if (isDryRun) {
                    console.log(
                        chalk.gray("[") +
                            chalk.yellow("Dry run") +
                            chalk.gray("] Would move: ") +
                            chalk.cyan(oldPath) +
                            chalk.gray(" -> ") +
                            chalk.green(newPath)
                    );
                } else {
                    fs.mkdirSync(newDir, { recursive: true });
                    fs.renameSync(oldPath, newPath);
                    console.log(
                        chalk.gray("Moved: ") +
                            chalk.cyan(oldPath) +
                            chalk.gray(" -> ") +
                            chalk.green(newPath)
                    );
                }
            }
        } else {
            if (isDryRun) {
                console.log(
                    chalk.gray("[") +
                        chalk.yellow("Dry run") +
                        chalk.gray(
                            "] Skipping move: main file already at target path"
                        )
                );
            } else {
                console.log(
                    chalk.gray(
                        "Skipping move: main file already at target path"
                    )
                );
            }
        }

        const nfoPath = path.join(newDir, newBaseName + ".nfo");
        if (isDryRun) {
            console.log(
                chalk.gray("[") +
                    chalk.yellow("Dry run") +
                    chalk.gray("] Would write NFO: ") +
                    chalk.magenta(nfoPath)
            );
        } else {
            fs.writeFileSync(nfoPath, organizerMetadata.nfoXML, "utf8");
            console.log(chalk.gray("Wrote NFO: ") + chalk.magenta(nfoPath));
        }

        return {
            success: true,
            skipped: skipMove,
            message: `Scene ${scene.scene.id} organized successfully`,
        };
    } catch (error) {
        return {
            success: false,
            skipped: true,
            message: `Error organizing scene ${scene.scene.id}: ${error}`,
        };
    }
}

export function organizeScenes(
    scenes: SceneWithMetadata[],
    isDryRun: boolean
): OrganizerSceneResults[] {
    const results: OrganizerSceneResults[] = [];
    for (const sceneObj of scenes) {
        const result = organizeScene(sceneObj, isDryRun);
        results.push(result);
    }
    return results;
}
