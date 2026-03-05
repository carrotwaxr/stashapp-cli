import fs from "fs";
import { SceneFields, StudioFields } from "stashapp-api";
import type { Scene, Studio } from "stashapp-api";
import { backCommand } from "../../commands/back.js";
import { buildMenu } from "../../commands/menus/buildMenu.js";
import { getManageFilesMenuItems } from "../../commands/menus/menuItems.js";
import { getStashInstance } from "../../stash.js";
import { input, print, selectMenu } from "../../utils/terminal.js";
import { hydrateMetadata, organizeScenes, toSystemPath } from "./fileOps.js";
import { filterScenesByPerformerSelections } from "./folders.js";
import { getUserOrganizationDetails } from "./prompts.js";

export const organizeLibraryController = async () => {
    const stash = getStashInstance();

    const organizationDetails = await getUserOrganizationDetails();

    if (!organizationDetails) return;

    const { findScenes } = await stash.query({
        findScenes: {
            __args: {
                filter: { per_page: -1 },
                scene_filter: { ...organizationDetails.sceneFilter },
            },
            count: true,
            scenes: {
                ...SceneFields,
                files: { path: true, basename: true, size: true },
            },
        },
    });

    const {
        findStudios: { studios },
    } = await stash.query({
        findStudios: {
            __args: { filter: { per_page: -1 } },
            studios: { ...StudioFields, parent_studio: { id: true, name: true } },
        },
    });

    const allScenes = filterScenesByPerformerSelections(
        findScenes.scenes as Scene[],
        organizationDetails.maleFilter,
        organizationDetails.femaleFilter
    ).map((scene) => ({
        organizerMetadata: hydrateMetadata(
            scene,
            studios as Studio[],
            organizationDetails
        ),
        scene,
    }));

    const seenFilepaths = new Set<string>();
    const scenesToOrganize: typeof allScenes = [];
    const duplicateScenes: typeof allScenes = [];
    for (const s of allScenes) {
        const fp = s.organizerMetadata.newFilepath;
        if (seenFilepaths.has(fp)) {
            duplicateScenes.push(s);
        } else {
            seenFilepaths.add(fp);
            scenesToOrganize.push(s);
        }
    }

    let stashDataPath = organizationDetails.stashDataPath;
    let validFile = false;
    if (
        scenesToOrganize.length > 0 &&
        scenesToOrganize[0].scene.files &&
        scenesToOrganize[0].scene.files.length > 0
    ) {
        print(
            "Found " +
                scenesToOrganize.length +
                " scenes to organize. Removed " +
                duplicateScenes.length +
                " duplicates."
        );

        let filePath = scenesToOrganize[0].scene.files[0].path.replace(
            /^\/data/,
            stashDataPath
        );
        filePath = toSystemPath(filePath);
        validFile = fs.existsSync(filePath);
        while (!validFile) {
            print(
                "The file " +
                    filePath +
                    " does not exist. Please re-enter your Stash /data directory path.",
                "red"
            );
            stashDataPath = await input(
                "Enter the full path to your Stash /data directory:"
            );
            filePath = scenesToOrganize[0].scene.files[0].path.replace(
                /^\/data/,
                stashDataPath
            );
            filePath = toSystemPath(filePath);
            validFile = fs.existsSync(filePath);
        }
        print("Verified file exists: " + filePath, "green");
    }

    const { selectedText: runMode } = await selectMenu([
        "Dry run (show what would happen)",
        "Move files (actually organize)",
    ]);
    const isDryRun = runMode.startsWith("Dry run");

    const results = organizeScenes(scenesToOrganize, isDryRun);

    await stash.mutation({
        metadataScan: {
            __args: { input: {} },
            __typename: true,
        },
    });

    console.log();
    console.log("\n" + "----------------------------------------");
    console.log(
        "A Scan was triggered. Stash will update its database with new filepaths after it finishes."
    );
    console.log("----------------------------------------\n");

    let moved = 0,
        failed = 0,
        skipped = 0;
    for (const result of results) {
        if (result.success === true && result.skipped) {
            skipped++;
        } else if (result.success === true) {
            moved++;
        } else {
            failed++;
        }
    }

    console.log(`Summary:`);
    console.log(`  Moved:   ${moved}`);
    console.log(`  Skipped: ${skipped}`);
    console.log(`  Failed:  ${failed}`);
    console.log();

    await backCommand(() => buildMenu(getManageFilesMenuItems()));
};
