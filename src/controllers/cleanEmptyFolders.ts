import fs from "fs/promises";
import path from "path";
import { backCommand } from "../commands/back.js";
import { buildMenu } from "../commands/menus/buildMenu.js";
import { getManageFilesMenuItems } from "../commands/menus/menuItems.js";
import { validateFolder } from "../utils/filesystem.js";
import {
    input,
    loadingText,
    print,
    selectMenu,
    yesOrNo,
} from "../utils/terminal.js";

// Common video file extensions
const VIDEO_EXTENSIONS = [
    ".mp4",
    ".avi",
    ".mkv",
    ".mov",
    ".wmv",
    ".flv",
    ".webm",
    ".m4v",
    ".mpg",
    ".mpeg",
    ".3gp",
    ".ts",
    ".mts",
    ".m2ts",
    ".vob",
    ".divx",
    ".xvid",
    ".asf",
    ".rm",
    ".rmvb",
    ".ogv",
    ".dv",
    ".f4v",
    ".swf",
];

// Potentially important folder names to warn about
const IMPORTANT_FOLDER_NAMES = [
    "system",
    "windows",
    "program files",
    "program files (x86)",
    "users",
    "documents",
    "desktop",
    "downloads",
    "music",
    "pictures",
    "videos",
    "appdata",
    "temp",
    "tmp",
    "etc",
    "var",
    "usr",
    "opt",
    "home",
    "root",
    "bin",
    "sbin",
    "lib",
    "lib64",
    "boot",
    "dev",
    "proc",
    "sys",
];

/**
 * Checks if a folder name might be important and shouldn't be deleted
 */
const isImportantFolder = (folderPath: string): boolean => {
    const folderName = path.basename(folderPath).toLowerCase();
    return IMPORTANT_FOLDER_NAMES.some(
        (important) =>
            folderName.includes(important) || important.includes(folderName)
    );
};

interface EmptyFolder {
    path: string;
    parentPath: string;
    isEmpty: boolean;
    hasSubfolders: boolean;
}

/**
 * Recursively checks if a directory contains any video files
 */
const hasVideoFiles = async (dirPath: string): Promise<boolean> => {
    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (VIDEO_EXTENSIONS.includes(ext)) {
                    return true;
                }
            } else if (entry.isDirectory()) {
                const subDirPath = path.join(dirPath, entry.name);
                if (await hasVideoFiles(subDirPath)) {
                    return true;
                }
            }
        }

        return false;
    } catch (error) {
        // If we can't read the directory, assume it's not empty to be safe
        console.warn(`Warning: Could not read directory ${dirPath}: ${error}`);
        return true;
    }
};

/**
 * Recursively finds all folders that don't contain video files
 */
const findEmptyFolders = async (rootPath: string): Promise<EmptyFolder[]> => {
    const emptyFolders: EmptyFolder[] = [];
    let foldersScanned = 0;

    const scanDirectory = async (
        dirPath: string,
        parentPath: string
    ): Promise<void> => {
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            const subfolders = entries.filter((entry) => entry.isDirectory());

            foldersScanned++;
            if (foldersScanned % 50 === 0) {
                process.stdout.write(
                    `\n  Scanned ${foldersScanned} folders...`
                );
            }

            // Check if this directory has video files
            const hasVideos = await hasVideoFiles(dirPath);

            if (!hasVideos && dirPath !== rootPath) {
                emptyFolders.push({
                    path: dirPath,
                    parentPath,
                    isEmpty: true,
                    hasSubfolders: subfolders.length > 0,
                });
            }

            // Recursively scan subfolders
            for (const subfolder of subfolders) {
                const subfolderPath = path.join(dirPath, subfolder.name);
                await scanDirectory(subfolderPath, dirPath);
            }
        } catch (error) {
            console.warn(
                `Warning: Could not scan directory ${dirPath}: ${error}`
            );
        }
    };

    await scanDirectory(rootPath, "");
    if (foldersScanned >= 50) {
        process.stdout.write(
            `\\r  Scanned ${foldersScanned} folders total.\\n`
        );
    }
    return emptyFolders;
};

