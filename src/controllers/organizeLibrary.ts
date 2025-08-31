import chalk from "chalk";
import fs from "fs";
import path from "path";
import { GenderEnum, Scene, SceneFilterType, Studio } from "stashapp-api";
import { CriterionModifier } from "stashapp-api/dist/generated/graphql.js";
import { backCommand } from "../commands/back.js";
import { buildMenu } from "../commands/menus/buildMenu.js";
import { getManageFilesMenuItems } from "../commands/menus/menuItems.js";
import { getStashInstance } from "../stash.js";
import { buildSceneNFO } from "../utils/nfo.js";
import {
    checkboxMenu,
    input,
    print,
    selectMenu,
    yesOrNo,
} from "../utils/terminal.js";

type SceneFilterSelectionOption = {
    text: string;
    checked?: boolean;
    disabled?: boolean;
    sceneFilter?: SceneFilterType;
};

type SceneWithMetadata = {
    scene: Scene;
    organizerMetadata: OrganizerSceneMetadata;
};

type OrganizerSceneMetadata = {
    newFilepath: string;
    currentFilepath: string;
    nfoXML: string;
};

type OrganizerSceneResults = {
    success: boolean;
    skipped: boolean;
    message: string;
};

type UserOrganizationDetails = {
    organizationType: string;
    studioStructure?: string;
    performerGender?: string;
    sceneFilter: SceneFilterType;
    stashDataPath: string;
    maleFilter: boolean;
    femaleFilter: boolean;
    filenameFormatString: string;
};

