import { filesize as filesizeFormatter } from "filesize";
import humanizeDuration from "humanize-duration";

export const calculatePercent = (
    dividend: number | string,
    divisor: number | string
): number => {
    return (parseInt(dividend as string) / parseInt(divisor as string)) * 100;
};

export const convertMbToBytes = (megabytes: number): number => {
    return megabytes * 1024 * 1024;
};

export const formatBytes = (bytes: number, decimals: number = 2): string => {
    if (bytes == 0) {
        return "0 Bytes";
    }

    const k = 1024,
        dm = decimals,
        sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"],
        i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

export const formatDuration = (seconds: number): string => {
    return humanizeDuration(seconds * 1000);
};

export const formatPercent = (num: number): string => {
    return `${Math.ceil(num)}%`;
};

export const formatHeight = (heightCm: number): string => {
    const inches = Math.floor(0.3937 * heightCm);

    const feet = Math.floor(inches / 12);
    const inchesRemainder = inches % 12;

    return `${feet}'${inchesRemainder}"`;
};

export const formatInches = (inches: number): string => {
    return `${inches}"`;
};

export const formatWeight = (weight: number): string => {
    return `${weight}lbs`;
};

export const formatFilesize = (filesize: number): string => {
    return filesizeFormatter(filesize);
};