/**
 * Attempts to delete a folder (only if it's empty or only contains empty subfolders)
 */
const deleteFolder = async (folderPath: string): Promise<boolean> => {
    try {
        // Try to remove the directory
        await fs.rmdir(folderPath, { recursive: true });
        return true;
    } catch (error: any) {
        if (error.code === "EACCES") {
            console.error(
                `Permission denied - try running with sudo: ${folderPath}`
            );
        } else {
            console.error(`Failed to delete folder ${folderPath}: ${error}`);
        }
        return false;
    }
};

/**
 * Interactive mode - ask user about each folder individually
 */
const interactiveMode = async (emptyFolders: EmptyFolder[]): Promise<void> => {
    let deletedCount = 0;
    let skippedCount = 0;

    print(
        `\\nStarting interactive mode for ${emptyFolders.length} folders...\\n`,
        "blue"
    );

    for (let i = 0; i < emptyFolders.length; i++) {
        const folder = emptyFolders[i];
        const progress = `[${i + 1}/${emptyFolders.length}]`;

        print(`${progress} Empty folder found:`, "yellow");
        print(`  Path: ${folder.path}`, "cyan");
        print(`  Parent: ${folder.parentPath}`, "gray");
        if (folder.hasSubfolders) {
            print(`  Contains empty subfolders`, "gray");
        }

        const shouldDelete = await yesOrNo(`Delete this folder?`);

        if (shouldDelete) {
            const success = await deleteFolder(folder.path);
            if (success) {
                print(`  ✅ Deleted successfully\\n`, "green");
                deletedCount++;
            } else {
                print(`  ❌ Failed to delete\\n`, "red");
                skippedCount++;
            }
        } else {
            print(`  ⏭️  Skipped\\n`, "yellow");
            skippedCount++;
        }
    }

    print(`\\nInteractive mode completed:`, "blue");
    print(`  Deleted: ${deletedCount} folders`, "green");
    print(`  Skipped: ${skippedCount} folders`, "yellow");

    if (deletedCount === 0 && skippedCount > 0) {
        print(
            `\\n💡 If you skipped due to permission errors, try running with sudo:`,
            "yellow"
        );
        print(`  sudo $(which node) dist/index.js`, "cyan");
    }
};

/**
 * Batch mode - delete all folders at once
 */
const batchMode = async (emptyFolders: EmptyFolder[]): Promise<void> => {
    let deletedCount = 0;
    let failedCount = 0;

    print(`\\nDeleting ${emptyFolders.length} empty folders...\\n`, "blue");

    for (let i = 0; i < emptyFolders.length; i++) {
        const folder = emptyFolders[i];
        const progress = `[${i + 1}/${emptyFolders.length}]`;

        print(`${progress} Deleting: ${folder.path}`, "cyan");

        const success = await deleteFolder(folder.path);
        if (success) {
            print(`  ✅ Deleted`, "green");
            deletedCount++;
        } else {
            print(`  ❌ Failed`, "red");
            failedCount++;
        }
    }

    print(`\\nBatch deletion completed:`, "blue");
    print(`  Deleted: ${deletedCount} folders`, "green");
    if (failedCount > 0) {
        print(`  Failed: ${failedCount} folders`, "red");
        print(
            `\\n💡 If you got permission errors, try running with sudo:`,
            "yellow"
        );
        print(`  sudo $(which node) dist/index.js`, "cyan");
    }
};

