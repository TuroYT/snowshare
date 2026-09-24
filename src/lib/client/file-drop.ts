/**
 * Pure helpers for walking the HTML5 FileSystem Entry API when files/folders
 * are dropped onto the file share drop zone. Kept free of React so it can be
 * unit tested in isolation from the component tree.
 */

export interface FileWithPath {
  file: File;
  relativePath: string;
}

/**
 * Recursively reads a FileSystemEntry (file or directory) and resolves to the
 * flat list of files it contains, each tagged with its relative path.
 *
 * Per the FileSystem API spec, `readEntries()` on a directory reader must be
 * called repeatedly until it returns an empty array to get all entries.
 * See: https://www.w3.org/TR/FileAPI/#file-directory-reader
 * (Behavior implemented by WebKit/Blink as well.)
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

/**
 * Walks every dropped DataTransferItem (files and folders) and resolves to
 * the flat list of files with their relative paths.
 */
export async function collectDroppedFiles(items: DataTransferItemList): Promise<FileWithPath[]> {
  const filePromises: Promise<FileWithPath[]>[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
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
