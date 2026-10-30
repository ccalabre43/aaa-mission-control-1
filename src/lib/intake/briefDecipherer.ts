/**
 * Local brief deciphering (.docx, text-layer .pdf, .txt/.md/.rtf).
 *
 * Runs entirely in the browser with Web APIs — no npm PDF/LLM vendors, no network.
 * Every pre-fill records the source file and matched heading so the requester can audit it.
 */
import { ALAN_SEARCH_PATTERN } from "./alanNumber";
import type { QuestionDef } from "./questionRegistry";
import { parseOptionValues } from "./a3Schema";

export interface PrefillSource {
  fileName: string;
  matchedHeading: string;
}

export interface DecipheredBrief {
  /** Plain text used to seed Context when empty. */
  contextText: string;
  /** Answers keyed by question id. Only populate empty questions. */
  answers: Record<string, string>;
  /** Provenance for each pre-filled answer. */
  sources: Record<string, PrefillSource>;
  /** ALAN candidates found in filenames or extracted text. */
  alanCandidates: Array<{ value: string; sourceFileName: string; method: "file-name" | "pdf-text" | "ocr" }>;
  /** Honest coverage note for the UI. */
  note: string;
  filesRead: number;
  questionsFilled: number;
}

interface TextSection {
  heading: string;
  body: string;
}

interface ExtractedDoc {
  fileName: string;
  text: string;
  sections: TextSection[];
  note?: string;
}

const HEADING_MAP: Array<{ questionId: string; patterns: RegExp[] }> = [
  {
    questionId: "q-background",
    patterns: [
      /what are you trying to accomplish/i,
      /business challenge/i,
      /business need/i,
      /current situation/i,
      /hypothesis or opportunity/i,
      /^background\b/i,
      /background and business/i,
    ],
  },
  {
    questionId: "q-summary",
    patterns: [
      /project summary/i,
      /^summary\b/i,
      /^overview\b/i,
      /^subject\b/i,
      /project name/i,
      /project-specific context/i,
    ],
  },
  {
    questionId: "q-deliverables",
    patterns: [
      /^deliverables?\b/i,
      /^assets?\b/i,
      /what do you need produced/i,
      /impacted customer touchpoints/i,
      /^channels?\b/i,
    ],
  },
  {
    questionId: "q-goals",
    patterns: [
      /objective and goals/i,
      /primary objective/i,
      /business goals/i,
      /marketing and communications goals/i,
      /goals and expectations/i,
      /^goals?\b/i,
    ],
  },
  {
    questionId: "q-success",
    patterns: [
      /measurement framework/i,
      /success measurement/i,
      /goals and kpis/i,
      /metric of success/i,
      /testing and analysis/i,
      /how will you measure/i,
    ],
  },
  {
    questionId: "q-deadline",
    patterns: [
      /desired (project )?completion date/i,
      /completion date/i,
      /due date/i,
      /launch date/i,
      /when do you need/i,
    ],
  },
  {
    questionId: "q-timing",
    patterns: [
      /project timing/i,
      /key milestone dates/i,
      /^seasonality\b/i,
      /^timing\b/i,
      /is the timing tied/i,
    ],
  },
  {
    questionId: "q-anything-else",
    patterns: [
      /target audience/i,
      /messaging strategy/i,
      /^mandatories?\b/i,
      /club\s*\/\s*geography/i,
      /executive sponsor/i,
      /anything else/i,
      /additional (information|details)/i,
    ],
  },
];

function extensionOf(fileName: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(fileName);
  return match ? match[1].toLowerCase() : "";
}

async function inflateRaw(bytes: Uint8Array, format: "deflate-raw" | "deflate"): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("This browser cannot decompress ZIP/PDF streams.");
  }
  const ab = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const stream = new Blob([ab]).stream().pipeThrough(new DecompressionStream(format));
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

function readU16(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}

function readU32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

