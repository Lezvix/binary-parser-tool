import { Parser } from "binary-parser";
import { generateChirpstackV3 } from "../src/parser-generator";

export const standardSubpacket = new Parser()
    .endianness("little")
    .uint8("reason")
    .uint32("timestamp")
    .uint8("battery")
    .int8("temperature")
    .uint32("pulse1")
    .uint32("pulse2")
    .uint16("adc1")
    .uint16("adc2");

export const timestampSubpacket = new Parser()
    .endianness("little")
    .uint32("timestamp");

export const oneWireSensor = new Parser()
    .endianness("little")
    .uint16("raw");

export const oneWireSubpacket = new Parser()
    .uint8("dataLength")
    .array("sensors", {
        type: oneWireSensor,
        length: function () {
            return (this as any).dataLength / 2;
        },
    });

export const modbusSubpacket = new Parser()
    .uint8("dataLength")
    .uint8("head")
    .buffer("data", {
        length: function () {
            return (this as any).dataLength - 1;
        },
    });

export const subpacket = new Parser()
    .uint8("subpacketType")
    .choice("payload", {
        tag: "subpacketType",
        choices: {
            0x0a: standardSubpacket,
            0x14: timestampSubpacket,
            0x1e: oneWireSubpacket,
            0x28: modbusSubpacket,
        },
        defaultChoice: new Parser().buffer("raw", { readUntil: "eof" }),
    });

export const port2Parser = new Parser().array("subpackets", {
    type: subpacket,
    readUntil: "eof",
});

export const settingsEntry = new Parser()
    .endianness("little")
    .uint16("parameterId")
    .uint8("dataLength")
    .choice({
        tag: "parameterId",
        choices: {
            1: new Parser().uint8("confirmRequest"),
            12: new Parser().uint8("input1Mode"),
            13: new Parser().uint8("input2Mode"),
            15: new Parser().uint8("retransmitCount"),
            16: new Parser().uint8("transmitPeriod"),
            38: new Parser().uint8("securityInput1AlarmType"),
            39: new Parser().uint8("securityInput2AlarmType"),
            49: new Parser().uint8("collectPeriod"),
            55: new Parser().int16le("timezone"),
        },
        defaultChoice: new Parser().buffer("raw", { length: "dataLength" }),
    });

export const port3Parser = new Parser()
    .endianness("little")
    .uint8("packetType")
    .array("settings", { type: settingsEntry, readUntil: "eof" });

const result = await generateChirpstackV3({ 3: port3Parser, 2: port2Parser });
console.log(result);