export const cleanEmptyFoldersController = async (): Promise<void> => {
    print(
        "\\nThis command will scan for folders that don't contain any video files.\\n",
        "yellow"
    );

    // Check if we have permission issues upfront
    print(
        "💡 Note: If you encounter permission errors, you may need to run with 'sudo $(which node) dist/index.js'\\n",
        "cyan"
    );

    // Get the path to scan
    print("Enter the path to scan for empty folders:", "blue");
    const targetPath = await input("Path to scan");

    // Check for empty input
    if (!targetPath.trim()) {
        print("Error: Please provide a valid path.", "red");
        return await cleanEmptyFoldersController();
    }

    // Validate the path exists
    try {
        await validateFolder(targetPath);
    } catch (error) {
        print(`Error: Invalid path - ${error}`, "red");
        return await cleanEmptyFoldersController();
    }

    // Scan for empty folders
    const finishScanning = await loadingText(
        `Scanning ${targetPath} for empty folders...`
    );

    try {
        const emptyFolders = await findEmptyFolders(targetPath);
        finishScanning(
            `Scan complete! Found ${emptyFolders.length} empty folders.`
        );

        if (emptyFolders.length === 0) {
            print(
                "\\n🎉 No empty folders found! Your directory structure is clean.",
                "green"
            );
            await backCommand(() => buildMenu(getManageFilesMenuItems()));
            return;
        }

        // Show the list of empty folders
        print(`\\nEmpty folders found (${emptyFolders.length} total):`, "blue");

        // Check for potentially important folders
        const importantFolders = emptyFolders.filter((folder) =>
            isImportantFolder(folder.path)
        );
        if (importantFolders.length > 0) {
            print(
                `\\n⚠️  WARNING: ${importantFolders.length} folders have names that might be important:`,
                "red"
            );
            importantFolders.forEach((folder) => {
                print(`     ${folder.path}`, "red");
            });
            print(`   Please review carefully before deleting!\\n`, "red");
        }

        // Show first 20 folders, with option to see more
        const displayCount = Math.min(20, emptyFolders.length);
        emptyFolders.slice(0, displayCount).forEach((folder, index) => {
            const color = isImportantFolder(folder.path) ? "red" : "cyan";
            print(`  ${index + 1}. ${folder.path}`, color);
            if (folder.hasSubfolders) {
                print(`     (contains empty subfolders)`, "gray");
            }
        });

        if (emptyFolders.length > displayCount) {
            print(
                `  ... and ${emptyFolders.length - displayCount} more folders`,
                "gray"
            );
        }

        // Ask what to do
        print("\\nWhat would you like to do?", "yellow");
        const { selectedText } = await selectMenu([
            "Delete all empty folders",
            "Interactive mode (ask about each folder)",
            "Just show the list (don't delete anything)",
            "Back to menu",
        ]);

        switch (selectedText) {
            case "Delete all empty folders":
                // Extra confirmation for large numbers or important folders
                let confirmBatch = true;
                if (emptyFolders.length > 10) {
                    confirmBatch = await yesOrNo(
                        `\\nYou're about to delete ${emptyFolders.length} folders. This is a large number. Are you sure?`
                    );
                }
                if (confirmBatch && importantFolders.length > 0) {
                    confirmBatch = await yesOrNo(
                        `\\n⚠️  This includes ${importantFolders.length} folders with potentially important names. Continue anyway?`
                    );
                }
                if (confirmBatch) {
                    confirmBatch = await yesOrNo(
                        `\\nFinal confirmation: Delete ALL ${emptyFolders.length} empty folders? This cannot be undone.`
                    );
                }

                if (confirmBatch) {
                    await batchMode(emptyFolders);
                } else {
                    print("Operation cancelled.", "yellow");
                }
                break;

            case "Interactive mode (ask about each folder)":
                await interactiveMode(emptyFolders);
                break;

            case "Just show the list (don't delete anything)":
                print("\\nList shown above. No folders were deleted.", "green");
                break;

            case "Back to menu":
                break;
        }
    } catch (error) {
        finishScanning();
        print(`Error scanning directory: ${error}`, "red");
    }

    // Return to menu
    await backCommand(() => buildMenu(getManageFilesMenuItems()));
};