async function extractDocxXml(buffer: ArrayBuffer): Promise<string | null> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let offset = 0;
  while (offset + 30 <= bytes.length) {
    const signature = readU32(view, offset);
    if (signature !== 0x04034b50) break;
    const compression = readU16(view, offset + 8);
    const compressedSize = readU32(view, offset + 18);
    const nameLength = readU16(view, offset + 26);
    const extraLength = readU16(view, offset + 28);
    const nameStart = offset + 30;
    const nameEnd = nameStart + nameLength;
    if (nameEnd + extraLength + compressedSize > bytes.length) break;
    const name = new TextDecoder("utf-8").decode(bytes.subarray(nameStart, nameEnd));
    const dataStart = nameEnd + extraLength;
    const dataEnd = dataStart + compressedSize;
    const payload = bytes.subarray(dataStart, dataEnd);
    if (name === "word/document.xml") {
      if (compression === 0) {
        return new TextDecoder("utf-8").decode(payload);
      }
      if (compression === 8) {
        const inflated = await inflateRaw(payload, "deflate-raw");
        return new TextDecoder("utf-8").decode(inflated);
      }
      return null;
    }
    offset = dataEnd;
  }
  return null;
}

function xmlParagraphs(xml: string): string[] {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const paragraphs = Array.from(doc.getElementsByTagName("w:p"));
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const texts = Array.from(paragraph.getElementsByTagName("w:t"))
      .map((node) => node.textContent ?? "")
      .join("");
    const cleaned = texts.replace(/\s+/g, " ").trim();
    if (cleaned) lines.push(cleaned);
  }
  return lines;
}

function stripRtf(raw: string): string {
  return raw
    .replace(/\\'[0-9a-fA-F]{2}/g, " ")
    .replace(/\\[a-zA-Z]+\-?\d* ?/g, " ")
    .replace(/[{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodePdfLiteral(raw: string): string {
  return raw
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\")
    .replace(/\\([0-7]{1,3})/g, (_, oct: string) =>
      String.fromCharCode(Number.parseInt(oct, 8)),
    );
}

function extractPdfTextFromContent(content: string): string {
  const chunks: string[] = [];
  const literal = /\((?:\\.|[^\\)])*\)\s*Tj/g;
  const arrayOp = /\[((?:[^\]]|\n)*)\]\s*TJ/g;
  let match: RegExpExecArray | null;
  while ((match = literal.exec(content))) {
    const inner = match[0].slice(1, match[0].lastIndexOf(")"));
    chunks.push(decodePdfLiteral(inner));
  }
  while ((match = arrayOp.exec(content))) {
    const parts = match[1].match(/\((?:\\.|[^\\)])*\)/g) ?? [];
    for (const part of parts) {
      chunks.push(decodePdfLiteral(part.slice(1, -1)));
    }
  }
  return chunks.join(" ").replace(/\s+/g, " ").trim();
}

async function extractPdfText(buffer: ArrayBuffer): Promise<{ text: string; note?: string }> {
  const bytes = new Uint8Array(buffer);
  const asLatin = new TextDecoder("latin1").decode(bytes);
  const streamPattern = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  const pieces: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = streamPattern.exec(asLatin))) {
    const raw = match[1];
    const start = match.index + match[0].indexOf(raw);
    const slice = bytes.subarray(start, start + raw.length);
    let content = "";
    try {
      const inflated = await inflateRaw(slice, "deflate");
      content = new TextDecoder("latin1").decode(inflated);
    } catch {
      content = raw;
    }
    const text = extractPdfTextFromContent(content);
    if (text) pieces.push(text);
  }
  const joined = pieces.join("\n").replace(/\s+/g, " ").trim();
  if (!joined) {
    return {
      text: "",
      note: "No selectable text layer found in this PDF. Scanned image PDFs are not deciphered yet.",
    };
  }
  return { text: joined };
}

