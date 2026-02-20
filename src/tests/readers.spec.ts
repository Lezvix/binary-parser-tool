import { describe, expect, test } from "vitest";
import { getDependentReaders, readersDictionary, type ReaderType } from "../readers";

function createReader(readerType: ReaderType): (buf: number[], offset: number) => number {
    const deps = getDependentReaders(readerType);
    const code = deps.map((dep) => readersDictionary[dep]).join("\n");
    const fnName = `read${readerType}`;
    return new Function(
        "buf",
        "offset",
        `${code}\nreturn ${fnName}(buf, offset);`,
    ) as (buf: number[], offset: number) => number;
}

function dv(bytes: number[]): DataView {
    return new DataView(new Uint8Array(bytes).buffer);
}

describe("Uint8", () => {
    const read = createReader("Uint8");
    const buf = Buffer.from([0x00, 0x42, 0x7f, 0x80, 0xff]);

    test("reads 0x00", () => expect(read([0x00], 0)).toBe(buf.readUInt8(0)));
    test("reads 0x42", () => expect(read([0x42], 0)).toBe(66));
    test("reads 0x7F (max positive)", () => expect(read([0x7f], 0)).toBe(127));
    test("reads 0x80", () => expect(read([0x80], 0)).toBe(128));
    test("reads 0xFF (max)", () => expect(read([0xff], 0)).toBe(255));
    test("respects offset", () => expect(read([0x00, 0xab], 1)).toBe(Buffer.from([0x00, 0xab]).readUInt8(1)));
});

describe("Int8", () => {
    const read = createReader("Int8");

    test("reads 0", () => expect(read([0x00], 0)).toBe(Buffer.from([0x00]).readInt8(0)));
    test("reads 0x42 (positive)", () => expect(read([0x42], 0)).toBe(66));
    test("reads 0x7F (max positive)", () => expect(read([0x7f], 0)).toBe(127));
    test("reads 0x80 (min negative)", () => expect(read([0x80], 0)).toBe(-128));
    test("reads 0xFF (-1)", () => expect(read([0xff], 0)).toBe(-1));
    test("respects offset", () => expect(read([0x00, 0xff], 1)).toBe(Buffer.from([0x00, 0xff]).readInt8(1)));
});

describe("Uint16LE", () => {
    const read = createReader("Uint16LE");

    test("reads 0", () => expect(read([0x00, 0x00], 0)).toBe(0));
    test("reads little-endian order", () => expect(read([0x34, 0x12], 0)).toBe(0x1234));
    test("reads max (0xFFFF)", () => expect(read([0xff, 0xff], 0)).toBe(65535));
    test("matches Buffer.readUInt16LE", () => {
        const bytes = [0x78, 0x56];
        expect(read(bytes, 0)).toBe(Buffer.from(bytes).readUInt16LE(0));
    });
    test("respects offset", () => {
        const bytes = [0x00, 0x34, 0x12];
        expect(read(bytes, 1)).toBe(Buffer.from(bytes).readUInt16LE(1));
    });
});

describe("Int16LE", () => {
    const read = createReader("Int16LE");

    test("reads 0", () => expect(read([0x00, 0x00], 0)).toBe(0));
    test("reads max positive (0x7FFF)", () => expect(read([0xff, 0x7f], 0)).toBe(32767));
    test("reads min negative (0x8000)", () => expect(read([0x00, 0x80], 0)).toBe(-32768));
    test("reads -1 (0xFFFF)", () => expect(read([0xff, 0xff], 0)).toBe(-1));
    test("matches Buffer.readInt16LE", () => {
        const bytes = [0xcd, 0xab];
        expect(read(bytes, 0)).toBe(Buffer.from(bytes).readInt16LE(0));
    });
    test("respects offset", () => {
        const bytes = [0x00, 0x00, 0x80];
        expect(read(bytes, 1)).toBe(Buffer.from(bytes).readInt16LE(1));
    });
});

