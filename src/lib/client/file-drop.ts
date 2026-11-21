export interface FileWithPath {
  file: File;
  relativePath: string;
}

/**
 * Flattens a dropped file or directory into files tagged with their relative path.
 * `readEntries()` must be called repeatedly until it returns an empty array to get every
 * entry (https://www.w3.org/TR/FileAPI/#file-directory-reader).
 */
export async function traverseFileTree(
  entry: FileSystemEntry,
  path: string
): Promise<FileWithPath[]> {
  return new Promise((resolve) => {
    if (entry.isFile) {
      (entry as FileSystemFileEntry).file((file: File) => {
        const relativePath = path + file.name;
        resolve([{ file, relativePath }]);
      });
    } else if (entry.isDirectory) {
      const dirReader = (entry as FileSystemDirectoryEntry).createReader();

      const readAllEntries = async (): Promise<FileSystemEntry[]> => {
        const allEntries: FileSystemEntry[] = [];

        while (true) {
          const batch: FileSystemEntry[] = await new Promise((res) => {
            dirReader.readEntries((entries: FileSystemEntry[]) => {
              res(entries);
            });
          });

          if (!batch.length) {
            break;
          }

          allEntries.push(...batch);
        }

        return allEntries;
      };

      (async () => {
        const entries = await readAllEntries();
        const results = await Promise.all(
          entries.map((e) => traverseFileTree(e, path + entry.name + "/"))
        );
        resolve(results.flat());
      })();
    } else {
      resolve([]);
    }
  });
}

export async function collectDroppedFiles(items: DataTransferItemList): Promise<FileWithPath[]> {
  const filePromises: Promise<FileWithPath[]>[] = [];

  for (const item of Array.from(items)) {
    if (item.kind === "file") {
      const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
      if (!entry) {
        continue;
      }
      filePromises.push(traverseFileTree(entry, ""));
    }
  }

  const results = await Promise.all(filePromises);
  return results.flat();
}
