import { transpile } from "./parser-transpiler";
import { readersDictionary } from "./readers";
export async function generateChirpstackV4(parsers) {
    const transpiled = await transpileByPorts(parsers);
    const ports = Object.keys(parsers).map(Number);
    const readers = new Set();
    for (const [_, parser] of transpiled) {
        for (const reader of parser.readers) {
            readers.add(reader);
        }
    }
    const lines = [];
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
export async function generateChirpstackV3(parsers) {
    const transpiled = await transpileByPorts(parsers);
    const ports = Object.keys(parsers).map(Number);
    const readers = new Set();
    for (const [_, parser] of transpiled) {
        for (const reader of parser.readers) {
            readers.add(reader);
        }
    }
    const lines = [];
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
function buildMainSwitch(ports) {
    const lines = [];
    lines.push("switch(fPort){");
    for (const fPort of ports) {
        lines.push(`case ${fPort}: return parsePort${fPort}(buffer);`);
    }
    lines.push("default: return null;");
    lines.push("}");
    return lines.join("\n");
}
function buildPortParser(fPort, parser) {
    const lines = [];
    lines.push(`function parsePort${fPort}(buffer){`);
    lines.push(parser.body);
    lines.push("}");
    return lines.join("\n");
}
function buildReaders(readers) {
    const lines = [];
    for (const reader of readers) {
        const readerCode = readersDictionary[reader];
        lines.push(readerCode);
    }
    return lines.join("\n");
}
async function transpileByPorts(parsers) {
    const parsersEntries = Object.entries(parsers);
    return Promise.all(parsersEntries.map(async ([port, parser]) => {
        const fPort = Number(port);
        const result = await transpile(parser);
        return [fPort, result];
    }));
}
