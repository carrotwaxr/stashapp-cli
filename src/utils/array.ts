const defaultSortOptions = {
    direction: "ASC",
    secondarySortBy: "scene_count",
};

interface SortOptions {
    direction?: "ASC" | "DESC";
    secondarySortBy?: string;
}

export const sortArrayOfObjects = (
    arr: Array<Record<string, any>>,
    sortBy: string,
    options: SortOptions = {}
) => {
    const _options = {
        ...defaultSortOptions,
        ...options,
    };

    const { direction, secondarySortBy } = _options;

    return arr.sort((a, b) => {
        if (direction === "ASC") {
            return (
                a[sortBy] - b[sortBy] || a[secondarySortBy] - b[secondarySortBy]
            );
        } else {
            return (
                b[sortBy] - a[sortBy] || b[secondarySortBy] - a[secondarySortBy]
            );
        }
    });
};
