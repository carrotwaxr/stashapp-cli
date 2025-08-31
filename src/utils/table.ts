export type TableColumn<T = any> =
  | string
  | {
      name: string;
      render?: (value: any) => string | number;
    };

export const convertToTable = <T extends Record<string, any>>(
  arr: T[],
  columns: Array<TableColumn<T>>
): Array<Record<string, any>> => {
  return arr.map((rowData) => {
    const row = columns.reduce((acc: Record<string, any>, column) => {
      let columnName = "";
      let columnValue: any = "";

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
