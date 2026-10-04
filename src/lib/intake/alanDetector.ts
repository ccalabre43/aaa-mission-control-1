/**
 * Detecting an ALAN number from an uploaded document.
 *
 * The designed behavior is: a document is uploaded, its ALAN number is recognized and used; if none
 * is found, the app asks whether the requester has one.
 *
 * This version implements only the second branch. `NoopDetector` always reports that nothing was
 * found, so the ask branch always runs - which means the Sprint 1 path IS the designed "none found"
 * path, exercised from day one rather than stubbed around. A later `PdfAlanDetector` implements this
 * same interface and the conditional UI it feeds already exists.
 *
 * Choosing ask-only also keeps `pdfjs-dist` and any OCR engine out of the bundle, so no Vendor
 * Management review is triggered now. Adding either later does trigger one, along with a
 * bundle-size conversation: an OCR engine is roughly 15MB of wasm, slower, and more prone to false
 * reads.
 */
import type { AttachmentRef } from "./types";

export interface AlanCandidate {
  value: string;
  /** Which uploaded file it came from, so the requester can audit the suggestion. */
  sourceFileName: string;
  /** How the detector found it, for the same reason. */
  method: "pdf-text" | "ocr" | "file-name";
}

export interface AlanDetectionResult {
  candidates: AlanCandidate[];
  /** True when detection genuinely ran. False means it was never attempted. */
  searched: boolean;
  /** Why detection could not run or produced nothing, in plain language. */
  note?: string;
}

/**
 * The swap point. Implementations receive the real `File` objects, because attachment metadata
 * alone cannot be parsed - and because file contents are never persisted, detection has to happen
 * while the file is still in hand.
 */
export interface AlanNumberDetector {
  readonly id: string;
  detect(files: File[], refs: AttachmentRef[]): Promise<AlanDetectionResult>;
}

/**
 * Reports nothing found, always. Not a placeholder that throws or returns fake data: it is the
 * honest answer for a build that does no document parsing.
 */
export class NoopDetector implements AlanNumberDetector {
  readonly id = "noop";

  async detect(
    _files: File[],
    refs: AttachmentRef[],
  ): Promise<AlanDetectionResult> {
    return {
      candidates: [],
      searched: false,
      note:
        refs.length > 0
          ? "Attachments are not read for an ALAN number yet, so please confirm it below."
          : undefined,
    };
  }
}

export const defaultAlanDetector: AlanNumberDetector = new NoopDetector();
