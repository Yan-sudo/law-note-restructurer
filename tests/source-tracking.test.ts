import { describe, it, expect } from "vitest";
import {
    detectChangedSources,
    mergeSignatures,
    watchedFolders,
    type SourceSignature,
} from "../src/pipeline/source-tracking";

const recorded: SourceSignature[] = [
    { path: "Law/ch1.md", mtime: 100 },
    { path: "Law/ch2.md", mtime: 100 },
];

describe("detectChangedSources", () => {
    it("flags new and modified files, ignores unchanged ones", () => {
        const current: SourceSignature[] = [
            { path: "Law/ch1.md", mtime: 100 }, // unchanged
            { path: "Law/ch2.md", mtime: 200 }, // modified
            { path: "Law/ch3.md", mtime: 50 }, // new
        ];
        expect(detectChangedSources(current, recorded).sort()).toEqual(["Law/ch2.md", "Law/ch3.md"]);
    });

    it("returns nothing when everything matches", () => {
        expect(detectChangedSources(recorded, recorded)).toEqual([]);
    });
});

describe("mergeSignatures", () => {
    it("unions and takes the newer mtime", () => {
        const merged = mergeSignatures(recorded, [
            { path: "Law/ch2.md", mtime: 200 },
            { path: "Law/ch3.md", mtime: 50 },
        ]);
        const byPath = Object.fromEntries(merged.map((s) => [s.path, s.mtime]));
        expect(byPath).toEqual({ "Law/ch1.md": 100, "Law/ch2.md": 200, "Law/ch3.md": 50 });
    });
});

describe("watchedFolders", () => {
    it("returns the distinct parent folders", () => {
        expect(
            watchedFolders([
                { path: "Law/ch1.md", mtime: 1 },
                { path: "Law/sub/ch2.md", mtime: 1 },
                { path: "root.md", mtime: 1 },
            ]).sort()
        ).toEqual(["", "Law", "Law/sub"]);
    });
});
