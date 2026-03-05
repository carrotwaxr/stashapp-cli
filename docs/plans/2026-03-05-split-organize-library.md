# Split organizeLibrary.ts Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split the 1171-line `organizeLibrary.ts` god controller into focused modules under `src/controllers/organize/`.

**Architecture:** Extract 6 domain modules from the monolith. The controller becomes a thin orchestrator that imports from sibling modules. All types are shared via `types.ts`. No behavior changes — pure structural refactor.

**Tech Stack:** TypeScript, stashapp-api, chalk, fs, path

**Verification:** `npm run build` compiles cleanly, `npx vitest run` passes all 17 existing tests, the public export (`organizeLibraryController`) is unchanged.

---

### Task 1: Create types.ts

**Files:**
- Create: `src/controllers/organize/types.ts`

**Step 1: Create the types module**

Extract all shared types and constants from `organizeLibrary.ts` lines 19-57:

```typescript
import type { Scene, SceneFilterType } from "stashapp-api";

export type SceneFilterSelectionOption = {
    text: string;
    checked?: boolean;
    disabled?: boolean;
    sceneFilter?: SceneFilterType;
};

export type SceneWithMetadata = {
    scene: Scene;
    organizerMetadata: OrganizerSceneMetadata;
};

export type OrganizerSceneMetadata = {
    newFilepath: string;
    currentFilepath: string;
    nfoXML: string;
};

export type OrganizerSceneResults = {
    success: boolean;
    skipped: boolean;
    message: string;
};

export type UserOrganizationDetails = {
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
export const INVALID_FILENAME_CHARS = /[\\/:*?"<>|]/g;

export const MAX_FILENAME_LENGTH = 255;
```

**Step 2: Verify build**

Run: `npm run build`
Expected: PASS (new file, nothing imports it yet)

---

### Task 2: Create filename.ts

**Files:**
- Create: `src/controllers/organize/filename.ts`

**Step 1: Create the filename module**

Extract `buildFileName` (lines 214-306) and `getResolution` (lines 388-400):

```typescript
import type { Scene } from "stashapp-api";
import { MAX_FILENAME_LENGTH, type UserOrganizationDetails } from "./types.js";

export const buildFileName = (
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
        .filter((p) => p.gender === 'MALE')
        .map((p) => p.name)
        .join(" ");
    let femalePerformersStr = performers
        .filter((p) => p.gender === 'FEMALE')
        .map((p) => p.name)
        .join(" ");
    let tagsStr = tags.map((t) => t.name).join(" ");

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

    let overflowCharCount = fullReplaceResult.length - MAX_FILENAME_LENGTH;

    if (overflowCharCount <= 0) {
        return fullReplaceResult;
    }

    if (hasTags) {
        const keptTags = tagsStr.slice(0, -overflowCharCount);
        overflowCharCount -= tagsStr.length - keptTags.length;
        tagsStr = keptTags;
    }

    if (hasMalePerformers && overflowCharCount > 0) {
        const keptMalePerformers = malePerformersStr.slice(
            0,
            -overflowCharCount
        );
        overflowCharCount -= malePerformersStr.length - keptMalePerformers.length;
        malePerformersStr = keptMalePerformers;
    }

    if (hasFemalePerformers && overflowCharCount > 0) {
        const keptFemalePerformers = femalePerformersStr.slice(
            0,
            -overflowCharCount
        );
        overflowCharCount -= femalePerformersStr.length - keptFemalePerformers.length;
        femalePerformersStr = keptFemalePerformers;
    }

    if (hasTitle && overflowCharCount > 0) {
        const keptTitle = titleStr.slice(0, -overflowCharCount);
        overflowCharCount -= titleStr.length - keptTitle.length;
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

export function getResolution(file: { height?: number; width?: number }): string {
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
```

**Step 2: Verify build**

Run: `npm run build`
Expected: PASS

---

### Task 3: Create folders.ts

**Files:**
- Create: `src/controllers/organize/folders.ts`

**Step 1: Create the folders module**

Extract `generatePerformerFolders` (lines 334-357), `generateStudioFolders` (lines 359-386), and `filterScenesByPerformerSelections` (lines 308-332):

```typescript
import type { Scene, Studio } from "stashapp-api";
import type { UserOrganizationDetails } from "./types.js";

export const filterScenesByPerformerSelections = (
    scenes: Scene[],
    maleFilter: boolean,
    femaleFilter: boolean
): Scene[] => {
    if (!maleFilter && !femaleFilter) return scenes;

    return scenes.filter((scene) => {
        const hasMalePerformer = scene.performers.some(
            (p) => p.gender === 'MALE'
        );
        const hasFemalePerformer = scene.performers.some(
            (p) => p.gender === 'FEMALE'
        );

        if (maleFilter && femaleFilter)
            return hasMalePerformer && hasFemalePerformer;

        if (maleFilter) return hasMalePerformer;

        if (femaleFilter) return hasFemalePerformer;

        return false;
    });
};

export const generatePerformerFolders = (
    scene: Scene,
    organizationDetails: UserOrganizationDetails
) => {
    const matchingPerformers = scene.performers.filter(
        (p) => p.gender === organizationDetails.performerGender
    );

    const favoritedPerformers = matchingPerformers.filter(
        (p) => p.favorite === true
    );
    const filteredPerformers =
        favoritedPerformers.length > 0
            ? favoritedPerformers
            : matchingPerformers;

    const sortedPerformers = [...filteredPerformers].sort(
        (a, b) => (b.o_counter ?? 0) - (a.o_counter ?? 0)
    );
    const topPerformer = sortedPerformers[0];
    return [topPerformer.name];
};

export const generateStudioFolders = (
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
```