describe("Uint16BE", () => {
    const read = createReader("Uint16BE");

    test("reads 0", () => expect(read([0x00, 0x00], 0)).toBe(0));
    test("reads big-endian order", () => expect(read([0x12, 0x34], 0)).toBe(0x1234));
    test("reads max (0xFFFF)", () => expect(read([0xff, 0xff], 0)).toBe(65535));
    test("matches Buffer.readUInt16BE", () => {
        const bytes = [0x56, 0x78];
        expect(read(bytes, 0)).toBe(Buffer.from(bytes).readUInt16BE(0));
    });
    test("respects offset", () => {
        const bytes = [0x00, 0x12, 0x34];
        expect(read(bytes, 1)).toBe(Buffer.from(bytes).readUInt16BE(1));
    });
});

describe("Int16BE", () => {
    const read = createReader("Int16BE");

    test("reads 0", () => expect(read([0x00, 0x00], 0)).toBe(0));
    test("reads max positive (0x7FFF)", () => expect(read([0x7f, 0xff], 0)).toBe(32767));
    test("reads min negative (0x8000)", () => expect(read([0x80, 0x00], 0)).toBe(-32768));
    test("reads -1 (0xFFFF)", () => expect(read([0xff, 0xff], 0)).toBe(-1));
    test("matches Buffer.readInt16BE", () => {
        const bytes = [0xab, 0xcd];
        expect(read(bytes, 0)).toBe(Buffer.from(bytes).readInt16BE(0));
    });
    test("respects offset", () => {
        const bytes = [0x00, 0x80, 0x00];
        expect(read(bytes, 1)).toBe(Buffer.from(bytes).readInt16BE(1));
    });
});

describe("Uint32LE", () => {
    const read = createReader("Uint32LE");

    test("reads 0", () => expect(read([0x00, 0x00, 0x00, 0x00], 0)).toBe(0));
    test("reads little-endian order", () => expect(read([0x78, 0x56, 0x34, 0x12], 0)).toBe(0x12345678));
    test("reads max unsigned (0xFFFFFFFF)", () => expect(read([0xff, 0xff, 0xff, 0xff], 0)).toBe(4294967295));
    test("does not produce negative for high-bit set", () => expect(read([0x00, 0x00, 0x00, 0x80], 0)).toBe(2147483648));
    test("matches Buffer.readUInt32LE", () => {
        const bytes = [0xef, 0xcd, 0xab, 0x89];
        expect(read(bytes, 0)).toBe(Buffer.from(bytes).readUInt32LE(0));
    });
    test("respects offset", () => {
        const bytes = [0x00, 0x78, 0x56, 0x34, 0x12];
        expect(read(bytes, 1)).toBe(Buffer.from(bytes).readUInt32LE(1));
    });
});

describe("Int32LE", () => {
    const read = createReader("Int32LE");

    test("reads 0", () => expect(read([0x00, 0x00, 0x00, 0x00], 0)).toBe(0));
    test("reads max positive", () => expect(read([0xff, 0xff, 0xff, 0x7f], 0)).toBe(2147483647));
    test("reads min negative", () => expect(read([0x00, 0x00, 0x00, 0x80], 0)).toBe(-2147483648));
    test("reads -1", () => expect(read([0xff, 0xff, 0xff, 0xff], 0)).toBe(-1));
    test("matches Buffer.readInt32LE", () => {
        const bytes = [0xef, 0xcd, 0xab, 0x89];
        expect(read(bytes, 0)).toBe(Buffer.from(bytes).readInt32LE(0));
    });
    test("respects offset", () => {
        const bytes = [0x00, 0xff, 0xff, 0xff, 0xff];
        expect(read(bytes, 1)).toBe(Buffer.from(bytes).readInt32LE(1));
    });
});

describe("Uint32BE", () => {
    const read = createReader("Uint32BE");

    test("reads 0", () => expect(read([0x00, 0x00, 0x00, 0x00], 0)).toBe(0));
    test("reads big-endian order", () => expect(read([0x12, 0x34, 0x56, 0x78], 0)).toBe(0x12345678));
    test("reads max unsigned (0xFFFFFFFF)", () => expect(read([0xff, 0xff, 0xff, 0xff], 0)).toBe(4294967295));
    test("does not produce negative for high-bit set", () => expect(read([0x80, 0x00, 0x00, 0x00], 0)).toBe(2147483648));
    test("matches Buffer.readUInt32BE", () => {
        const bytes = [0x89, 0xab, 0xcd, 0xef];
        expect(read(bytes, 0)).toBe(Buffer.from(bytes).readUInt32BE(0));
    });
    test("respects offset", () => {
        const bytes = [0x00, 0x12, 0x34, 0x56, 0x78];
        expect(read(bytes, 1)).toBe(Buffer.from(bytes).readUInt32BE(1));
    });
});

