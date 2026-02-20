import { transpile, TranspileResult } from "./parser-transpiler";
import { LoraParsers, ReaderType } from "./types";

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

    for(const [fPort, parser] of transpiled){
        const portParser = buildPortParser(fPort, parser);
        lines.push(portParser);
    }

    const mainSwitch = buildMainSwitch(ports);

    lines.push("function decodeUplink (input) {");
    lines.push("var fPort = input.fPort;");
    lines.push("var buffer = input.bytes;");
    lines.push(mainSwitch)
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

    for(const [fPort, parser] of transpiled){
        const portParser = buildPortParser(fPort, parser);
        lines.push(portParser);
    }

    const mainSwitch = buildMainSwitch(ports);

    lines.push("function Decode (fPort, buffer, variables) {");
    lines.push(mainSwitch)
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

async function transpileByPorts(parsers: LoraParsers): Promise<PortResult[]>{
    const parsersEntries = Object.entries(parsers);
    return Promise.all(
        parsersEntries.map(async ([port, parser]) => {
            const fPort = Number(port);
            const result = await transpile(parser);

            return [fPort, result] as PortResult;
        }),
    );
}

const readersDictionary: Record<ReaderType, string> = {
    Uint8: `function readUint8(buf, offset){
    return buf[offset];
}`,
    Int8: `function readInt8(buf, offset){
    if(buf[offset] & 0x80){
        return (0xFF - buf[offset] + 1) * -1;
    }else{
        return buf[offset];
    }
}`,
    Uint16LE: `function readUint16LE(buf, offset){
    return buf[offset] | (buf[offset + 1] << 8);
}`,
    Int16LE: `function readInt16LE(buf, offset){
    var val = buf[offset] | (buf[offset + 1] << 8);
    if(val & 0x8000){
        return val | 0xFFFF0000;
    }else{
        return val;
    }
}`,
    Uint16BE: `function readUint16BE(buf, offset){
    return (buf[offset] << 8) | buf[offset + 1];
}`,
    Int16BE: `function readInt16BE(buf, offset){
    var val = (buf[offset] << 8) | buf[offset + 1];
    if(val & 0x8000){
        return val | 0xFFFF0000;
    }else{
        return val;
    }
}`,
    Uint32LE: `function readUint32LE(buf, offset){
    return (buf[offset] | (buf[offset + 1] << 8) | (buf[offset + 2] << 16) | (buf[offset + 3] << 24)) >>> 0;
}`,
    Int32LE: `function readInt32LE(buf, offset){
    return buf[offset] | (buf[offset + 1] << 8) | (buf[offset + 2] << 16) | (buf[offset + 3] << 24);
}`,
    Uint32BE: `function readUint32BE(buf, offset){
    return ((buf[offset] << 24) | (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3]) >>> 0;
}`,
    Int32BE: `function readInt32BE(buf, offset){
    return (buf[offset] << 24) | (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3];
}`,
    BigUint64LE: `function readBigUint64LE(buf, offset){
    var lo = readUint32LE(buf, offset);
    var hi = readUint32LE(buf, offset + 4);
    return hi * 0x100000000 + lo;
}`,
    BigInt64LE: `function readBigInt64LE(buf, offset){
    var lo = readUint32LE(buf, offset);
    var hi = readInt32LE(buf, offset + 4);
    return hi * 0x100000000 + lo;
}`,
    BigUint64BE: `function readBigUint64BE(buf, offset){
    var hi = readUint32BE(buf, offset);
    var lo = readUint32BE(buf, offset + 4);
    return hi * 0x100000000 + lo;
}`,
    BigInt64BE: `function readBigInt64BE(buf, offset){
    var hi = readInt32BE(buf, offset);
    var lo = readUint32BE(buf, offset + 4);
    return hi * 0x100000000 + lo;
}`,
    Float16LE: `function readFloat16LE(buf, offset){
    var byte0 = buf[offset];
    var byte1 = buf[offset + 1];
    var sign = (byte1 & 0x80) >> 7;
    var exponent = ((byte1 & 0x7C) >> 2);
    var mantissa = ((byte1 & 0x03) << 8) | byte0;
    
    if(exponent === 0){
        if(mantissa === 0){
            return sign ? -0 : 0;
        }
        return (sign ? -1 : 1) * mantissa * 0.00000005960464477539063;
    }
    if(exponent === 31){
        if(mantissa === 0){
            return sign ? -Infinity : Infinity;
        }
        return NaN;
    }
    return (sign ? -1 : 1) * (1 + mantissa / 1024) * Math.pow(2, exponent - 15);
}`,
    Float16BE: `function readFloat16BE(buf, offset){
    var byte0 = buf[offset];
    var byte1 = buf[offset + 1];
    var sign = (byte0 & 0x80) >> 7;
    var exponent = ((byte0 & 0x7C) >> 2);
    var mantissa = ((byte0 & 0x03) << 8) | byte1;
    
    if(exponent === 0){
        if(mantissa === 0){
            return sign ? -0 : 0;
        }
        return (sign ? -1 : 1) * mantissa * 0.00000005960464477539063;
    }
    if(exponent === 31){
        if(mantissa === 0){
            return sign ? -Infinity : Infinity;
        }
        return NaN;
    }
    return (sign ? -1 : 1) * (1 + mantissa / 1024) * Math.pow(2, exponent - 15);
}`,
    Float32LE: `function readFloat32LE(buf, offset){
    var byte0 = buf[offset];
    var byte1 = buf[offset + 1];
    var byte2 = buf[offset + 2];
    var byte3 = buf[offset + 3];
    var sign = (byte3 & 0x80) >> 7;
    var exponent = ((byte3 & 0x7F) << 1) | ((byte2 & 0x80) >> 7);
    var mantissa = ((byte2 & 0x7F) << 16) | (byte1 << 8) | byte0;
    
    if(exponent === 0){
        if(mantissa === 0){
            return sign ? -0 : 0;
        }
        return (sign ? -1 : 1) * mantissa * 1.401298464324817e-45;
    }
    if(exponent === 255){
        if(mantissa === 0){
            return sign ? -Infinity : Infinity;
        }
        return NaN;
    }
    return (sign ? -1 : 1) * (1 + mantissa / 8388608) * Math.pow(2, exponent - 127);
}`,
    Float32BE: `function readFloat32BE(buf, offset){
    var byte0 = buf[offset];
    var byte1 = buf[offset + 1];
    var byte2 = buf[offset + 2];
    var byte3 = buf[offset + 3];
    var sign = (byte0 & 0x80) >> 7;
    var exponent = ((byte0 & 0x7F) << 1) | ((byte1 & 0x80) >> 7);
    var mantissa = ((byte1 & 0x7F) << 16) | (byte2 << 8) | byte3;
    
    if(exponent === 0){
        if(mantissa === 0){
            return sign ? -0 : 0;
        }
        return (sign ? -1 : 1) * mantissa * 1.401298464324817e-45;
    }
    if(exponent === 255){
        if(mantissa === 0){
            return sign ? -Infinity : Infinity;
        }
        return NaN;
    }
    return (sign ? -1 : 1) * (1 + mantissa / 8388608) * Math.pow(2, exponent - 127);
}`,
    Float64LE: `function readFloat64LE(buf, offset){
    var byte0 = buf[offset];
    var byte1 = buf[offset + 1];
    var byte2 = buf[offset + 2];
    var byte3 = buf[offset + 3];
    var byte4 = buf[offset + 4];
    var byte5 = buf[offset + 5];
    var byte6 = buf[offset + 6];
    var byte7 = buf[offset + 7];
    var sign = (byte7 & 0x80) >> 7;
    var exponent = ((byte7 & 0x7F) << 4) | ((byte6 & 0xF0) >> 4);
    var mantissaHi = ((byte6 & 0x0F) << 16) | (byte5 << 8) | byte4;
    var mantissaLo = (byte3 << 16) | (byte2 << 8) | byte1 | (byte0 / 256);
    
    if(exponent === 0){
        if(mantissaHi === 0 && mantissaLo === 0){
            return sign ? -0 : 0;
        }
        return (sign ? -1 : 1) * (mantissaHi * 4.450147717014403e-308 + mantissaLo * 5e-324);
    }
    if(exponent === 2047){
        if(mantissaHi === 0 && mantissaLo === 0){
            return sign ? -Infinity : Infinity;
        }
        return NaN;
    }
    return (sign ? -1 : 1) * (1 + mantissaHi / 1048576 + mantissaLo / 4503599627370496) * Math.pow(2, exponent - 1023);
}`,
    Float64BE: `function readFloat64BE(buf, offset){
    var byte0 = buf[offset];
    var byte1 = buf[offset + 1];
    var byte2 = buf[offset + 2];
    var byte3 = buf[offset + 3];
    var byte4 = buf[offset + 4];
    var byte5 = buf[offset + 5];
    var byte6 = buf[offset + 6];
    var byte7 = buf[offset + 7];
    var sign = (byte0 & 0x80) >> 7;
    var exponent = ((byte0 & 0x7F) << 4) | ((byte1 & 0xF0) >> 4);
    var mantissaHi = ((byte1 & 0x0F) << 16) | (byte2 << 8) | byte3;
    var mantissaLo = (byte4 << 16) | (byte5 << 8) | byte6 | (byte7 / 256);
    
    if(exponent === 0){
        if(mantissaHi === 0 && mantissaLo === 0){
            return sign ? -0 : 0;
        }
        return (sign ? -1 : 1) * (mantissaHi * 4.450147717014403e-308 + mantissaLo * 5e-324);
    }
    if(exponent === 2047){
        if(mantissaHi === 0 && mantissaLo === 0){
            return sign ? -Infinity : Infinity;
        }
        return NaN;
    }
    return (sign ? -1 : 1) * (1 + mantissaHi / 1048576 + mantissaLo / 4503599627370496) * Math.pow(2, exponent - 1023);
}`,
};
