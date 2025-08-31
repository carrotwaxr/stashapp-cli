import { analyzePerformersController } from "../../controllers/analyzePerformers.js";
import { analyzeStudiosController } from "../../controllers/analyzeStudios.js";
import { copyFilesController } from "../../controllers/copyFiles.js";
import { organizeLibraryController } from "../../controllers/organizeLibrary.js";
import { rateStashController } from "../../controllers/rateStashController.js";
import { backCommand } from "../back.js";
import { quitCommand } from "../quit.js";
import { buildMenu, MenuItem } from "./buildMenu.js";

export const getAnalyzeMenuItems = (): MenuItem[] => [
    {
        name: "Tell me about my Performers",
        controller: analyzePerformersController,
    },
    {
        name: "Tell me about my Studios",
        controller: analyzeStudiosController,
    },
    {
        name: "Rate my Stash",
        controller: rateStashController,
    },
    {
        name: "Back",
        controller: backCommand,
    },
    {
        name: "Quit",
        controller: quitCommand,
    },
];

export const getMainMenuItems = (): MenuItem[] => [
    {
        name: "Analyze my Stash",
        controller: async () => {
            await buildMenu(
                getAnalyzeMenuItems(),
                "What would you like to analyze?"
            );
        },
    },
    {
        name: "Manage Files",
        controller: async () => {
            await buildMenu(getManageFilesMenuItems());
        },
    },
    {
        name: "Quit",
        controller: quitCommand,
    },
];

export const getManageFilesMenuItems = (): MenuItem[] => [
    {
        name: "Copy Files",
        controller: copyFilesController,
    },
    {
        name: "Organize Library Files",
        controller: organizeLibraryController,
    },
    {
        name: "Back",
        controller: backCommand,
    },
    {
        name: "Quit",
        controller: quitCommand,
    },
];