describe("Int32BE", () => {
    const read = createReader("Int32BE");

    test("reads 0", () => expect(read([0x00, 0x00, 0x00, 0x00], 0)).toBe(0));
    test("reads max positive", () => expect(read([0x7f, 0xff, 0xff, 0xff], 0)).toBe(2147483647));
    test("reads min negative", () => expect(read([0x80, 0x00, 0x00, 0x00], 0)).toBe(-2147483648));
    test("reads -1", () => expect(read([0xff, 0xff, 0xff, 0xff], 0)).toBe(-1));
    test("matches Buffer.readInt32BE", () => {
        const bytes = [0x89, 0xab, 0xcd, 0xef];
        expect(read(bytes, 0)).toBe(Buffer.from(bytes).readInt32BE(0));
    });
    test("respects offset", () => {
        const bytes = [0x00, 0x80, 0x00, 0x00, 0x00];
        expect(read(bytes, 1)).toBe(Buffer.from(bytes).readInt32BE(1));
    });
});

describe("BigUint64LE", () => {
    const read = createReader("BigUint64LE");

    test("reads 0", () => expect(read([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], 0)).toBe(0));
    test("reads 1 (lo only)", () => expect(read([0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], 0)).toBe(1));
    test("reads 2^32 (hi only)", () => expect(read([0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00], 0)).toBe(4294967296));
    test("reads combined lo + hi", () => expect(read([0x01, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00], 0)).toBe(2 * 4294967296 + 1));
    test("respects offset", () => {
        const bytes = [0xff, 0x01, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00];
        expect(read(bytes, 1)).toBe(2 * 4294967296 + 1);
    });
});

describe("BigInt64LE", () => {
    const read = createReader("BigInt64LE");

    test("reads 0", () => expect(read([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], 0)).toBe(0));
    test("reads positive (hi=2, lo=1)", () => expect(read([0x01, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00], 0)).toBe(2 * 4294967296 + 1));
    test("reads -1 (all 0xFF)", () => expect(read([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff], 0)).toBe(-1));
    test("reads -2^32 (hi=-1, lo=0)", () => expect(read([0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0xff], 0)).toBe(-4294967296));
});

describe("BigUint64BE", () => {
    const read = createReader("BigUint64BE");

    test("reads 0", () => expect(read([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], 0)).toBe(0));
    test("reads 1 (lo only)", () => expect(read([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01], 0)).toBe(1));
    test("reads 2^32 (hi only)", () => expect(read([0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00], 0)).toBe(4294967296));
    test("reads combined hi + lo", () => expect(read([0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x01], 0)).toBe(2 * 4294967296 + 1));
    test("respects offset", () => {
        const bytes = [0xff, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x01];
        expect(read(bytes, 1)).toBe(2 * 4294967296 + 1);
    });
});

describe("BigInt64BE", () => {
    const read = createReader("BigInt64BE");

    test("reads 0", () => expect(read([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], 0)).toBe(0));
    test("reads positive (hi=2, lo=1)", () => expect(read([0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x01], 0)).toBe(2 * 4294967296 + 1));
    test("reads -1 (all 0xFF)", () => expect(read([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff], 0)).toBe(-1));
    test("reads -2^32 (hi=-1, lo=0)", () => expect(read([0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00], 0)).toBe(-4294967296));
});


