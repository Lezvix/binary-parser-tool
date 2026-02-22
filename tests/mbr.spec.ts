import { Parser } from "binary-parser";
import { describe, expect, test } from "vitest";
import {
    generateChirpstackV3,
    generateChirpstackV4,
} from "../src/parser-generator";
import { readFile } from "fs/promises";
import { join } from "path";
import vm from "vm";

const chs = new Parser()
    .uint8("head")
    .bit2("cylinderHigh")
    .bit6("sector")
    .uint8("cylinder");

const partitionTable = new Parser()
    .uint8("bootFlag")
    .nest("startCHS", {
        type: chs,
        formatter: function (val) {
            delete val.cylinderHigh;
            return val;
        },
    })
    .uint8("type")
    .nest("endCHS", {
        type: chs,
        formatter: function (val) {
            val.cylinder |= val.cylinderHigh << 8;
            delete val.cylinderHigh;
            return val;
        },
    })
    .uint32le("startLBA")
    .uint32le("endLBA");

const mbrParser = new Parser()
    .seek(446)
    .array("partitionTables", {
        type: partitionTable,
        length: 4,
    })
    .int16be("signature", {
        assert: 0x55aa,
    });

const expected = {
    partitionTables: [
        {
            bootFlag: 0,
            startCHS: { head: 130, sector: 3, cylinder: 0 },
            type: 12,
            endCHS: { head: 204, sector: 60, cylinder: 5 },
            startLBA: 8192,
            endLBA: 85045,
        },
        {
            bootFlag: 0,
            startCHS: { head: 220, sector: 24, cylinder: 5 },
            type: 131,
            endCHS: { head: 229, sector: 4, cylinder: 225 },
            startLBA: 94208,
            endLBA: 3534848,
        },
        {
            bootFlag: 0,
            startCHS: { head: 0, sector: 0, cylinder: 0 },
            type: 0,
            endCHS: { head: 0, sector: 0, cylinder: 0 },
            startLBA: 0,
            endLBA: 0,
        },
        {
            bootFlag: 0,
            startCHS: { head: 0, sector: 0, cylinder: 0 },
            type: 0,
            endCHS: { head: 0, sector: 0, cylinder: 0 },
            startLBA: 0,
            endLBA: 0,
        },
    ],
    signature: 21930,
};

const mbrBuffer = await readFile(join(__dirname, "mbr-example.img"));
const bytes = Array.from(mbrBuffer);

type DecoderChirp4 = (input: { fPort: number; bytes: number[] }) => any;

type DecoderChirp3 = (
    fPort: number,
    buffer: number[],
    variables: Record<string, any>,
) => any;

describe("Composite MBR parser", () => {
    test("for ChirpstackV4", async () => {
        const source = await generateChirpstackV4({ 2: mbrParser });

        const sandbox = {} as { decodeUplink: DecoderChirp4 };
        const ctx = vm.createContext(sandbox);
        vm.runInContext(source, ctx);

        const actual = sandbox.decodeUplink({ fPort: 2, bytes: bytes });

        expect(actual).toEqual(expected);
    });

    test("for ChirpstackV3", async () => {
        const source = await generateChirpstackV3({ 2: mbrParser });

        const sandbox = {} as { Decode: DecoderChirp3 };
        const ctx = vm.createContext(sandbox);
        vm.runInContext(source, ctx);

        const actual = sandbox.Decode(2, bytes, {});

        expect(actual).toEqual(expected);
    });
})
