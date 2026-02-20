# Binary Parser Tool

A utility for generating parsers suitable for Chirpstack v3, Chirpstack v4, and more, using [binary-parser](https://github.com/keichi/binary-parser)

## How to use

Define a parser for each LoRa device fPort

```typescript
// ./src/my-parser.ts
import { Parser } from "binary-parser"
export const parser = new Parser()
    .endianness("big")
    ...
```

Generate Chirpstack v3 and v4 decoders in your parser distribution pipeline

```typescript
// ./tools/chirpstack-pipeline.ts
import fs from "fs/promises";
import {
    generateChirpstackV4,
    generateChirpstackV3,
    LoraParsers
} from "binary-parser-tool";
import { parser } from "../src/my-parser";

const parsers: LoraParsers = {
    2: parser,
};

const [v4, v3] = await Promise.all([
    generateChirpstackV4(parsers),
    generateChirpstackV3(parsers),
]);

await Promise.all([
    fs.writeFile("./dist/chirpstack-v4-decoder.js", v4),
    fs.writeFile("./dist/chirpstack-v3-decoder.js", v3)
]);
```

