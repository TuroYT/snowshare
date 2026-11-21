/**
 * Tests for the FileDropZone component
 */
import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FileDropZone from "@/components/shareComponents/FileDropZone";
import { collectDroppedFiles, type FileWithPath } from "@/lib/client/file-drop";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, def?: unknown, opts?: Record<string, unknown>) => {
      if (typeof def !== "string") return key;
      return def.replace(/{{(\w+)}}/g, (_m, name) => String(opts?.[name] ?? ""));
    },
    i18n: { language: "en" },
  }),
}));

jest.mock("@/lib/client/file-drop", () => ({
  collectDroppedFiles: jest.fn(),
}));

const mockCollectDroppedFiles = collectDroppedFiles as jest.Mock;

const makeFile = (name: string, content = "hello", lastModified = 1000) =>
  new File([content], name, { type: "text/plain", lastModified });

interface HarnessProps {
  setError: (error: string | null) => void;
  initialFiles?: FileWithPath[];
  onFiles?: (files: FileWithPath[]) => void;
}

/** Owns the files state like FileShare does. */
function Harness({ setError, initialFiles = [], onFiles }: HarnessProps) {
  const [files, setFiles] = React.useState<FileWithPath[]>(initialFiles);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const dirInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    onFiles?.(files);
  }, [files, onFiles]);

  return (
    <FileDropZone
      files={files}
      setFiles={setFiles}
      setError={setError}
      totalSize={files.reduce((sum, f) => sum + f.file.size, 0)}
      formatFileSize={(bytes) => `${bytes} B`}
      maxSizeHint="50 MiB maximum"
      fileInputRef={fileInputRef}
      dirInputRef={dirInputRef}
    />
  );
}

// user-event filters files against the input's accept attribute and does not understand accept="*/*"
const newUser = () => userEvent.setup({ applyAccept: false });

