/**
 * Prints an array of strings, cycling through a set of colors.
 */
export function rotatingColors(
    items: string[],
    colors: Array<keyof typeof chalk> = [
        "cyan",
        "magenta",
        "yellow",
        "green",
        "blue",
    ]
): void {
    items.forEach((item, idx) => {
        print(item, colors[idx % colors.length]);
    });
}
import checkboxPrompt from "@inquirer/checkbox";
import confirmPrompt from "@inquirer/confirm";
import inputPrompt from "@inquirer/input";
import selectPrompt from "@inquirer/select";
import chalk from "chalk";

export const print = (text: string, color?: keyof typeof chalk) => {
    if (color && typeof chalk[color] === "function") {
        // @ts-ignore
        console.log(chalk[color](text));
    } else {
        console.log(text);
    }
};

export const input = async (
    text: string,
    defaultValue?: string
): Promise<string> => {
    return await inputPrompt({ message: text, default: defaultValue });
};

export const selectMenu = async (
    items: string[]
): Promise<{ selectedIndex: number; selectedText: string }> => {
    const selectedText = await selectPrompt({
        message: "Select an option:",
        choices: items.map((item, idx) => ({ name: item, value: item })),
    });
    return { selectedIndex: items.indexOf(selectedText), selectedText };
};

/**
 * Shows a loading message, returns a function to print a completion message.
 * Usage:
 *   const finish = loadingText("Loading...");
 *   // ...async work...
 *   finish("Done!");
 */
export function loadingText(message: string) {
    print(message, "yellow");
    return (doneMessage?: string) => {
        if (doneMessage) print(doneMessage, "green");
    };
}

export const checkboxMenu = async (
    items: { text: string; checked?: boolean; disabled?: boolean }[]
): Promise<{ selectedIndexes: number[]; selectedText: string[] }> => {
    const choices = items.map((item, idx) => ({
        name: item.text,
        value: idx,
        checked: item.checked || false,
        disabled: item.disabled || false,
    }));
    const selected = await checkboxPrompt({
        message: "Select options:",
        choices,
    });
    const selectedIndexes = selected;
    const selectedText = selectedIndexes.map((idx: number) => items[idx].text);
    return { selectedIndexes, selectedText };
};

export const yesOrNo = async (text: string): Promise<boolean> => {
    return await confirmPrompt({ message: text });
};
