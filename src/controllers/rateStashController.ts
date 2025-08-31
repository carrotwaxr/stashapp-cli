import chalk from "chalk";
import {
    CriterionModifier,
    GenderEnum,
    Performer,
    Scene,
    Studio,
    Tag,
} from "stashapp-api";
import { backCommand } from "../commands/back.js";
import { buildMenu } from "../commands/menus/buildMenu.js";
import { getAnalyzeMenuItems } from "../commands/menus/menuItems.js";
import { getStashInstance } from "../stash.js";
import {
    ArtifactRated,
    logArtifactRatings,
    PerformerRated,
    rateArtifacts,
    rateScenes,
    SceneRated,
    StudioRated,
    TagRated,
} from "../utils/rating.js";
import { loadingText, print } from "../utils/terminal.js";

export const rateStashController = async () => {
    print(
        "\nThis command will look up all Studios, Tags, Performers, and Scenes and give them a rating on a scale of 1 to 100.\n",
        "yellow"
    );

    const stash = getStashInstance();

    let finishLoading = await loadingText("Loading Scenes...");
    const {
        findScenes: { scenes },
    } = await stash.findScenes({
        filter: {
            per_page: -1,
        },
    });
    finishLoading();

    finishLoading = await loadingText("Loading Male Performers...");
    const {
        findPerformers: { performers: malePerformers },
    } = await stash.findPerformers({
        filter: {
            per_page: -1,
        },
        performer_filter: {
            gender: {
                modifier: CriterionModifier.Equals,
                value: GenderEnum.Male,
            },
            scene_count: {
                modifier: CriterionModifier.GreaterThan,
                value: 0,
            },
        },
    });
    finishLoading();

    finishLoading = await loadingText("Loading Female Performers...");
    const {
        findPerformers: { performers: femalePerformers },
    } = await stash.findPerformers({
        filter: {
            per_page: -1,
        },
        performer_filter: {
            gender: {
                modifier: CriterionModifier.Equals,
                value: GenderEnum.Female,
            },
            o_counter: {
                modifier: CriterionModifier.GreaterThan,
                value: 0,
            },
            scene_count: {
                modifier: CriterionModifier.GreaterThan,
                value: 0,
            },
        },
    });
    finishLoading();

    finishLoading = await loadingText("Loading Studios...");

    const {
        findStudios: { studios },
    } = await stash.findStudios({
        filter: { per_page: -1 },
        studio_filter: {
            scene_count: {
                modifier: CriterionModifier.GreaterThan,
                value: 0,
            },
        },
    });
    finishLoading();

    finishLoading = await loadingText("Loading Tags...");
    const {
        findTags: { tags },
    } = await stash.findTags({
        filter: {
            per_page: -1,
        },
        tag_filter: {
            scene_count: {
                modifier: CriterionModifier.GreaterThan,
                value: 0,
            },
        },
    });
    finishLoading();

    console.log();
    console.log(chalk.gray("----------------------------------------"));
    console.log(chalk.blue(`Studios found:    ${studios.length}`));
    console.log(chalk.magenta(`Tags found:      ${tags.length}`));
    console.log(
        chalk.yellow(`Male Performers found: ${malePerformers.length}`)
    );
    console.log(
        chalk.yellow(`Female Performers found: ${femalePerformers.length}`)
    );
    console.log(chalk.green(`Scenes found:    ${scenes.length}`));
    console.log(chalk.gray("----------------------------------------"));

    const ratedStudios: ArtifactRated[] = rateArtifacts(
        "studio",
        studios as Studio[],
        scenes.filter((scene) => scene.studio?.id) as Scene[]
    );

    logArtifactRatings(ratedStudios, "Studios");

    const ratedTags: ArtifactRated[] = rateArtifacts(
        "tag",
        tags as Tag[],
        scenes.filter((scene) => scene.tags?.length) as Scene[]
    );

    logArtifactRatings(ratedTags, "Tags");

    const ratedMalePerformers: ArtifactRated[] = rateArtifacts(
        "performer",
        malePerformers as Performer[],
        scenes.filter((scene) =>
            scene.performers?.some((p) => p.gender === GenderEnum.Male)
        ) as Scene[]
    );

    logArtifactRatings(ratedMalePerformers, "Male Performers");

    const ratedFemalePerformers: ArtifactRated[] = rateArtifacts(
        "performer",
        femalePerformers as Performer[],
        scenes.filter((scene) =>
            scene.performers?.some((p) => p.gender === GenderEnum.Female)
        ) as Scene[]
    );

    logArtifactRatings(ratedFemalePerformers, "Female Performers");

    const ratedScenes: SceneRated[] = rateScenes(
        scenes as Scene[],
        ratedStudios as StudioRated[],
        ratedTags as TagRated[],
        [...ratedMalePerformers, ...ratedFemalePerformers] as PerformerRated[]
    );

    console.log(`Using formula: ${ratedScenes[0].ratingFormulaExplained}`);
    console.log(chalk.blue("Your Top 50 Scenes:"));
    ratedScenes.slice(0, 50).forEach((scene) => {
        console.log(
            chalk.green(
                `- ${scene.studio?.name} - ${scene.title}: ${scene.rating100} = ${scene.ratingFormula}`
            )
        );
    });

    // Return to previous menu
    await backCommand(() => buildMenu(getAnalyzeMenuItems()));
};
