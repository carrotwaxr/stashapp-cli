import chalk from "chalk";

export const error = (...params: any[]) => {
    console.log(chalk.bgRed.white(...params));
};

export const info = (...params: any[]) => {
    console.log(chalk.blue(...params));
};

export const success = (...params: any[]) => {
    console.log(chalk.green(...params));
};

export const table = (...params: any[]) => {
    console.table(...params);
};

export const warn = (...params: any[]) => {
    console.log(chalk.yellow(...params));
};
