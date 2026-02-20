import type { Parser } from "binary-parser";
import { ReaderType } from "./types";
export interface TranspileResult {
    body: string;
    readers: Set<ReaderType>;
}
export declare function transpile(parser: Parser): Promise<TranspileResult>;