// Characters not allowed in Windows filenames: \/:*?"<>|
const INVALID_FILENAME_CHARS = /[\\/:*?"<>|]/g;

const MAX_FILENAME_LENGTH = 255;

export const organizeLibraryController = async () => {
    const stash = getStashInstance();

    const organizationDetails = await getUserOrganizationDetails();

    if (!organizationDetails) return;

    const { findScenes } = await stash.findScenes({
        filter: {
            per_page: -1,
        },
        scene_filter: {
            ...organizationDetails.sceneFilter,
        },
    });

    const {
        findStudios: { studios },
    } = await stash.findStudios({
        filter: { per_page: -1 },
    });

    // Build scenesToOrganize and filter out duplicates by newFilepath
    const allScenes = filterScenesByPerformerSelections(
        findScenes.scenes as Scene[],
        organizationDetails.maleFilter,
        organizationDetails.femaleFilter
    ).map((scene) => {
        return {
            organizerMetadata: hydrateMetadata(
                scene,
                studios as Studio[],
                organizationDetails
            ),
            scene,
        };
    });

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

    // Validate stashDataPath by checking if the first scene's file exists
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

    // Prompt user for dry run or actual move
    const { selectedText: runMode } = await selectMenu([
        "Dry run (show what would happen)",
        "Move files (actually organize)",
    ]);
    const isDryRun = runMode.startsWith("Dry run");

    // Call organizeScenes with scenes array and dry run selection
    const results = organizeScenes(scenesToOrganize, isDryRun);

    await stash.metadataScan({ input: { paths: null } });

    // Notify user about scan
    console.log();
    console.log("\n" + "----------------------------------------");
    console.log(
        "A Scan was triggered. Stash will update its database with new filepaths after it finishes."
    );
    console.log("----------------------------------------\n");

    // Count results
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

    // Summarize results
    console.log(`Summary:`);
    console.log(`  Moved:   ${moved}`);
    console.log(`  Skipped: ${skipped}`);
    console.log(`  Failed:  ${failed}`);
    console.log();

    // Return to previous menu
    await backCommand(() => buildMenu(getManageFilesMenuItems()));
};

const buildFileName = (
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
        .filter((p) => p.gender === GenderEnum.Male)
        .map((p) => p.name)
        .join(" ");
    let femalePerformersStr = performers
        .filter((p) => p.gender === GenderEnum.Female)
        .map((p) => p.name)
        .join(" ");
    let tagsStr = tags.map((t) => t.name).join(" ");

    // Replace placeholders in the filename format string
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

    // Will be positive if the filename is too long
    let overflowCharCount = fullReplaceResult.length - MAX_FILENAME_LENGTH;

    if (overflowCharCount <= 0) {
        return fullReplaceResult;
    }

    if (hasTags) {
        const keptTags = tagsStr.slice(0, -overflowCharCount);
        overflowCharCount -= tagsStr.length;
        tagsStr = keptTags;
    }

    if (hasMalePerformers && overflowCharCount > 0) {
        const keptMalePerformers = malePerformersStr.slice(
            0,
            -overflowCharCount
        );
        overflowCharCount -= malePerformersStr.length;
        malePerformersStr = keptMalePerformers;
    }

    if (hasFemalePerformers && overflowCharCount > 0) {
        const keptFemalePerformers = femalePerformersStr.slice(
            0,
            -overflowCharCount
        );
        overflowCharCount -= femalePerformersStr.length;
        femalePerformersStr = keptFemalePerformers;
    }

    if (hasTitle && overflowCharCount > 0) {
        const keptTitle = titleStr.slice(0, -overflowCharCount);
        overflowCharCount -= titleStr.length;
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

const filterScenesByPerformerSelections = (
    scenes: Scene[],
    maleFilter: boolean,
    femaleFilter: boolean
): Scene[] => {
    if (!maleFilter && !femaleFilter) return scenes;

    return scenes.filter((scene) => {
        const hasMalePerformer = scene.performers.some(
            (p) => p.gender === GenderEnum.Male
        );
        const hasFemalePerformer = scene.performers.some(
            (p) => p.gender === GenderEnum.Female
        );

        if (maleFilter && femaleFilter)
            return hasMalePerformer && hasFemalePerformer;

        if (maleFilter) return hasMalePerformer;

        if (femaleFilter) return hasFemalePerformer;

        return false;
    });
};

const generatePerformerFolders = (
    scene: Scene,
    organizationDetails: UserOrganizationDetails
) => {
    const matchingPerformers = scene.performers.filter(
        (p) => p.gender === organizationDetails.performerGender
    );

    // Filter for favorited performers if any
    const favoritedPerformers = matchingPerformers.filter(
        (p) => p.favorite === true
    );
    const filteredPerformers =
        favoritedPerformers.length > 0
            ? favoritedPerformers
            : matchingPerformers;

    // Sort by o_counter descending (highest first)
    const sortedPerformers = filteredPerformers.sort(
        (a, b) => (b.o_counter ?? 0) - (a.o_counter ?? 0)
    );
    const topPerformer = sortedPerformers[0];
    return [topPerformer.name];
};

const generateStudioFolders = (
    scene: Scene,
    studios: Studio[],
    organizationDetails: UserOrganizationDetails
) => {
    if (organizationDetails.studioStructure === "Flat") {
        return [scene.studio?.name];
    }

    const ancestors: Studio[] = [];
    let currentStudio: Studio | undefined = studios.find(
        (s) => s.name === scene.studio?.name
    );
    ancestors.push(currentStudio as Studio);
    while (currentStudio && currentStudio.parent_studio) {
        const parent = studios.find(
            (s) => s.name === (currentStudio as Studio).parent_studio?.name
        );
        if (parent) {
            ancestors.push(parent);
            currentStudio = parent;
        } else {
            break;
        }
    }

    return ancestors.reverse().map((a) => a.name);
};

function getResolution(file: { height?: number; width?: number }): string {
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

const getUserOrganizationDetails =
    async (): Promise<UserOrganizationDetails | null> => {
        try {
            print(
                "\nThis command will find all Scenes matching a provided criteria, and attempt to move and/or rename to an opinionated, organized folder structure.\n",
                "yellow"
            );

            let proceed = await yesOrNo("Do you want to continue?");
            print("\n");
            if (!proceed) {
                print("Returning to previous menu.\n", "red");
                await backCommand(() => buildMenu(getManageFilesMenuItems()));
                return null;
            }

            // Prompt user for Stash /data directory path
            print(
                "\nPlease provide the path to your Stash /data directory (relative to your current system):",
                "yellow"
            );
            // If inquirer supports file browsing, use it here. Otherwise, fallback to text input.
            // For now, we use input()
            let stashDataPath = await input(
                "Enter the full path to your Stash /data directory:"
            );

            let validPath = fs.existsSync(stashDataPath);
            while (!validPath) {
                print(
                    `The path you entered does not exist. Please try again.\n`,
                    "red"
                );
                stashDataPath = await input(
                    "Enter the full path to your Stash /data directory:"
                );
                validPath = fs.existsSync(stashDataPath);
                if (validPath) {
                    print(`You entered: ${stashDataPath}\n`, "green");
                    break;
                }
            }
            if (validPath) {
                print(`You entered: ${stashDataPath}\n`, "green");
            }

            // Prompt for organization method after confirmation
            print("How would you like to organize your folders?\n", "yellow");
            print(
                "By Studio: Recommended. Each Scene will only have one Studio, so files will be placed in folders named after the Studio.\n",
                "cyan"
            );

            print(
                "By Performer: You can choose to organize by male or female Performers. Since a Scene may have multiple performers, we will attempt to determine your favorite and place the Scene in that Performer's folder.\n",
                "magenta"
            );
            print("\n");

            const { selectedText: organizationType } = await selectMenu([
                "Studio",
                "Performer",
            ]);
            print("\n");

            // Next steps: branch logic based on Studio or Performer selection
            let studioStructure: string | undefined = undefined;
            let performerGender: string | undefined = undefined;

            if (organizationType === "Studio") {
                print(
                    "How would you like your Studio folders to be organized?\n",
                    "yellow"
                );
                print("Flat: Each Studio is at the root level.\n", "cyan");
                print(
                    "Nested: Each Studio appears inside its parent Studio's folder, if applicable.\n",
                    "magenta"
                );
                print("\n");
                studioStructure = (await selectMenu(["Flat", "Nested"]))
                    .selectedText;
            } else if (organizationType === "Performer") {
                print(
                    "Would you like to organize by Male or Female Performer?\n",
                    "yellow"
                );
                print(
                    "Male: Scenes will be placed in folders named after your favorite male performer in each scene.\n",
                    "cyan"
                );
                print(
                    "Female: Scenes will be placed in folders named after your favorite female performer in each scene.\n",
                    "magenta"
                );
                print("\n");
                performerGender = (await selectMenu(["Male", "Female"]))
                    .selectedText;
            }

            print(
                "\nNext, select the fields to use for generating filenames.\n",
                "yellow"
            );
            print(
                "To avoid filename conflicts, select enough fields to ensure uniqueness. Title or Stash ID are required.\n"
            );
            print(
                "Keep in mind: some fields may not have values for all Scenes. In some cases, the field can simply be omitted safely from the filename. In other cases, the field will be considered required and Scenes missing this value will not be organized.\n"
            );

            // Checkbox menu for selecting Scene fields for filename generation
            const filenameFieldOptions = [
                { text: "Date", checked: true, fieldName: "date" },
                {
                    text: "Stash ID (required if selected)",
                    checked: false,
                    fieldName: "id",
                },
                {
                    text: "Male Performers",
                    checked: true,
                    fieldName: "performers_male",
                },
                {
                    text: "Female Performers",
                    checked: true,
                    fieldName: "performers_female",
                },
                { text: "Resolution", checked: true, fieldName: "resolution" },
                {
                    text: "Studio (required if selected)",
                    checked: true,
                    fieldName: "studio",
                },
                { text: "Tags", checked: false, fieldName: "tags" },
                {
                    text: "Title (required if selected)",
                    checked: true,
                    fieldName: "title",
                },
            ];

            let filenameFieldSelections =
                await checkboxMenu(filenameFieldOptions);
            // Map selectedText to fieldName for output and logic
            const selectedFieldObjs = filenameFieldOptions.filter((opt) =>
                filenameFieldSelections.selectedText.includes(opt.text)
            );
            print(
                `\nYou selected these fields for filename generation: ${selectedFieldObjs.map((f) => f.fieldName).join(", ")}\n`
            );

            // Uniqueness check for filename fields
            const selectedFields = selectedFieldObjs.map((f) => f.fieldName);
            const hasStashId =
                selectedFields.includes("stash_id") ||
                selectedFields.includes("id");
            const hasTitle = selectedFields.includes("title");
            if (!hasStashId && (!hasTitle || selectedFields.length < 2)) {
                print(
                    "\nTo ensure uniqueness, you must select either Stash ID, or Title plus at least one other field.\n",
                    "red"
                );
                let valid = false;
                while (!valid) {
                    const newSelections =
                        await checkboxMenu(filenameFieldOptions);
                    const newFieldObjs = filenameFieldOptions.filter((opt) =>
                        newSelections.selectedText.includes(opt.text)
                    );
                    const newFields = newFieldObjs.map((f) => f.fieldName);
                    const newHasStashId =
                        newFields.includes("stash_id") ||
                        newFields.includes("id");
                    const newHasTitle = newFields.includes("title");
                    if (
                        newHasStashId ||
                        (newHasTitle && newFields.length > 1)
                    ) {
                        filenameFieldSelections = newSelections;
                        valid = true;
                    } else {
                        print(
                            "\nInvalid selection. Please select either Stash ID, or Title plus at least one other field.\n",
                            "red"
                        );
                    }
                }
                const finalFieldObjs = filenameFieldOptions.filter((opt) =>
                    filenameFieldSelections.selectedText.includes(opt.text)
                );
                print(
                    `\nFinal fields for filename generation: ${finalFieldObjs.map((f) => f.fieldName).join(", ")}\n`
                );
            }

            // Prompt user to select the order of filename fields
            let orderedFields: string[] = [];
            let remainingFieldObjs = filenameFieldOptions.filter((opt) =>
                filenameFieldSelections.selectedText.includes(opt.text)
            );
            let position = 1;
            while (remainingFieldObjs.length > 0) {
                print(
                    `\nSelect the field to use for part ${position} of the filename:`,
                    "yellow"
                );
                const { selectedText } = await selectMenu(
                    remainingFieldObjs.map((f) => f.text)
                );
                const selectedObj = remainingFieldObjs.find(
                    (f) => f.text === selectedText
                );
                if (selectedObj) orderedFields.push(selectedObj.fieldName);
                remainingFieldObjs = remainingFieldObjs.filter(
                    (f) => f.text !== selectedText
                );
                position++;
            }
            print(`\nFilename field order: ${orderedFields.join(" | ")}\n`);

            // Prompt user for separator string between each field
            const validSeparators = [
                "-",
                "_",
                ".",
                " ",
                "(",
                ")",
                "[",
                "]",
                "{",
                "}",
                "+",
                "=",
            ];
            print(
                `\nChoose a separator to use between each part of your filename.\nValid characters: ${validSeparators.join(" ")}\n`,
                "yellow"
            );
            let separators: string[] = [];
            for (let i = 0; i < orderedFields.length - 1; i++) {
                let valid = false;
                let sep = "";
                while (!valid) {
                    sep = await input(
                        `Enter separator between {${orderedFields[i].toLowerCase().replace(/ /g, "_")}} and {${orderedFields[i + 1].toLowerCase().replace(/ /g, "_")}}:`
                    );
                    if (
                        sep.split("").every((c) => validSeparators.includes(c))
                    ) {
                        valid = true;
                    } else {
                        print(
                            `Invalid separator. Please use only these characters: ${validSeparators.join(" ")}\n`,
                            "red"
                        );
                    }
                }
                separators.push(sep);
            }

            // Prompt for a final separator to append to the end of the filename
            let finalSeparator = "";
            let validFinal = false;
            if (orderedFields.length > 0) {
                while (!validFinal) {
                    finalSeparator = await input(
                        `Enter a final separator to append after the last field (or leave blank for none):`
                    );
                    if (
                        finalSeparator === "" ||
                        finalSeparator
                            .split("")
                            .every((c) => validSeparators.includes(c))
                    ) {
                        validFinal = true;
                    } else {
                        print(
                            `Invalid separator. Please use only these characters: ${validSeparators.join(" ")}\n`,
                            "red"
                        );
                    }
                }
            }

            // Update filename format output to include final separator
            let filenameFormat = "";
            for (let i = 0; i < orderedFields.length; i++) {
                filenameFormat += `{${orderedFields[i].toLowerCase().replace(/ /g, "_")}}`;
                if (i < separators.length) filenameFormat += separators[i];
            }
            filenameFormat += finalSeparator;
            print(
                `\nYour filename format will look like:\n${filenameFormat}\n`,
                "green"
            );

            // Multi-select filter criteria using terminal-kit checkboxMenu (at end of function)
            print(
                "\nSelect filter criteria for Scenes (use Spacebar to select, Enter to confirm). Title or Stash ID should be selected as these will be needed later for filename uniqueness, and some options will be locked based on your previous selections:\n",
                "yellow"
            );

            const isStashIDFilterLocked =
                filenameFieldSelections.selectedText.includes("Stash");

            const isStudioFilterLocked =
                organizationType === "Studio" ||
                filenameFieldSelections.selectedText.includes("Studio");

            const isTitleFilterLocked =
                filenameFieldSelections.selectedText.includes("Title");

            let filterOptions: SceneFilterSelectionOption[] = [
                {
                    text: "Stash ID not null",
                    checked: isStashIDFilterLocked,
                    disabled: isStashIDFilterLocked,
                    sceneFilter: {
                        id: { modifier: CriterionModifier.NotNull, value: 0 },
                    },
                },
                {
                    text: "Studio not null",
                    checked: isStudioFilterLocked,
                    disabled: isStudioFilterLocked,
                    sceneFilter: {
                        studios: {
                            modifier: CriterionModifier.NotNull,
                            value: [""],
                        },
                    },
                },
                {
                    text: "Title not null",
                    checked: isTitleFilterLocked,
                    disabled: isTitleFilterLocked,
                    sceneFilter: {
                        title: {
                            modifier: CriterionModifier.NotNull,
                            value: "",
                        },
                    },
                },
                {
                    text: "Date not null",
                    checked: true,
                    disabled: false,
                    sceneFilter: {
                        date: {
                            modifier: CriterionModifier.NotNull,
                            value: "",
                        },
                    },
                },
                {
                    text: "Details not null",
                    checked: false,
                    disabled: false,
                    sceneFilter: {
                        details: {
                            modifier: CriterionModifier.NotNull,
                            value: "",
                        },
                    },
                },
                {
                    text: "Has at least 1 Male Performer",
                    checked: true,
                    disabled:
                        organizationType === "Performer" &&
                        performerGender === "Male",
                    sceneFilter: {
                        performer_count: {
                            modifier: CriterionModifier.GreaterThan,
                            value: 0,
                        },
                    },
                },
                {
                    text: "Has at least 1 Female Performer",
                    checked: true,
                    disabled:
                        organizationType === "Performer" &&
                        performerGender === "Female",
                    sceneFilter: {
                        performer_count: {
                            modifier: CriterionModifier.GreaterThan,
                            value: 0,
                        },
                    },
                },
                {
                    text: "Has at least 1 Tag",
                    checked: true,
                    disabled: false,
                    sceneFilter: {
                        tag_count: {
                            modifier: CriterionModifier.GreaterThan,
                            value: 0,
                        },
                    },
                },
                {
                    text: "O Counter greater than 0",
                    checked: true,
                    disabled: false,
                    sceneFilter: {
                        o_counter: {
                            modifier: CriterionModifier.GreaterThan,
                            value: 0,
                        },
                    },
                },
                {
                    text: "Is Marked as Organized",
                    checked: false,
                    disabled: false,
                    sceneFilter: { organized: true },
                },
            ];

            let filterSelections = await checkboxMenu(
                filterOptions.map((opt) => ({
                    text: opt.text,
                    checked: opt.checked,
                    disabled: opt.disabled,
                }))
            );

            print(
                `\nYou selected: ${filterSelections.selectedText.join(", ")}\n`
            );

            // Output all user selections
            print("\nSummary of your selections:\n");
            print(`Organization type: ${organizationType}\n`);
            if (studioStructure)
                print(`Studio structure: ${studioStructure}\n`);
            if (performerGender)
                print(`Performer gender: ${performerGender}\n`);
            // Build combined filename format string with placeholders and separators
            let filenameFormatString = "";
            for (let i = 0; i < orderedFields.length; i++) {
                filenameFormatString += `{${orderedFields[i].toLowerCase().replace(/ /g, "_")}}`;
                if (i < separators.length)
                    filenameFormatString += separators[i];
            }
            filenameFormatString += finalSeparator + ".{ext}";
            print(`Filename format: ${filenameFormatString}\n`);
            print(
                `Filter criteria: ${filterSelections.selectedText.join(", ")}\n`
            );

            // Generate a mock Scene object for the example
            const mockScene = {
                stash_id: "12345",
                title: "Lexi Belle fucking in the desk with her tattoos",
                studio: "Naughty Bookworms",
                parent_studio: "Naughty America",
                date: "2023-08-18",
                resolution: "1080p",
                tags: ["Teacher", "Schoolgirl", "Blonde", "Desk", "Classroom"],
                performers: [
                    { name: "Lexi Belle", gender: "Female" },
                    { name: "Jay Crew", gender: "Male" },
                ],
            };

            // Build the example filename using the selected fields and separators
            let exampleFilename = "";
            for (let i = 0; i < orderedFields.length; i++) {
                let field = orderedFields[i];
                let value = "";
                switch (field) {
                    case "Date":
                        value = mockScene.date;
                        break;
                    case "Stash ID":
                    case "Stash ID (required if selected)":
                        value = mockScene.stash_id;
                        break;
                    case "Title":
                    case "Title (required if selected)":
                        value = mockScene.title;
                        break;
                    case "Studio":
                    case "Studio (required if selected)":
                        value = mockScene.studio;
                        break;
                    case "Resolution":
                        value = mockScene.resolution;
                        break;
                    case "Tags":
                        value = mockScene.tags.join("-");
                        break;
                    case "Male Performers":
                        value = mockScene.performers
                            .filter((p) => p.gender === "Male")
                            .map((p) => p.name)
                            .join(", ");
                        break;
                    case "Female Performers":
                        value = mockScene.performers
                            .filter((p) => p.gender === "Female")
                            .map((p) => p.name)
                            .join(", ");
                        break;
                    default:
                        value = `{${field.toLowerCase().replace(/ /g, "_")}}`;
                }
                exampleFilename += value;
                if (i < separators.length) exampleFilename += separators[i];
            }
            exampleFilename += finalSeparator;

            // Build the example folder structure
            print("\nExample folder structure:\n");
            if (organizationType === "Studio" && studioStructure === "Flat") {
                print(`${mockScene.studio}\n`);
                print(`  ${exampleFilename}.mp4\n`);
            } else if (
                organizationType === "Studio" &&
                studioStructure === "Nested"
            ) {
                print(`${mockScene.parent_studio}\n`);
                print(`  ${mockScene.studio}\n`);
                print(`    ${exampleFilename}.{ext}\n`);
            } else if (
                organizationType === "Performer" &&
                performerGender === "Female"
            ) {
                print(
                    `${mockScene.performers
                        .filter((p) => p.gender === "Female")
                        .map((p) => p.name)
                        .join(", ")}\n`
                );
                print(`  ${mockScene.studio} - ${exampleFilename}.{ext}\n`);
            } else if (
                organizationType === "Performer" &&
                performerGender === "Male"
            ) {
                print(
                    `${mockScene.performers
                        .filter((p) => p.gender === "Male")
                        .map((p) => p.name)
                        .join(", ")}\n`
                );
                print(`  ${mockScene.studio} - ${exampleFilename}.{ext}\n`);
            }

            proceed = await yesOrNo("Do you want to continue?");
            print("\n");
            if (!proceed) {
                print("Returning to previous menu.\n", "red");
                await backCommand(() => buildMenu(getManageFilesMenuItems()));
                return null;
            }
            // Merge all selected sceneFilter objects into one
            const selectedFilterObjs = filterOptions.filter((opt) =>
                filterSelections.selectedText.includes(opt.text)
            );
            const mergedSceneFilters = Object.assign(
                {},
                ...selectedFilterObjs.map((opt) => opt.sceneFilter ?? {})
            );
            return {
                organizationType,
                studioStructure,
                performerGender,
                sceneFilter: mergedSceneFilters,
                stashDataPath,
                maleFilter: filterSelections.selectedText.includes(
                    "Has at least 1 Male Performer"
                ),
                femaleFilter: filterSelections.selectedText.includes(
                    "Has at least 1 Female Performer"
                ),
                filenameFormatString,
            };
        } catch (err) {
            console.error("An error occurred:", err);
            process.exit(1);
        }
    };

const hydrateMetadata = (
    scene: Scene,
    studios: Studio[],
    organizationDetails: UserOrganizationDetails
): OrganizerSceneMetadata => {
    const folders =
        organizationDetails.organizationType === "Performer"
            ? generatePerformerFolders(scene, organizationDetails)
            : generateStudioFolders(scene, studios, organizationDetails);

    // Build newFilepath (target) and currentFilepath (source) as system paths
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

// Organize a single scene (stub)
function organizeScene(
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

        // Get directory and base name (without extension)
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

        // Find all files in currentDir with the same base name and any extension
        const files = fs.readdirSync(currentDir);
        const matchingFiles = files.filter(
            (f) => path.basename(f, path.extname(f)) === baseName
        );

        // If main file is already at the target path, skip moving all files
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
                    // Ensure target directory exists
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

        // Write new .nfo file
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

// Organize all scenes
function organizeScenes(
    scenes: SceneWithMetadata[],
    isDryRun: boolean
): OrganizerSceneResults[] {
    const results: OrganizerSceneResults[] = [];
    for (const sceneObj of scenes) {
        // Await each scene one at a time
        const result = organizeScene(sceneObj, isDryRun);
        results.push(result);
    }
    return results;
}

function sanitizeFilenamePart(part: string): string {
    return part.replace(INVALID_FILENAME_CHARS, "");
}

// Convert Linux-style path to system-specific path
function toSystemPath(linuxPath: string): string {
    if (process.platform === "win32") {
        return linuxPath.replace(/\//g, "\\");
    }
    return linuxPath;
}
