import { print } from "../utils/terminal.js";
import { buildMenu } from "./menus/buildMenu.js";
import { getMainMenuItems } from "./menus/menuItems.js";

export const backCommand = async (
    prevMenuFn = () => buildMenu(getMainMenuItems())
) => {
    print("Going back to the previous menu...", "yellow");
    await prevMenuFn();
};
