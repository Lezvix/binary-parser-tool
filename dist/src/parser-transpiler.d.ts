import type { Parser } from "binary-parser";
import { type ReaderType } from "./readers";
export interface TranspileResult {
    body: string;
    readers: Set<ReaderType>;
}
interface TranspileContext {
    readers: Set<ReaderType>;
    subarrays: number;
    lines: string[];
}
export declare function transpile(parser: Parser): Promise<TranspileResult>;
export declare function transpileGetter(ctx: TranspileContext, match: RegExpMatchArray): void;
export declare function transpileSubarray(ctx: TranspileContext, match: RegExpMatchArray): void;
export {};