function looksLikeHeading(line: string): boolean {
  if (line.length > 90) return false;
  if (/[:：]\s*$/.test(line)) return true;
  if (/^[A-Z0-9][A-Z0-9\s/&-]{2,60}$/.test(line)) return true;
  if (/^(#{1,3}\s+)/.test(line)) return true;
  return HEADING_MAP.some((entry) => entry.patterns.some((pattern) => pattern.test(line)));
}

function splitSections(text: string): TextSection[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^#+\s*/, "").trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const sections: TextSection[] = [];
  let heading = "Opening";
  let body: string[] = [];

  const flush = () => {
    const joined = body.join("\n").trim();
    if (joined) sections.push({ heading, body: joined });
    body = [];
  };

  for (const line of lines) {
    if (looksLikeHeading(line) && body.length > 0) {
      flush();
      heading = line.replace(/[:：]\s*$/, "").trim();
      continue;
    }
    if (looksLikeHeading(line) && body.length === 0) {
      heading = line.replace(/[:：]\s*$/, "").trim();
      continue;
    }
    body.push(line);
  }
  flush();
  return sections;
}

function normalizeDate(raw: string): string | null {
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const us = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/.exec(raw);
  if (us) {
    const month = us[1].padStart(2, "0");
    const day = us[2].padStart(2, "0");
    let year = us[3];
    if (year.length === 2) year = `20${year}`;
    return `${year}-${month}-${day}`;
  }
  const months =
    /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})/i.exec(
      raw,
    );
  if (months) {
    const index = [
      "january",
      "february",
      "march",
      "april",
      "may",
      "june",
      "july",
      "august",
      "september",
      "october",
      "november",
      "december",
    ].indexOf(months[1].toLowerCase());
    if (index >= 0) {
      return `${months[3]}-${String(index + 1).padStart(2, "0")}-${months[2].padStart(2, "0")}`;
    }
  }
  return null;
}

function detectCommType(text: string, options: readonly string[] | undefined): string | null {
  if (!options?.length) return null;
  const found: string[] = [];
  if (/corporate communications/i.test(text)) {
    const option = options.find((item) => /corporate communications/i.test(item));
    if (option) found.push(option);
  }
  if (/brand (and )?creative services/i.test(text) || /brand creative services/i.test(text)) {
    const option = options.find((item) => /brand creative services/i.test(item));
    if (option) found.push(option);
  }
  if (found.length === 0) return null;
  return parseOptionValues(found.join(", "), options).join(", ");
}

function findAlanInText(text: string, fileName: string): DecipheredBrief["alanCandidates"] {
  const out: DecipheredBrief["alanCandidates"] = [];
  const fromName = fileName.match(ALAN_SEARCH_PATTERN);
  if (fromName) {
    for (const value of fromName) {
      out.push({ value: value.toUpperCase(), sourceFileName: fileName, method: "file-name" });
    }
  }
  const fromText = text.match(ALAN_SEARCH_PATTERN);
  if (fromText) {
    for (const value of fromText) {
      out.push({ value: value.toUpperCase(), sourceFileName: fileName, method: "pdf-text" });
    }
  }
  const seen = new Set<string>();
  return out.filter((item) => {
    if (seen.has(item.value)) return false;
    seen.add(item.value);
    return true;
  });
}

async function extractFromFile(file: File): Promise<ExtractedDoc> {
  const ext = extensionOf(file.name);
  if (ext === "docx") {
    const xml = await extractDocxXml(await file.arrayBuffer());
    if (!xml) {
      return {
        fileName: file.name,
        text: "",
        sections: [],
        note: `Could not read ${file.name} as a Word document.`,
      };
    }
    const lines = xmlParagraphs(xml);
    const text = lines.join("\n");
    return { fileName: file.name, text, sections: splitSections(text) };
  }

  if (ext === "pdf") {
    const { text, note } = await extractPdfText(await file.arrayBuffer());
    return {
      fileName: file.name,
      text,
      sections: splitSections(text.replace(/ (?=[A-Z][a-z])/g, "\n")),
      note,
    };
  }

  if (ext === "txt" || ext === "md" || ext === "markdown") {
    const text = await file.text();
    return { fileName: file.name, text, sections: splitSections(text) };
  }

  if (ext === "rtf") {
    const text = stripRtf(await file.text());
    return { fileName: file.name, text, sections: splitSections(text) };
  }

  return {
    fileName: file.name,
    text: "",
    sections: [],
    note: `${file.name} is not a supported brief format (.docx, .pdf, .txt, .md, .rtf).`,
  };
}

