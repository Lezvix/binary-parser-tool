import { Parser } from "binary-parser";
export type LoraParsers = Record<number, Parser>;
export type Kind = "BigInt64" | "BigUint64" | "Float16" | "Float32" | "Float64" | "Int8" | "Int16" | "Int32" | "Uint8" | "Uint16" | "Uint32";
export type ReaderType = `${Exclude<Kind, "Int8" | "Uint8">}${"LE" | "BE"}` | "Int8" | "Uint8";
