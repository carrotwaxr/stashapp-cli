import chalk from "chalk";
import { Performer, Scene, Studio, Tag } from "stashapp-api";

type Artifact = Performer | Studio | Tag;

export type ArtifactType = "performer" | "studio" | "tag";

type Rated = {
    o_counter: number;
    rating100: number;
    ratingFormula: string;
    ratingFormulaExplained: string;
};
type ScoreFactor = {
    label: string;
    value: number;
};

export type ArtifactRated = Artifact & Rated;

export type PerformerRated = Performer & Rated;

export type SceneRated = Scene & Rated;

export type StudioRated = Studio & Rated;

export type TagRated = Tag & Rated;

export const logArtifactRatings = (
    artifacts: ArtifactRated[],
    displayName: string
) => {
    const [sample] = artifacts;

    console.log(`Using formula: ${sample.ratingFormulaExplained}`);
    console.log(chalk.blue(`Your Top 50 ${displayName}:`));

    artifacts.slice(0, 50).forEach((artifact) => {
        console.log(
            chalk.green(
                `- ${artifact.name}: ${artifact.rating100} = ${artifact.ratingFormula}`
            )
        );
    });
};

export const rateArtifacts = (
    artifactType: ArtifactType,
    artifacts: Artifact[],
    scenes: Scene[]
): ArtifactRated[] => {
    const totalLikes = scenes.reduce(
        (acc, scene) => acc + (scene?.o_counter ?? 0),
        0
    );

    const avgLikesPerArtifact = divide(totalLikes, artifacts.length);

    const avgScenesPerArtifact = divide(scenes.length, artifacts.length);

    console.log(
        "Rating",
        chalk.cyan(artifacts.length),
        `${artifactType}s using`,
        chalk.yellow(scenes.length),
        "scenes with an average of",
        chalk.green(avgLikesPerArtifact),
        `likes per ${artifactType} and an average of`,
        chalk.magenta(avgScenesPerArtifact),
        `scenes per ${artifactType}.`
    );

    return artifacts
        .map((artifact) => ({
            ...artifact,
            ...getArtifactRating(
                artifactType,
                artifact,
                scenes,
                avgLikesPerArtifact,
                avgScenesPerArtifact
            ),
        }))
        .sort((a, b) => {
            if (b.rating100 !== a.rating100) {
                return b.rating100 - a.rating100;
            }
            return (b.o_counter ?? 0) - (a.o_counter ?? 0);
        });
};

export const rateScenes = (
    scenes: Scene[],
    ratedStudios: StudioRated[],
    ratedTags: TagRated[],
    ratedPerformers: PerformerRated[]
): SceneRated[] => {
    const likedScenes = scenes.filter((scene) => scene?.o_counter ?? 0 > 0);
    const totalLikes = likedScenes.reduce(
        (acc, scene) => acc + (scene?.o_counter ?? 0),
        0
    );
    const avgLikesPerLikedScene = divide(totalLikes, likedScenes.length);

    const avgStudioScore = divide(
        ratedStudios.reduce((acc, studio) => acc + (studio.rating100 ?? 0), 0),
        ratedStudios.length
    );
    const avgTagScore = divide(
        ratedTags.reduce((acc, tag) => acc + (tag.rating100 ?? 0), 0),
        ratedTags.length
    );

    const avgPerformerScore = divide(
        ratedPerformers.reduce(
            (acc, performer) => acc + (performer.rating100 ?? 0),
            0
        ),
        ratedPerformers.length
    );

    console.log(
        "Rating",
        chalk.cyan(scenes.length),
        "Scenes with an average Studio score of",
        chalk.yellow(avgStudioScore),
        ", an average Tag Score of",
        chalk.green(avgTagScore),
        ", an average Performer Score of",
        chalk.blue(avgPerformerScore),
        ", and an average Likes Per Scene of",
        chalk.magenta(avgLikesPerLikedScene)
    );

    return scenes
        .map((scene) => ({
            ...scene,
            ...getSceneRating(
                scene,
                ratedStudios,
                ratedTags,
                ratedPerformers,
                avgLikesPerLikedScene,
                avgStudioScore,
                avgTagScore,
                avgPerformerScore
            ),
        }))
        .sort((a, b) => {
            if (b.rating100 !== a.rating100) {
                return b.rating100 - a.rating100;
            }
            return (b.o_counter ?? 0) - (a.o_counter ?? 0);
        });
};

const divide = (a: number, b: number) => {
    if (b === 0) return 0;
    return Number((a / b).toFixed(4));
};

