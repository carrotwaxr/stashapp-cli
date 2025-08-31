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

    await menuItems[selectedIndex].controller();
}
