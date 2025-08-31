import { XMLBuilder } from "fast-xml-parser";
import { Scene } from "stashapp-api";

export const buildSceneNFO = (scene: Scene) => {
    const builder = new XMLBuilder({
        cdataPropName: "#CDATA",
        format: true,
        ignoreAttributes: false,
        textNodeName: "#TEXT",
    });

    const title = scene.title ?? "";

    const rating = scene.rating100 ? Math.round(scene.rating100 / 10) : "";
    const rating100 = scene.rating100 ?? "";

    const plot = scene.details ?? "";

    const releaseDate = scene.date ?? "";
    const releaseYear = scene.date ? scene.date.split("-")[0] : "";

    const studio = scene.studio?.name ?? "UNKNOWN";

    const performers = scene.performers.map((performer, index) => {
        return {
            name: performer.name,
            role: performer.name,
            order: index,
        };
    });

    const tags = scene.tags.map((tag) => {
        return tag.name;
    });

    const sceneNFO = {
        "?xml": {
            "@_version": "1.0",
            "@_encoding": "UTF-8",
            "@_standalone": "yes",
        },
        movie: {
            name: title,
            title,
            originaltitle: title,
            sorttitle: title,
            criticrating: rating100,
            rating,
            userrating: rating,
            plot: {
                "#CDATA": plot,
            },
            premiered: releaseDate,
            releasedate: releaseDate,
            year: releaseYear,
            studio,
            actor: performers,
            genre: "Adult",
            tag: tags,
            uniqueid: { "@_type": "stash", "#TEXT": scene.id },
        },
    };

    return builder.build(sceneNFO);
};
