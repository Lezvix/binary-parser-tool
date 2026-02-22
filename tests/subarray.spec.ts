import { describe, expect, test } from "vitest";
import { generateChirpstackV3, generateChirpstackV4 } from "../src/parser-generator";
import { Parser } from "binary-parser";
import vm from "vm";

const rawDataParser =  new Parser().buffer("raw", { readUntil: "eof" });

type DecoderChirp4 = (input: { fPort: number; bytes: number[] }) => any;

type DecoderChirp3 = (
    fPort: number,
    buffer: number[],
    variables: Record<string, any>,
) => any;

// AB0BA xD
const bytes = [0xA, 0xB, 0x0, 0xB, 0xA];

describe("Parser with subarray", async () => {
    test("for ChirpstackV4", async () => {
        const source = await generateChirpstackV4({ 0: rawDataParser });

        const sandbox = {} as { decodeUplink: DecoderChirp4 };
        const ctx = vm.createContext(sandbox);
        vm.runInContext(source, ctx);

        const actual = sandbox.decodeUplink({ fPort: 0, bytes: bytes });

        expect(actual).toEqual({ raw: bytes });
    });

    test("for ChirpstackV3", async () => {
        const source = await generateChirpstackV3({ 0: rawDataParser });

        const sandbox = {} as { Decode: DecoderChirp3 };
        const ctx = vm.createContext(sandbox);
        vm.runInContext(source, ctx);

        const actual = sandbox.Decode(0, bytes, {});

        expect(actual).toEqual({ raw: bytes });
    });
})