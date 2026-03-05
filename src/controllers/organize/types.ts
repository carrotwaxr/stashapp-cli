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
