import fs from "fs";
import { backCommand } from "../../commands/back.js";
import { buildMenu } from "../../commands/menus/buildMenu.js";
import { getManageFilesMenuItems } from "../../commands/menus/menuItems.js";
import {
    checkboxMenu,
    input,
    print,
    selectMenu,
    yesOrNo,
} from "../../utils/terminal.js";
import type { SceneFilterSelectionOption, UserOrganizationDetails } from "./types.js";

export const getUserOrganizationDetails =
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
                        id: { modifier: 'NOT_NULL', value: 0 },
                    },
                },
                {
                    text: "Studio not null",
                    checked: isStudioFilterLocked,
                    disabled: isStudioFilterLocked,
                    sceneFilter: {
                        studios: {
                            modifier: 'NOT_NULL',
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
                            modifier: 'NOT_NULL',
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
                            modifier: 'NOT_NULL',
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
                            modifier: 'NOT_NULL',
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
                            modifier: 'GREATER_THAN',
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
                            modifier: 'GREATER_THAN',
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
                            modifier: 'GREATER_THAN',
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
                            modifier: 'GREATER_THAN',
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
