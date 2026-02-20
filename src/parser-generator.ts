import { transpile, type TranspileResult } from "./parser-transpiler";
import { readersDictionary, type ReaderType } from "./readers";
import type { LoraParsers } from "./types";

type PortResult = [number, TranspileResult];

export async function generateChirpstackV4(
    parsers: LoraParsers,
): Promise<string> {
    const transpiled = await transpileByPorts(parsers);
    const ports = Object.keys(parsers).map(Number);

    const readers = new Set<ReaderType>();
    for (const [_, parser] of transpiled) {
        for (const reader of parser.readers) {
            readers.add(reader);
        }
    }

    const lines: string[] = [];

    const readersCode = buildReaders(readers);
    lines.push(readersCode);

    for (const [fPort, parser] of transpiled) {
        const portParser = buildPortParser(fPort, parser);
        lines.push(portParser);
    }

    const mainSwitch = buildMainSwitch(ports);

    lines.push("function decodeUplink (input) {");
    lines.push("var fPort = input.fPort;");
    lines.push("var buffer = input.bytes;");
    lines.push(mainSwitch);
    lines.push("}");

    return lines.join("\n");
}

export async function generateChirpstackV3(
    parsers: LoraParsers,
): Promise<string> {
    const transpiled = await transpileByPorts(parsers);
    const ports = Object.keys(parsers).map(Number);

    const readers = new Set<ReaderType>();
    for (const [_, parser] of transpiled) {
        for (const reader of parser.readers) {
            readers.add(reader);
        }
    }

    const lines: string[] = [];

    const readersCode = buildReaders(readers);
    lines.push(readersCode);

    for (const [fPort, parser] of transpiled) {
        const portParser = buildPortParser(fPort, parser);
        lines.push(portParser);
    }

    const mainSwitch = buildMainSwitch(ports);

    lines.push("function Decode (fPort, buffer, variables) {");
    lines.push(mainSwitch);
    lines.push("}");

    return lines.join("\n");
}

function buildMainSwitch(ports: number[]) {
    const lines: string[] = [];
    lines.push("switch(fPort){");
    for (const fPort of ports) {
        lines.push(`case ${fPort}: return parsePort${fPort}(buffer);`);
    }
    lines.push("default: return null;");
    lines.push("}");
    return lines.join("\n");
}

function buildPortParser(fPort: number, parser: TranspileResult): string {
    const lines: string[] = [];
    lines.push(`function parsePort${fPort}(buffer){`);
    lines.push(parser.body);
    lines.push("}");
    return lines.join("\n");
}

function buildReaders(readers: Set<ReaderType>) {
    const lines: string[] = [];
    for (const reader of readers) {
        const readerCode = readersDictionary[reader];
        lines.push(readerCode);
    }
    return lines.join("\n");
}

async function transpileByPorts(parsers: LoraParsers): Promise<PortResult[]> {
    const parsersEntries = Object.entries(parsers);
    return Promise.all(
        parsersEntries.map(async ([port, parser]) => {
            const fPort = Number(port);
            const result = await transpile(parser);

            return [fPort, result] as PortResult;
        }),
    );
}
