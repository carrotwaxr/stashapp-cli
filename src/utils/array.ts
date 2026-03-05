const defaultSortOptions = {
    direction: "ASC",
    secondarySortBy: "scene_count",
};

interface SortOptions {
    direction?: "ASC" | "DESC";
    secondarySortBy?: string;
}

export const sortArrayOfObjects = <T extends Record<string, unknown>>(
    arr: T[],
    sortBy: string,
    options: SortOptions = {}
): T[] => {
    const _options = {
        ...defaultSortOptions,
        ...options,
    };

    const { direction, secondarySortBy } = _options;

    return [...arr].sort((a, b) => {
        const aVal = Number(a[sortBy]);
        const bVal = Number(b[sortBy]);
        const aSecondary = Number(a[secondarySortBy]);
        const bSecondary = Number(b[secondarySortBy]);

        if (direction === "ASC") {
            return aVal - bVal || aSecondary - bSecondary;
        } else {
            return bVal - aVal || bSecondary - aSecondary;
        }
    });
};
