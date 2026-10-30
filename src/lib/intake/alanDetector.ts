/**
 * Detecting an ALAN number from an uploaded document.
 *
 * `DocumentAlanDetector` reads filenames and locally extracted brief text (via briefDecipherer).
 * No cloud OCR and no Vendor Management dependency. When nothing is found, the ask branch still
 * runs so the requester can confirm or leave blank.
 */
import { ALAN_SEARCH_PATTERN } from "./alanNumber";
import { decipherBriefFiles } from "./briefDecipherer";
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

function fromFileNames(files: File[]): AlanCandidate[] {
  const out: AlanCandidate[] = [];
  for (const file of files) {
    const matches = file.name.match(ALAN_SEARCH_PATTERN);
    if (!matches) continue;
    for (const value of matches) {
      out.push({
        value: value.toUpperCase(),
        sourceFileName: file.name,
        method: "file-name",
      });
    }
  }
  return out;
}

/**
 * Local document ALAN detection: filename patterns plus brief decipherer text extraction.
 */
export class DocumentAlanDetector implements AlanNumberDetector {
  readonly id = "document";

  async detect(
    files: File[],
    refs: AttachmentRef[],
  ): Promise<AlanDetectionResult> {
    if (files.length === 0 && refs.length === 0) {
      return { candidates: [], searched: false };
    }

    const fromNames = fromFileNames(files);
    let fromDocs: AlanCandidate[] = [];
    let note: string | undefined;

    try {
      const deciphered = await decipherBriefFiles(files, []);
      fromDocs = deciphered.alanCandidates;
      if (deciphered.filesRead === 0 && refs.length > 0) {
        note =
          "Attachments are recorded, but no supported brief text was available for ALAN detection. Confirm the number below.";
      }
    } catch {
      note =
        "Could not read attachment text for an ALAN number. Confirm it below if you have one.";
    }

    const seen = new Set<string>();
    const candidates = [...fromNames, ...fromDocs].filter((item) => {
      if (seen.has(item.value)) return false;
      seen.add(item.value);
      return true;
    });

    return {
      candidates,
      searched: true,
      note:
        candidates.length === 0
          ? note ??
            (refs.length > 0
              ? "No ALAN number was found in the uploaded files. Confirm it below if you have one."
              : undefined)
          : undefined,
    };
  }
}

/** Kept for tests and call sites that need the honest no-parse path. */
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

export const defaultAlanDetector: AlanNumberDetector = new DocumentAlanDetector();