function matchQuestion(
  question: QuestionDef,
  sections: TextSection[],
  fullText: string,
): { value: string; matchedHeading: string } | null {
  if (question.id === "q-comm-type") {
    const value = detectCommType(fullText, question.options);
    return value ? { value, matchedHeading: "Communication type mentions" } : null;
  }

  for (const map of HEADING_MAP) {
    if (map.questionId !== question.id) continue;
    for (const section of sections) {
      if (map.patterns.some((pattern) => pattern.test(section.heading))) {
        if (question.inputType === "date") {
          const date = normalizeDate(section.body);
          if (date) return { value: date, matchedHeading: section.heading };
          continue;
        }
        return { value: section.body.trim(), matchedHeading: section.heading };
      }
    }
  }

  if (question.id === "q-summary") {
    const opening = sections.find((section) => section.heading === "Opening") ?? sections[0];
    if (opening?.body) {
      const first = opening.body.split(/\n+/).find((line) => line.trim().length > 40);
      if (first) return { value: first.trim(), matchedHeading: opening.heading };
    }
  }

  if (question.id === "q-deadline") {
    const date = normalizeDate(fullText);
    if (date) return { value: date, matchedHeading: "Date found in document" };
  }

  return null;
}

/**
 * Decipher uploaded brief files and propose answers for empty guided questions.
 */
export async function decipherBriefFiles(
  files: File[],
  questions: QuestionDef[],
): Promise<DecipheredBrief> {
  const readable = files.filter((file) =>
    ["docx", "pdf", "txt", "md", "markdown", "rtf"].includes(extensionOf(file.name)),
  );

  if (readable.length === 0) {
    return {
      contextText: "",
      answers: {},
      sources: {},
      alanCandidates: [],
      note: "No supported brief files to decipher (.docx, .pdf, .txt, .md, .rtf).",
      filesRead: 0,
      questionsFilled: 0,
    };
  }

  const docs: ExtractedDoc[] = [];
  const notes: string[] = [];
  for (const file of readable) {
    try {
      const doc = await extractFromFile(file);
      docs.push(doc);
      if (doc.note) notes.push(doc.note);
    } catch (error) {
      notes.push(
        `Could not decipher ${file.name}: ${
          error instanceof Error ? error.message : "unknown error"
        }.`,
      );
    }
  }

  const answers: Record<string, string> = {};
  const sources: Record<string, PrefillSource> = {};
  const alanCandidates: DecipheredBrief["alanCandidates"] = [];

  for (const doc of docs) {
    alanCandidates.push(...findAlanInText(doc.text, doc.fileName));
    for (const question of questions) {
      if (!question.enabled) continue;
      if (answers[question.id]?.trim()) continue;
      const match = matchQuestion(question, doc.sections, doc.text);
      if (!match?.value.trim()) continue;
      answers[question.id] = match.value.trim();
      sources[question.id] = {
        fileName: doc.fileName,
        matchedHeading: match.matchedHeading,
      };
    }
  }

  const contextText =
    docs
      .map((doc) => doc.text.trim())
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 4000) || "";

  const questionsFilled = Object.keys(answers).length;
  const primary = docs[0]?.fileName ?? "uploaded file";
  const summary =
    questionsFilled > 0
      ? `Deciphered \`${primary}\`${docs.length > 1 ? ` and ${docs.length - 1} more` : ""}: pre-filled ${questionsFilled} of ${questions.filter((q) => q.enabled).length} guided questions. Review and edit each answer on the next steps.`
      : `Read ${docs.length} file${docs.length === 1 ? "" : "s"} but could not map sections to guided questions. Enter answers manually.`;

  return {
    contextText,
    answers,
    sources,
    alanCandidates,
    note: [summary, ...notes].filter(Boolean).join(" "),
    filesRead: docs.length,
    questionsFilled,
  };
}