describe("Float16LE", () => {
    const read = createReader("Float16LE");

    // bytes are [byte0=low, byte1=high]
    test("+0",          () => expect(read([0x00, 0x00], 0)).toBe(0));
    test("-0",          () => expect(Object.is(read([0x00, 0x80], 0), -0)).toBe(true));
    test("1.0",         () => expect(read([0x00, 0x3c], 0)).toBe(1.0));
    test("2.0",         () => expect(read([0x00, 0x40], 0)).toBe(2.0));
    test("-1.0",        () => expect(read([0x00, 0xbc], 0)).toBe(-1.0));
    test("+Infinity",   () => expect(read([0x00, 0x7c], 0)).toBe(Infinity));
    test("-Infinity",   () => expect(read([0x00, 0xfc], 0)).toBe(-Infinity));
    test("NaN",         () => expect(read([0x01, 0x7c], 0)).toBeNaN());
    test("respects offset", () => {
        const bytes = [0x00, 0x00, 0x3c];
        expect(read(bytes, 1)).toBe(1.0);
    });
});

describe("Float16BE", () => {
    const read = createReader("Float16BE");

    // bytes are [byte0=high, byte1=low]
    test("+0",          () => expect(read([0x00, 0x00], 0)).toBe(0));
    test("-0",          () => expect(Object.is(read([0x80, 0x00], 0), -0)).toBe(true));
    test("1.0",         () => expect(read([0x3c, 0x00], 0)).toBe(1.0));
    test("2.0",         () => expect(read([0x40, 0x00], 0)).toBe(2.0));
    test("-1.0",        () => expect(read([0xbc, 0x00], 0)).toBe(-1.0));
    test("+Infinity",   () => expect(read([0x7c, 0x00], 0)).toBe(Infinity));
    test("-Infinity",   () => expect(read([0xfc, 0x00], 0)).toBe(-Infinity));
    test("NaN",         () => expect(read([0x7c, 0x01], 0)).toBeNaN());
    test("respects offset", () => {
        const bytes = [0x00, 0x3c, 0x00];
        expect(read(bytes, 1)).toBe(1.0);
    });
});


describe("Float32LE", () => {
    const read = createReader("Float32LE");

    // Reference: DataView.getFloat32(offset, littleEndian=true)
    test("+0",        () => expect(read([0x00, 0x00, 0x00, 0x00], 0)).toBe(dv([0x00, 0x00, 0x00, 0x00]).getFloat32(0, true)));
    test("-0",        () => expect(Object.is(read([0x00, 0x00, 0x00, 0x80], 0), -0)).toBe(true));
    test("1.0",       () => expect(read([0x00, 0x00, 0x80, 0x3f], 0)).toBe(dv([0x00, 0x00, 0x80, 0x3f]).getFloat32(0, true)));
    test("2.0",       () => expect(read([0x00, 0x00, 0x00, 0x40], 0)).toBe(dv([0x00, 0x00, 0x00, 0x40]).getFloat32(0, true)));
    test("-1.0",      () => expect(read([0x00, 0x00, 0x80, 0xbf], 0)).toBe(dv([0x00, 0x00, 0x80, 0xbf]).getFloat32(0, true)));
    test("+Infinity", () => expect(read([0x00, 0x00, 0x80, 0x7f], 0)).toBe(Infinity));
    test("-Infinity", () => expect(read([0x00, 0x00, 0x80, 0xff], 0)).toBe(-Infinity));
    test("NaN",       () => expect(read([0x00, 0x00, 0xc0, 0x7f], 0)).toBeNaN());
    test("matches DataView for arbitrary bytes", () => {
        const bytes = [0xdb, 0x0f, 0x49, 0x40]; // π ≈ 3.14159...
        expect(read(bytes, 0)).toBeCloseTo(dv(bytes).getFloat32(0, true), 5);
    });
    test("respects offset", () => {
        const bytes = [0xff, 0x00, 0x00, 0x80, 0x3f];
        expect(read(bytes, 1)).toBe(dv(bytes).getFloat32(1, true));
    });
});

