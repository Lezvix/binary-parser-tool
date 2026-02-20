import type { Parser } from "binary-parser";
import swc from "@swc/core";
import { Kind, ReaderType } from "./types";

const dataViewRegexp =
    /^var dataView = new DataView\(buffer\.buffer, buffer\.byteOffset, buffer.length\);$/;
const getValueRegexp =
    /^(?<var>.+)\s=\sdataView.get(?<kind>.+)\(offset,?\s?(?<le>.+)?\);$/;
const importCallRegexp =
    /^(?<var>\S+)\s=\simports\[(?<id>\d+)\]\.call\((?<args>.+)\);$/;

export interface TranspileResult {
    body: string;
    readers: Set<ReaderType>;
}

export async function transpile(parser: Parser): Promise<TranspileResult> {
    const oldBody = parser.getCode();
    const imports = await transpileImports(parser);
    const readers = new Set<ReaderType>();

    const lines: string[] = [];

    lines.push(imports);

    for (const line of oldBody.split("\n")) {
        if (dataViewRegexp.test(line)) {
            continue;
        }

        const foundGetter = line.match(getValueRegexp);
        if (foundGetter && foundGetter.groups) {
            const variable = foundGetter.groups.var;
            const endianness = foundGetter.groups.le === "true" ? "LE" : "BE";
            const kind = foundGetter.groups.kind as Kind;
            const isOneByte = kind === "Int8" || kind === "Uint8";
            const readerType: ReaderType = isOneByte
                ? kind
                : `${kind}${endianness}`;
            const requiredReaders = getDependentReaders(readerType);
            for (const reader of requiredReaders) {
                readers.add(reader);
            }

            const newLine = `${variable} = read${readerType}(buffer, offset);`;
            lines.push(newLine);
            continue;
        }

        lines.push(line);
    }

    return {
        body: lines.join("\n"),
        readers: readers,
    };
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

async function transpileImports(parser: Parser): Promise<string> {
    const oldImports = (parser as any).getContext("imports")
        .imports as Function[];
    const lines: string[] = [];
    lines.push("var imports = [");
    for (const imp of oldImports) {
        lines.push(`${imp},`);
    }
    lines.push("];");

    const output = await swc.transform(lines.join("\n"), swcConfig);

    return output.code;
}

function getDependentReaders(reader: ReaderType): ReaderType[] {
    switch (reader) {
        case "BigUint64LE":
            return ["BigUint64LE", "Uint32LE"];
        case "BigInt64LE":
            return ["BigInt64LE", "Uint32LE", "Int32LE"];
        case "BigUint64BE":
            return ["BigUint64BE", "Uint32BE"];
        case "BigInt64BE":
            return ["BigInt64BE", "Uint32BE", "Int32BE"];
        default:
            return [reader];
    }
}
