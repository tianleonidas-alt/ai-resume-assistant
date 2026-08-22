/**
 * Browser-side PDF text extraction using pdfjs-dist. Only selectable-text PDFs
 * are supported; returns the concatenated page text or throws on empty output.
 */
export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
  const document = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = await Promise.all(Array.from({ length: document.numPages }, async (_, index) => {
    const page = await document.getPage(index + 1);
    const content = await page.getTextContent();
    return content.items.map((item) => "str" in item ? item.str : "").join(" ");
  }));
  const text = pages.join("\n").replace(/\s{2,}/g, " ").trim();
  if (text.length < 30) throw new Error("这份 PDF 未能提取到文字。请使用可选中文本版简历后重试。");
  return text;
}
