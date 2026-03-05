const defaultSortOptions = {
    direction: "ASC",
    secondarySortBy: "scene_count",
};

interface SortOptions {
    direction?: "ASC" | "DESC";
    secondarySortBy?: string;
}

export const sortArrayOfObjects = <T>(
    arr: T[],
    sortBy: keyof T & string,
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
        const aSecondary = Number((a as Record<string, unknown>)[secondarySortBy]);
        const bSecondary = Number((b as Record<string, unknown>)[secondarySortBy]);

        if (direction === "ASC") {
            return aVal - bVal || aSecondary - bSecondary;
        } else {
            return bVal - aVal || bSecondary - aSecondary;
        }
    });
};