describe("Float32BE", () => {
    const read = createReader("Float32BE");

    test("+0",        () => expect(read([0x00, 0x00, 0x00, 0x00], 0)).toBe(dv([0x00, 0x00, 0x00, 0x00]).getFloat32(0, false)));
    test("-0",        () => expect(Object.is(read([0x80, 0x00, 0x00, 0x00], 0), -0)).toBe(true));
    test("1.0",       () => expect(read([0x3f, 0x80, 0x00, 0x00], 0)).toBe(dv([0x3f, 0x80, 0x00, 0x00]).getFloat32(0, false)));
    test("2.0",       () => expect(read([0x40, 0x00, 0x00, 0x00], 0)).toBe(dv([0x40, 0x00, 0x00, 0x00]).getFloat32(0, false)));
    test("-1.0",      () => expect(read([0xbf, 0x80, 0x00, 0x00], 0)).toBe(dv([0xbf, 0x80, 0x00, 0x00]).getFloat32(0, false)));
    test("+Infinity", () => expect(read([0x7f, 0x80, 0x00, 0x00], 0)).toBe(Infinity));
    test("-Infinity", () => expect(read([0xff, 0x80, 0x00, 0x00], 0)).toBe(-Infinity));
    test("NaN",       () => expect(read([0x7f, 0xc0, 0x00, 0x00], 0)).toBeNaN());
    test("matches DataView for arbitrary bytes", () => {
        const bytes = [0x40, 0x49, 0x0f, 0xdb]; // π ≈ 3.14159...
        expect(read(bytes, 0)).toBeCloseTo(dv(bytes).getFloat32(0, false), 5);
    });
    test("respects offset", () => {
        const bytes = [0xff, 0x3f, 0x80, 0x00, 0x00];
        expect(read(bytes, 1)).toBe(dv(bytes).getFloat32(1, false));
    });
});

describe("Float64LE", () => {
    const read = createReader("Float64LE");

    test("+0",        () => expect(read([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], 0)).toBe(dv([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]).getFloat64(0, true)));
    test("-0",        () => expect(Object.is(read([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x80], 0), -0)).toBe(true));
    test("1.0",       () => expect(read([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xf0, 0x3f], 0)).toBe(dv([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xf0, 0x3f]).getFloat64(0, true)));
    test("2.0",       () => expect(read([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x40], 0)).toBe(2.0));
    test("-1.0",      () => expect(read([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xf0, 0xbf], 0)).toBe(-1.0));
    test("+Infinity", () => expect(read([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xf0, 0x7f], 0)).toBe(Infinity));
    test("-Infinity", () => expect(read([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xf0, 0xff], 0)).toBe(-Infinity));
    test("NaN",       () => expect(read([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xf8, 0x7f], 0)).toBeNaN());
    test("matches DataView for π", () => {
        const bytes = [0x18, 0x2d, 0x44, 0x54, 0xfb, 0x21, 0x09, 0x40]; // Math.PI
        expect(read(bytes, 0)).toBeCloseTo(dv(bytes).getFloat64(0, true), 5);
    });
    test("respects offset", () => {
        const bytes = [0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xf0, 0x3f];
        expect(read(bytes, 1)).toBe(dv(bytes).getFloat64(1, true));
    });
});

describe("Float64BE", () => {
    const read = createReader("Float64BE");

    test("+0",        () => expect(read([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], 0)).toBe(0));
    test("-0",        () => expect(Object.is(read([0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], 0), -0)).toBe(true));
    test("1.0",       () => expect(read([0x3f, 0xf0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], 0)).toBe(dv([0x3f, 0xf0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]).getFloat64(0, false)));
    test("2.0",       () => expect(read([0x40, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], 0)).toBe(2.0));
    test("-1.0",      () => expect(read([0xbf, 0xf0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], 0)).toBe(-1.0));
    test("+Infinity", () => expect(read([0x7f, 0xf0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], 0)).toBe(Infinity));
    test("-Infinity", () => expect(read([0xff, 0xf0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], 0)).toBe(-Infinity));
    test("NaN",       () => expect(read([0x7f, 0xf8, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], 0)).toBeNaN());
    test("matches DataView for π", () => {
        const bytes = [0x40, 0x09, 0x21, 0xfb, 0x54, 0x44, 0x2d, 0x18]; // Math.PI
        expect(read(bytes, 0)).toBeCloseTo(dv(bytes).getFloat64(0, false), 5);
    });
    test("respects offset", () => {
        const bytes = [0xff, 0x3f, 0xf0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
        expect(read(bytes, 1)).toBe(dv(bytes).getFloat64(1, false));
    });
});
