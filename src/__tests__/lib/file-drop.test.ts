/**
 * Tests for the drag & drop file helpers (FileSystemEntry fakes, jsdom has no real ones)
 */
import { collectDroppedFiles, traverseFileTree } from "@/lib/client/file-drop";

const makeFile = (name: string, content = "x") => new File([content], name);

function fileEntry(file: File): FileSystemEntry {
  return {
    isFile: true,
    isDirectory: false,
    name: file.name,
    file: (cb: (f: File) => void) => cb(file),
  } as unknown as FileSystemEntry;
}

/** Directory whose reader returns `batches` one at a time, then an empty array. */
function dirEntry(name: string, batches: FileSystemEntry[][]): FileSystemEntry {
  const remaining = [...batches];
  const readEntries = jest.fn((cb: (entries: FileSystemEntry[]) => void) =>
    cb(remaining.shift() ?? [])
  );
  return {
    isFile: false,
    isDirectory: true,
    name,
    createReader: () => ({ readEntries }),
    readEntries,
  } as unknown as FileSystemEntry;
}

const paths = (results: { relativePath: string }[]) => results.map((r) => r.relativePath).sort();

describe("traverseFileTree", () => {
  it("returns a single file with the given path prefix", async () => {
    const file = makeFile("a.txt");

    const result = await traverseFileTree(fileEntry(file), "");

    expect(result).toEqual([{ file, relativePath: "a.txt" }]);
    expect(result[0].file).toBe(file);
  });

  it("prefixes the file name with the path it was given", async () => {
    const result = await traverseFileTree(fileEntry(makeFile("a.txt")), "docs/");

    expect(paths(result)).toEqual(["docs/a.txt"]);
  });

  it("flattens nested directories with relative paths", async () => {
    const tree = dirEntry("root", [
      [
        fileEntry(makeFile("top.txt")),
        dirEntry("sub", [
          [fileEntry(makeFile("one.txt")), dirEntry("deep", [[fileEntry(makeFile("two.txt"))]])],
        ]),
      ],
    ]);

    const result = await traverseFileTree(tree, "");

    expect(paths(result)).toEqual(["root/sub/deep/two.txt", "root/sub/one.txt", "root/top.txt"]);
  });

  it("reads every batch returned by readEntries until it is empty", async () => {
    const tree = dirEntry("batched", [
      [fileEntry(makeFile("1.txt")), fileEntry(makeFile("2.txt"))],
      [fileEntry(makeFile("3.txt"))],
      [fileEntry(makeFile("4.txt")), fileEntry(makeFile("5.txt"))],
    ]);

    const result = await traverseFileTree(tree, "");

    expect(paths(result)).toEqual([
      "batched/1.txt",
      "batched/2.txt",
      "batched/3.txt",
      "batched/4.txt",
      "batched/5.txt",
    ]);
    // 3 non-empty batches + the terminating empty one
    expect((tree as unknown as { readEntries: jest.Mock }).readEntries).toHaveBeenCalledTimes(4);
  });

  it("returns nothing for an empty directory", async () => {
    expect(await traverseFileTree(dirEntry("empty", []), "")).toEqual([]);
  });

  it("returns nothing for an entry that is neither a file nor a directory", async () => {
    const unknown = { isFile: false, isDirectory: false, name: "weird" } as FileSystemEntry;

    expect(await traverseFileTree(unknown, "")).toEqual([]);
  });

  it("ignores unknown entries nested in a directory", async () => {
    const unknown = { isFile: false, isDirectory: false, name: "weird" } as FileSystemEntry;
    const tree = dirEntry("mixed", [[unknown, fileEntry(makeFile("ok.txt"))]]);

    expect(paths(await traverseFileTree(tree, ""))).toEqual(["mixed/ok.txt"]);
  });
});

describe("collectDroppedFiles", () => {
  const asList = (items: unknown[]) => items as unknown as DataTransferItemList;

  it("collects files and folders from file items", async () => {
    const items = asList([
      { kind: "file", webkitGetAsEntry: () => fileEntry(makeFile("a.txt")) },
      {
        kind: "file",
        webkitGetAsEntry: () => dirEntry("folder", [[fileEntry(makeFile("b.txt"))]]),
      },
    ]);

    expect(paths(await collectDroppedFiles(items))).toEqual(["a.txt", "folder/b.txt"]);
  });

  it("skips items that are not files", async () => {
    const webkitGetAsEntry = jest.fn(() => fileEntry(makeFile("nope.txt")));
    const items = asList([
      { kind: "string", webkitGetAsEntry },
      { kind: "file", webkitGetAsEntry: () => fileEntry(makeFile("yes.txt")) },
    ]);

    expect(paths(await collectDroppedFiles(items))).toEqual(["yes.txt"]);
    expect(webkitGetAsEntry).not.toHaveBeenCalled();
  });

  it("skips file items without webkitGetAsEntry", async () => {
    const items = asList([
      { kind: "file" },
      { kind: "file", webkitGetAsEntry: () => fileEntry(makeFile("yes.txt")) },
    ]);

    expect(paths(await collectDroppedFiles(items))).toEqual(["yes.txt"]);
  });

  it("skips file items whose entry is null", async () => {
    const items = asList([
      { kind: "file", webkitGetAsEntry: () => null },
      { kind: "file", webkitGetAsEntry: () => fileEntry(makeFile("yes.txt")) },
    ]);

    expect(paths(await collectDroppedFiles(items))).toEqual(["yes.txt"]);
  });

  it("returns an empty list when nothing can be collected", async () => {
    expect(await collectDroppedFiles(asList([]))).toEqual([]);
    expect(await collectDroppedFiles(asList([{ kind: "file" }]))).toEqual([]);
  });
});
