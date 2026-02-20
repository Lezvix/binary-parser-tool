import swc from "@swc/core";
import { getDependentReaders } from "./readers";
const dataViewRegexp = /^var dataView = new DataView\(buffer\.buffer, buffer\.byteOffset, buffer.length\);$/;
const getValueRegexp = /^(?<var>.+)\s=\sdataView.get(?<kind>.+)\(offset,?\s?(?<le>.+)?\);$/;
const importCallRegexp = /^(?<var>\S+)\s=\simports\[(?<id>\d+)\]\.call\((?<args>.+)\);$/;
export async function transpile(parser) {
    const oldBody = parser.getCode();
    const imports = await transpileImports(parser);
    const readers = new Set();
    const lines = [];
    lines.push(imports);
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
            const variable = foundGetter.groups.var;
            const endianness = foundGetter.groups.le === "true" ? "LE" : "BE";
            const kind = foundGetter.groups.kind;
            const isOneByte = kind === "Int8" || kind === "Uint8";
            const readerType = isOneByte
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
const swcConfig = {
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
async function transpileImports(parser) {
    const oldImports = parser.getContext("imports")
        .imports;
    if (oldImports.length === 0) {
        return "";
    }
    const lines = [];
    lines.push("var imports = [");
    for (const imp of oldImports) {
        lines.push(`${imp},`);
    }
    lines.push("];");
    const output = await swc.transform(lines.join("\n"), swcConfig);
    return output.code;
}
