import type { Kind } from "./types";
export type ReaderType = `${Exclude<Kind, "Int8" | "Uint8">}${"LE" | "BE"}` | "Int8" | "Uint8";
export declare function getDependentReaders(reader: ReaderType): ReaderType[];
export declare const readersDictionary: Record<ReaderType, string>;
