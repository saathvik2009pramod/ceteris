export function download(data: Blob, name: string) {
  const url = URL.createObjectURL(data),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function svgText(el: SVGSVGElement, transparent: boolean) {
  const copy = el.cloneNode(true) as SVGSVGElement;
  copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  copy.setAttribute("width", "900");
  copy.setAttribute("height", "720");
  copy.querySelectorAll("[data-editor]").forEach((x) => x.remove());
  if (transparent) copy.querySelector("[data-background]")?.remove();
  return new XMLSerializer().serializeToString(copy);
}
export async function exportDiagram(
  el: SVGSVGElement,
  format: string,
  scale: number,
  transparent: boolean,
) {
  const svg = svgText(el, transparent),
    blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  if (format === "svg") {
    download(blob, "economics-diagram.svg");
    return;
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () =>
        reject(Error("Could not render the image. Try SVG export."));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = 900 * scale;
    canvas.height = 720 * scale;
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const png = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(Error("PNG export failed."))),
        "image/png",
      ),
    );
    download(png, "economics-diagram.png");
  } finally {
    URL.revokeObjectURL(url);
  }
}
