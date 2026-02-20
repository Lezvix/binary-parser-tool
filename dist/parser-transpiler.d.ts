import type { Parser } from "binary-parser";
import { type ReaderType } from "./readers";
export interface TranspileResult {
    body: string;
    readers: Set<ReaderType>;
}
export declare function transpile(parser: Parser): Promise<TranspileResult>;