const getArtifactRating = (
    artifactType: ArtifactType,
    artifact: Artifact,
    scenes: Scene[],
    avgLikesPerArtifact: number,
    avgScenesPerArtifact: number
): Rated => {
    const artifactScenes = scenes.filter((scene) => {
        if (artifactType === "performer") {
            return scene.performers?.some(
                (performer) => performer.id === artifact.id
            );
        }
        if (artifactType === "studio") {
            return scene.studio?.id === artifact.id;
        }
        if (artifactType === "tag") {
            return scene.tags?.some((tag) => tag.id === artifact.id);
        }
    });

    const likedScenes = artifactScenes.filter(
        (scene) => scene?.o_counter ?? 0 > 0
    );
    const totalLikes = likedScenes.reduce(
        (acc, scene) => acc + (scene?.o_counter ?? 0),
        0
    );

    const likedSceneRatio = divide(likedScenes.length, artifactScenes.length);
    const oCountMultiplier = divide(totalLikes, avgLikesPerArtifact * 3);
    let sceneCountPenalty = divide(
        artifactScenes.length,
        avgScenesPerArtifact * 2
    );
    if (sceneCountPenalty > 1) {
        sceneCountPenalty = 1;
    }
    const favoriteMultiplier = artifact.favorite ? 1.1 : 1;

    let rating100 = Math.floor(
        likedSceneRatio *
            oCountMultiplier *
            sceneCountPenalty *
            favoriteMultiplier *
            100
    );
    if (rating100 > 100) {
        rating100 = 100;
    }

    const ratingFormula = `${likedSceneRatio} * ${oCountMultiplier} * ${sceneCountPenalty} * ${favoriteMultiplier} * 100`;
    const ratingFormulaExplained =
        "likedSceneRatio * oCountMultiplier * sceneCountPenalty * favoriteMultiplier * 100";

    return {
        o_counter: totalLikes,
        rating100,
        ratingFormula,
        ratingFormulaExplained,
    };
};

const getAverageArtifactScoreForScene = (
    scene: Scene,
    ratedStudios: StudioRated[],
    ratedTags: TagRated[],
    ratedPerformers: PerformerRated[],
    avgStudioScore: number,
    avgTagScore: number,
    avgPerformerScore: number
): number => {
    const ratedStudio = scene.studio?.id
        ? ratedStudios.find((studio) => studio.id === scene.studio?.id)
        : null;
    const ratedSceneTags = ratedTags.filter((tag) =>
        scene.tags?.some((t) => t.id === tag.id)
    );
    const ratedScenePerformers = ratedPerformers.filter((performer) =>
        scene.performers?.some((p) => p.id === performer.id)
    );

    const studioScore = ratedStudio
        ? (ratedStudio?.rating100 ?? 0)
        : avgStudioScore;

    const tagScores = scene.tags?.length
        ? ratedSceneTags.map((tag) => tag.rating100 ?? 0)
        : [avgTagScore];

    const performerScores = scene.performers?.length
        ? ratedScenePerformers.map((performer) => performer.rating100 ?? 0)
        : [avgPerformerScore];

    const allScores = [studioScore, ...tagScores, ...performerScores];
    const averageScore = Math.floor(
        allScores.reduce((acc, score) => acc + score, 0) / allScores.length
    );
    return averageScore;
};

const getSceneRating = (
    scene: Scene,
    ratedStudios: StudioRated[],
    ratedTags: TagRated[],
    ratedPerformers: PerformerRated[],
    avgLikesPerLikedScene: number,
    avgStudioScore: number,
    avgTagScore: number,
    avgPerformerScore: number
): Rated => {
    const averageArtifactScore = getAverageArtifactScoreForScene(
        scene,
        ratedStudios,
        ratedTags,
        ratedPerformers,
        avgStudioScore,
        avgTagScore,
        avgPerformerScore
    );

    const oCounter = scene.o_counter ?? 0;

    if (!oCounter) {
        return {
            o_counter: 0,
            rating100: avgTagScore,
            ratingFormula: "avgTagScore",
            ratingFormulaExplained: "No O-Counter so using avgTagScore",
        };
    }

    const oCountMultiplier = Number(
        (oCounter / avgLikesPerLikedScene / 20 + 1).toFixed(4)
    );

    let rating100 = Math.floor(averageArtifactScore * oCountMultiplier);
    if (rating100 > 100) {
        rating100 = 100;
    }

    const ratingFormula = `${averageArtifactScore} * ${oCountMultiplier}`;

    const ratingFormulaExplained = "Average Artifact Score * oCountMultiplier";

    return {
        o_counter: oCounter,
        rating100,
        ratingFormula,
        ratingFormulaExplained,
    };
};