describe("FileDropZone", () => {
  let setError: jest.Mock;
  let consoleErrorSpy: jest.SpyInstance;

  const setup = (props: Partial<HarnessProps> = {}) => {
    const utils = render(<Harness setError={setError} {...props} />);
    const inputs = utils.container.querySelectorAll<HTMLInputElement>('input[type="file"]');
    return { ...utils, fileInput: inputs[0], dirInput: inputs[1] };
  };

  beforeEach(() => {
    setError = jest.fn();
    mockCollectDroppedFiles.mockReset();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("shows the empty drop area with the size hint", () => {
    setup();

    expect(screen.getByRole("group")).toBeInTheDocument();
    expect(screen.getByText("Drag & drop files or folders here")).toBeInTheDocument();
    expect(screen.getByText("50 MiB maximum")).toBeInTheDocument();
    expect(screen.queryByText(/Selected Files/)).not.toBeInTheDocument();
  });

  describe("selecting files", () => {
    it("adds the files picked with the hidden input and lists them", async () => {
      const user = newUser();
      const { fileInput } = setup();

      await user.upload(fileInput, [makeFile("a.txt", "aaa"), makeFile("b.txt", "bbbbb")]);

      expect(screen.getByText("Selected Files (2)")).toBeInTheDocument();
      expect(screen.getByText("a.txt")).toBeInTheDocument();
      expect(screen.getByText("b.txt")).toBeInTheDocument();
      expect(screen.getByText("Total: 8 B")).toBeInTheDocument();
      expect(screen.queryByRole("group")).not.toBeInTheDocument();
    });

    it("clears the error when files are added", async () => {
      const user = newUser();
      const { fileInput } = setup();

      await user.upload(fileInput, makeFile("a.txt"));

      expect(setError).toHaveBeenCalledWith(null);
    });

    it("keeps the previous files when more are added", async () => {
      const user = newUser();
      const onFiles = jest.fn();
      const { fileInput } = setup({ onFiles });

      await user.upload(fileInput, makeFile("a.txt"));
      await user.upload(fileInput, makeFile("b.txt"));

      expect(screen.getByText("Selected Files (2)")).toBeInTheDocument();
      expect(onFiles).toHaveBeenLastCalledWith([
        expect.objectContaining({ relativePath: "a.txt" }),
        expect.objectContaining({ relativePath: "b.txt" }),
      ]);
    });

    it("skips duplicates (same name, size and lastModified)", async () => {
      const user = newUser();
      const { fileInput } = setup();

      await user.upload(fileInput, makeFile("a.txt"));
      // A different File object describing the same file
      await user.upload(fileInput, makeFile("a.txt"));
      // Duplicate inside the same selection
      await user.upload(fileInput, [makeFile("b.txt"), makeFile("b.txt")]);

      expect(screen.getByText("Selected Files (2)")).toBeInTheDocument();
      expect(screen.getAllByText("a.txt")).toHaveLength(1);
      expect(screen.getAllByText("b.txt")).toHaveLength(1);
    });

    it("keeps files that share a name but differ in size or lastModified", async () => {
      const user = newUser();
      const { fileInput } = setup();

      await user.upload(fileInput, makeFile("a.txt", "short", 1000));
      await user.upload(fileInput, makeFile("a.txt", "much longer", 1000));
      await user.upload(fileInput, makeFile("a.txt", "short", 2000));

      expect(screen.getByText("Selected Files (3)")).toBeInTheDocument();
      expect(screen.getAllByText("a.txt")).toHaveLength(3);
    });

    it("resets the input value so the same file can be picked again", async () => {
      const user = newUser();
      const { fileInput } = setup();

      await user.upload(fileInput, makeFile("a.txt"));

      expect(fileInput.value).toBe("");
      expect(fileInput.files).toHaveLength(0);
    });

    it("uses webkitRelativePath for files picked with the folder input", async () => {
      const onFiles = jest.fn();
      const { dirInput } = setup({ onFiles });
      const nested = makeFile("inner.txt");
      Object.defineProperty(nested, "webkitRelativePath", { value: "photos/2024/inner.txt" });
      const flat = makeFile("flat.txt");

      expect(dirInput).toHaveAttribute("webkitdirectory");
      fireEvent.change(dirInput, { target: { files: [nested, flat] } });

      expect(screen.getByText("photos/2024/inner.txt")).toBeInTheDocument();
      expect(screen.getByText("flat.txt")).toBeInTheDocument();
      expect(onFiles).toHaveBeenLastCalledWith([
        expect.objectContaining({ relativePath: "photos/2024/inner.txt" }),
        expect.objectContaining({ relativePath: "flat.txt" }),
      ]);
    });

    it("opens the matching hidden input from the picker buttons", async () => {
      const user = newUser();
      const { fileInput, dirInput } = setup();
      const fileClick = jest.spyOn(fileInput, "click").mockImplementation(() => {});
      const dirClick = jest.spyOn(dirInput, "click").mockImplementation(() => {});

      await user.click(screen.getByRole("button", { name: "Select Files" }));
      expect(fileClick).toHaveBeenCalledTimes(1);
      expect(dirClick).not.toHaveBeenCalled();

      await user.click(screen.getByRole("button", { name: "Select Folder" }));
      expect(dirClick).toHaveBeenCalledTimes(1);
      // stopPropagation: the click does not also reach the drop area handler
      expect(fileClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("removing files", () => {
    it("removes only the chosen file", async () => {
      const user = newUser();
      const { fileInput } = setup();
      await user.upload(fileInput, [makeFile("a.txt"), makeFile("b.txt")]);

      await user.click(screen.getByRole("button", { name: "Remove a.txt" }));

      expect(screen.getByText("Selected Files (1)")).toBeInTheDocument();
      expect(screen.queryByText("a.txt")).not.toBeInTheDocument();
      expect(screen.getByText("b.txt")).toBeInTheDocument();
    });

    it("goes back to the drop area once the last file is removed", async () => {
      const user = newUser();
      const { fileInput } = setup();
      await user.upload(fileInput, makeFile("a.txt"));

      await user.click(screen.getByRole("button", { name: "Remove a.txt" }));

      expect(screen.getByRole("group")).toBeInTheDocument();
      expect(screen.queryByText(/Selected Files/)).not.toBeInTheDocument();
    });

    it("lets the same file be picked again after it was removed", async () => {
      const user = newUser();
      const { fileInput } = setup();
      const file = makeFile("a.txt");

      await user.upload(fileInput, file);
      await user.click(screen.getByRole("button", { name: "Remove a.txt" }));
      await user.upload(fileInput, file);

      expect(screen.getByText("Selected Files (1)")).toBeInTheDocument();
      expect(screen.getByText("a.txt")).toBeInTheDocument();
    });

    it("renders files provided by the parent", () => {
      setup({
        initialFiles: [{ file: makeFile("pre.txt", "12345"), relativePath: "dir/pre.txt" }],
      });

      const list = screen.getByText("Selected Files (1)").closest("div")
        ?.parentElement as HTMLElement;
      expect(within(list).getByText("dir/pre.txt")).toBeInTheDocument();
      expect(within(list).getByText("5 B")).toBeInTheDocument();
    });
  });

  describe("drag and drop", () => {
    const dropWith = (group: HTMLElement, items: unknown) =>
      fireEvent.drop(group, { dataTransfer: { items } });

    it("highlights the drop area while dragging over and resets on leave", () => {
      setup();
      const group = screen.getByRole("group");
      expect(group).not.toHaveClass("border-[var(--secondary)]");

      fireEvent.dragOver(group);
      expect(group).toHaveClass("border-[var(--secondary)]");

      fireEvent.dragLeave(group);
      expect(group).not.toHaveClass("border-[var(--secondary)]");
    });

    it("prevents the default drag over behaviour so the drop is accepted", () => {
      setup();

      // fireEvent returns false when preventDefault() was called
      expect(fireEvent.dragOver(screen.getByRole("group"))).toBe(false);
    });

    it("adds the files collected from the dropped items and resets the highlight", async () => {
      const dropped: FileWithPath[] = [
        { file: makeFile("a.txt"), relativePath: "a.txt" },
        { file: makeFile("b.txt"), relativePath: "folder/b.txt" },
      ];
      mockCollectDroppedFiles.mockResolvedValue(dropped);
      setup();
      const group = screen.getByRole("group");
      const items = [{ kind: "file" }];

      fireEvent.dragOver(group);
      await act(async () => {
        dropWith(group, items);
      });

      expect(mockCollectDroppedFiles).toHaveBeenCalledWith(items);
      expect(await screen.findByText("Selected Files (2)")).toBeInTheDocument();
      expect(screen.getByText("a.txt")).toBeInTheDocument();
      expect(screen.getByText("folder/b.txt")).toBeInTheDocument();
      expect(setError).toHaveBeenCalledWith(null);
    });

    it("skips duplicates within the dropped files", async () => {
      mockCollectDroppedFiles.mockResolvedValue([
        { file: makeFile("a.txt"), relativePath: "a.txt" },
        { file: makeFile("a.txt"), relativePath: "a.txt" },
      ]);
      setup();

      dropWith(screen.getByRole("group"), [{ kind: "file" }]);

      expect(await screen.findByText("Selected Files (1)")).toBeInTheDocument();
    });

    it("ignores a drop that carries no items", () => {
      setup();

      dropWith(screen.getByRole("group"), undefined);

      expect(mockCollectDroppedFiles).not.toHaveBeenCalled();
      expect(setError).not.toHaveBeenCalled();
    });

    it("shows a network error when collecting the dropped files fails", async () => {
      const failure = new Error("traversal failed");
      mockCollectDroppedFiles.mockRejectedValue(failure);
      setup();

      dropWith(screen.getByRole("group"), [{ kind: "file" }]);

      await waitFor(() =>
        expect(setError).toHaveBeenCalledWith("Network error — could not create share")
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith("FileDropZone drop handling error:", failure);
      expect(screen.queryByText(/Selected Files/)).not.toBeInTheDocument();
    });
  });
});
