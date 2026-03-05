export type TableColumn =
  | string
  | {
      name: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      render?: (value: any) => string | number;
    };

export const convertToTable = <T extends Record<string, unknown>>(
  arr: T[],
  columns: Array<TableColumn>
): Array<Record<string, unknown>> => {
  return arr.map((rowData) => {
    const row = columns.reduce((acc: Record<string, unknown>, column) => {
      let columnName = "";
      let columnValue: unknown = "";

      if (typeof column === "string") {
        columnName = column;
        columnValue = rowData[column];
      } else {
        columnName = column.name;
        columnValue = column.render
          ? column.render(rowData[column.name])
          : rowData[column.name];
      }

      acc[columnName] = columnValue;

      return acc;
    }, {});

    return row;
  });
};
