import os from "os";
import { CriterionModifier } from "stashapp-api";
import { buildMenu } from "../commands/menus/buildMenu.js";
import { getManageFilesMenuItems } from "../commands/menus/menuItems.js";
import { quitCommand } from "../commands/quit.js";
import { getStashInstance } from "../stash.js";
import {
    copyScene,
    generateActorsMetadata,
    getFreeSpace,
    validateFolder,
} from "../utils/filesystem.js";
import { convertMbToBytes, formatBytes } from "../utils/format.js";
import {
    addScenesToFillSpace,
    dedupeScenes,
    getTotalSize,
} from "../utils/scenes.js";
import {
    checkboxMenu,
    input,
    loadingText,
    print,
    yesOrNo,
} from "../utils/terminal.js";

export const copyFilesController = async (): Promise<void> => {
    print("Choose the directory to copy these files into:", "yellow");
    const destFolder = await input("Destination folder path", os.homedir());
    print("");
    await validateFolder(destFolder);

    print(
        "Please enter the Stash /data directory relative to your current OS:",
        "yellow"
    );
    const srcBaseFolder = await input("Source base folder path", os.homedir());
    print("");
    await validateFolder(srcBaseFolder);

    const destFreeSpace = await getFreeSpace(destFolder);
    const niceAvailableSpace = destFreeSpace - convertMbToBytes(2048);

    print("Source (base):", "blue");
    print(srcBaseFolder, "yellow");
    print("");

    print("Destination:", "green");
    print(destFolder, "cyan");
    print("");

    print("Free space at destination:", "red");
    print(formatBytes(destFreeSpace), "magenta");
    print("");

    const proceed = await yesOrNo("Does this look correct?");
    print("");

    if (!proceed) {
        return copyFilesController();
    }

    // Simulate tag selection (replace with actual tags from stash if available)
    const stash = getStashInstance();
    const { findTags: { tags = [] } = {} } = await stash.findTags({
        filter: { per_page: -1 },
    });
    const tagChoices = tags.map((tag: any) => ({ text: tag.name }));
    const { selectedIndexes } = await checkboxMenu(tagChoices);
    const tagIDs = selectedIndexes.map((idx: number) => parseInt(tags[idx].id));

    const finishQuerying = await loadingText("Querying your Stash instance");
    const {
        findScenes: { count, filesize, scenes },
    } = (await stash.findScenes({
        filter: {
            per_page: -1,
        },
        scene_filter: {
            tags: {
                modifier: CriterionModifier.Includes,
                value: tagIDs.map(String),
            },
        },
    })) as any;
    finishQuerying(
        `Success! Found ${count} matching Scenes totalling ${formatBytes(filesize)}.`
    );

    let spaceRemaining = niceAvailableSpace - filesize;
    const twentyGbInBytes = convertMbToBytes(20 * 1024);

    let shouldSmartFill = false;

    if (spaceRemaining <= 0) {
        print(
            "You do not have enough available disk space for these selections.\n",
            "red"
        );
        const shouldStartAgain = await yesOrNo("Should we start over?");
        print("");
        if (shouldStartAgain) {
            return await copyFilesController();
        } else {
            return quitCommand();
        }
    } else if (spaceRemaining > twentyGbInBytes) {
        shouldSmartFill = await yesOrNo(
            "You have more than 20GB in free space remaining after these selections. Do you want me to attempt to fill it with your favorites?"
        );
        print("");
    }

    let scenesToCopy = dedupeScenes(scenes);

    if (shouldSmartFill) {
        print("Great! I'll look for Scenes you might like.\n", "green");
        const updatedScenesToCopy = await addScenesToFillSpace(spaceRemaining, [
            ...scenesToCopy,
        ]);
        scenesToCopy = updatedScenesToCopy;
    }

    const totalBytesToCopy = getTotalSize(scenesToCopy);
    const remainingBytesAfterCopy = destFreeSpace - totalBytesToCopy;
    print("Operation will copy ", "red");
    print(`${scenesToCopy.length}`, "green");
    print(" Scenes totalling ", "red");
    print(formatBytes(totalBytesToCopy), "cyan");
    print(" to ", "red");
    print(destFolder, "blue");
    print(" leaving ", "red");
    print(formatBytes(remainingBytesAfterCopy), "cyan");
    print(" remaining afterward.\n", "red");

    const isOKToCopy = await yesOrNo("Proceed? Selecting no will start over");
    print("");
    if (!isOKToCopy) {
        return await copyFilesController();
    }

    for (let i = 0; i < scenesToCopy.length; i++) {
        await copyScene(scenesToCopy[i], destFolder, srcBaseFolder);
    }

    const shouldGenerateActorMetadata = await yesOrNo(
        "Would you like to generate Emby/Jellyfin 'People' metadata files?"
    );
    print("");
    if (shouldGenerateActorMetadata) {
        await generateActorsMetadata(scenesToCopy, destFolder);
    }

    await buildMenu(getManageFilesMenuItems());
};
