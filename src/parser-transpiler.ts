import type { Parser } from "binary-parser";
import swc from "@swc/core";
import type { Kind } from "./types";
import { getDependentReaders, type ReaderType } from "./readers";

const dataViewRegexp =
    /^var dataView = new DataView\(buffer\.buffer, buffer\.byteOffset, buffer.length\);$/;
const getValueRegexp =
    /^(?<var>.+)\s=\sdataView.get(?<kind>.+)\(offset,?\s?(?<le>.+)?\);$/;
const importCallRegexp =
    /^(?<var>\S+)\s=\simports\[(?<id>\d+)\]\.call\((?<args>.+)\);$/;
const subarrayRegexp = /(?<var>[^=\n]+?)\s=\s(?<buffer>[\w$][\w$.]*?)\.subarray\((?<args>[^()]*(?:\([^()]*\))*[^()]*)\)/;

export interface TranspileResult {
    body: string;
    readers: Set<ReaderType>;
}

interface TranspileContext {
    readers: Set<ReaderType>;
    subarrays: number;
    lines: string[];
}

export async function transpile(parser: Parser): Promise<TranspileResult> {
    const oldBody = parser.getCode();

    const ctx: TranspileContext = {
        readers: new Set<ReaderType>(),
        subarrays: 0,
        lines: []
    }

    await transpileImports(ctx, parser);

    for (const rawLine of oldBody.split("\n")) {
        const line = rawLine.trim();
        if (line === "") {
            continue;
        }

        if (dataViewRegexp.test(line)) {
            continue;
        }

        const foundGetter = line.match(getValueRegexp);
        if (foundGetter && foundGetter.groups) {
            transpileGetter(ctx, foundGetter)
            continue;
        }

        const foundSubarray = line.match(subarrayRegexp);
        if (foundSubarray && foundSubarray.groups) {
            transpileSubarray(ctx, foundSubarray);
            continue;
        }

        ctx.lines.push(line);
    }

    return {
        body: ctx.lines.join("\n"),
        readers: ctx.readers,
    };
}

export function transpileGetter(ctx: TranspileContext, match: RegExpMatchArray) {
    const variable = match.groups!.var;
    const endianness = match.groups!.le === "true" ? "LE" : "BE";
    const kind = match.groups!.kind as Kind;
    const isOneByte = kind === "Int8" || kind === "Uint8";

    const readerType: ReaderType = isOneByte
        ? kind
        : `${kind}${endianness}`;

    const requiredReaders = getDependentReaders(readerType);
    for (const reader of requiredReaders) {
        ctx.readers.add(reader);
    }

    const line = `${variable} = read${readerType}(buffer, offset);`;
    ctx.lines.push(line);
}

function splitArgs(argsRaw: string) {
    const args = [];
    let depth = 0, current = '';
    for (const ch of argsRaw) {
        if ('(['.includes(ch)) depth++;
        else if (')]'.includes(ch)) depth--;
        else if (ch === ',' && depth === 0) {
            args.push(current.trim());
            current = '';
            continue;
        }
        current += ch;
    }
    if (current.trim()) args.push(current.trim());
    return args;
}

export function transpileSubarray(
    ctx: TranspileContext,
    match: RegExpMatchArray,
) {
    const variable = match.groups!.var;
    const buffer = match.groups!.buffer;
    const argsRaw = match.groups!.args;
    
    const args = splitArgs(argsRaw);
    const [
        begin = "0",
        end = `${buffer}.length`
    ] = args;

    const subarrayIdx = ctx.subarrays;
    ctx.subarrays++;

    const idxName = `$i${subarrayIdx}`;
    const lenName = `$len${subarrayIdx}`

    const lines = ctx.lines;
    lines.push(`${variable} = [];`);
    lines.push(`var ${lenName} = ${end};`);
    lines.push(`for(var ${idxName} = ${begin}; ${idxName} < ${lenName}; ${idxName}++){`)
    lines.push(`${variable}[${variable}.length] = ${buffer}[${idxName}];`)
    lines.push(`}`);
}

const swcConfig: swc.Options = {
    jsc: {
        target: "es3",
        parser: {
            syntax: "ecmascript",
        },
    },
    module: {
        type: "commonjs",
        strict: false,
        strictMode: false,
        noInterop: false,
    },
    minify: false,
    isModule: false,
};

async function transpileImports(ctx: TranspileContext, parser: Parser): Promise<void> {
    const oldImports = (parser as any).getContext("imports")
        .imports as Function[];

    if (oldImports.length === 0) return;

    const lines: string[] = ctx.lines;
    lines.push("var imports = [");
    for (const imp of oldImports) {
        lines.push(`${imp},`);
    }
    lines.push("];");

    const output = await swc.transform(lines.join("\n"), swcConfig);

    ctx.lines.push(output.code);
}
