import { Performer } from "stashapp-api";
import { sortArrayOfObjects } from "../../utils/array.js";
import type { PerformerWithMetadata } from "../../utils/performers.js";
import { logPerformer } from "../../utils/performers.js";
import { print } from "../../utils/terminal.js";

export async function favoritePerformersController(
    performers: Performer[],
    maxPrintCount: number = 10
) {
    const sortedByOCount = sortArrayOfObjects(performers, "o_counter", {
        direction: "DESC",
    });

    const top10 = sortedByOCount.slice(0, maxPrintCount);

    print("Your Top ");
    print(maxPrintCount.toString(), "green");
    print(" Performers are...\n");

    for (const performer of top10) {
        await logPerformer(performer as PerformerWithMetadata);
    }
}