**Step 2: Verify build**

Run: `npm run build`
Expected: PASS

---

### Task 4: Create fileOps.ts

**Files:**
- Create: `src/controllers/organize/fileOps.ts`

**Step 1: Create the file operations module**

Extract `hydrateMetadata` (lines 991-1023), `organizeScene` (lines 1026-1145), `organizeScenes` (lines 1148-1159), `sanitizeFilenamePart` (lines 1161-1163), and `toSystemPath` (lines 1166-1171):

```typescript
import fs from "fs";
import path from "path";
import chalk from "chalk";
import type { Scene, Studio } from "stashapp-api";
import { buildSceneNFO } from "../../utils/nfo.js";
import { buildFileName } from "./filename.js";
import { generatePerformerFolders, generateStudioFolders } from "./folders.js";
import {
    INVALID_FILENAME_CHARS,
    type OrganizerSceneMetadata,
    type OrganizerSceneResults,
    type SceneWithMetadata,
    type UserOrganizationDetails,
} from "./types.js";

export function sanitizeFilenamePart(part: string): string {
    return part.replace(INVALID_FILENAME_CHARS, "");
}

export function toSystemPath(linuxPath: string): string {
    if (process.platform === "win32") {
        return linuxPath.replace(/\//g, "\\");
    }
    return linuxPath;
}

export const hydrateMetadata = (
    scene: Scene,
    studios: Studio[],
    organizationDetails: UserOrganizationDetails
): OrganizerSceneMetadata => {
    const folders =
        organizationDetails.organizationType === "Performer"
            ? generatePerformerFolders(scene, organizationDetails)
            : generateStudioFolders(scene, studios, organizationDetails);

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

export function organizeScene(
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

        const files = fs.readdirSync(currentDir);
        const matchingFiles = files.filter(
            (f) => path.basename(f, path.extname(f)) === baseName
        );

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

export function organizeScenes(
    scenes: SceneWithMetadata[],
    isDryRun: boolean
): OrganizerSceneResults[] {
    const results: OrganizerSceneResults[] = [];
    for (const sceneObj of scenes) {
        const result = organizeScene(sceneObj, isDryRun);
        results.push(result);
    }
    return results;
}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: PASS

---

### Task 5: Create prompts.ts

**Files:**
- Create: `src/controllers/organize/prompts.ts`

**Step 1: Create the prompts module**

Extract `getUserOrganizationDetails` (lines 402-989) — the entire interactive wizard. Copy it verbatim from the original file, updating imports.

The function imports:
- `fs` (for path validation)
- `backCommand` from `../../commands/back.js`
- `buildMenu` from `../../commands/menus/buildMenu.js`
- `getManageFilesMenuItems` from `../../commands/menus/menuItems.js`
- `checkboxMenu`, `input`, `print`, `selectMenu`, `yesOrNo` from `../../utils/terminal.js`
- `SceneFilterSelectionOption`, `UserOrganizationDetails` from `./types.js`

```typescript
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

export const getUserOrganizationDetails = async (): Promise<UserOrganizationDetails | null> => {
    // ... (copy lines 404-988 verbatim from original)
};
```

**Step 2: Verify build**

Run: `npm run build`
Expected: PASS

---

### Task 6: Rewrite organizeLibrary.ts as thin orchestrator + create index.ts

**Files:**
- Create: `src/controllers/organize/index.ts` (new orchestrator)
- Modify: `src/controllers/organizeLibrary.ts` (replace with re-export)

**Step 1: Create `src/controllers/organize/index.ts`**

This is the controller logic from lines 59-212, importing from sibling modules:

```typescript
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
```

**Step 2: Replace `src/controllers/organizeLibrary.ts` with re-export**

```typescript
export { organizeLibraryController } from "./organize/index.js";
```

This preserves the existing import path used by the menu system.

**Step 3: Verify build + tests**

Run: `npm run build && npx vitest run`
Expected: Clean build, 17 tests pass

**Step 4: Verify import consumers are unaffected**

Run: `grep -r "organizeLibrary" src/ --include="*.ts"` to confirm all imports still resolve.

**Step 5: Commit**

```bash
git add src/controllers/organize/ src/controllers/organizeLibrary.ts
git commit -m "refactor: split organizeLibrary into focused modules"
```

---

### Task 7: Delete old code from organizeLibrary.ts

This is handled by Task 6 Step 2 — the file is replaced with a single re-export line. No separate task needed.

### Verification Checklist

- [ ] `npm run build` — clean compile
- [ ] `npx vitest run` — 17 tests pass
- [ ] `grep -r "organizeLibrary" src/` — all imports resolve
- [ ] Original `organizeLibrary.ts` is a single re-export line
- [ ] No behavior changes — pure structural refactor
