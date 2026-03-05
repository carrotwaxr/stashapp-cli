import chalk from "chalk";
import { print, selectMenu } from "../../utils/terminal.js";

export type MenuItem = {
    name: string;
    controller: () => Promise<void> | void;
};

export async function buildMenu(
    menuItems: MenuItem[],
    prompt: string = "What would you like to do?"
): Promise<void> {
    print(`\n${prompt}\n`, "yellow");

    const menuOptions = menuItems.map((item) => item.name);

    const { selectedIndex } = (await selectMenu(menuOptions)) as {
        selectedIndex: number;
    };

    try {
        await menuItems[selectedIndex].controller();
    } catch (error) {
        console.error(chalk.red(`\nSomething went wrong: ${error instanceof Error ? error.message : error}`));
        await buildMenu(menuItems, prompt);
    }
}
