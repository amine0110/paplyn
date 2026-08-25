import { EditorView } from "@codemirror/view";
import { extractDoi } from "@/lib/doi-citation";

export function createDoiPasteExtension(onDoiPaste: (doi: string) => void): ReturnType<typeof EditorView.domEventHandlers> {
  return EditorView.domEventHandlers({
    paste(event) {
      const text = event.clipboardData?.getData("text/plain") ?? "";
      const doi = extractDoi(text);
      if (!doi) return false;
      onDoiPaste(doi);
      return false;
    },
  });
}
