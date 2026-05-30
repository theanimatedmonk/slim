export interface SvgMetadata {
  viewBox: string | null;
  width: string | null;
  height: string | null;
}

export function extractSvgMetadata(svg: string): SvgMetadata {
  const viewBoxMatch = svg.match(/viewBox\s*=\s*["']([^"']+)["']/i);
  const widthMatch = svg.match(/\bwidth\s*=\s*["']([^"']+)["']/i);
  const heightMatch = svg.match(/\bheight\s*=\s*["']([^"']+)["']/i);

  return {
    viewBox: viewBoxMatch?.[1] ?? null,
    width: widthMatch?.[1] ?? null,
    height: heightMatch?.[1] ?? null,
  };
}

export function isValidSvgXml(svg: string): boolean {
  if (!svg.trim().startsWith('<')) return false;
  if (!/<svg[\s>]/i.test(svg)) return false;
  try {
    const hasClose = /<\/svg\s*>/i.test(svg);
    return hasClose;
  } catch {
    return false;
  }
}

export function validateSvgPass(
  current: string,
  previous: string | null
): boolean {
  if (!isValidSvgXml(current)) return false;

  if (!previous) return true;

  const currentMeta = extractSvgMetadata(current);
  const previousMeta = extractSvgMetadata(previous);

  if (previousMeta.viewBox && !currentMeta.viewBox) return false;
  if (previousMeta.width && !currentMeta.width) return false;
  if (previousMeta.height && !currentMeta.height) return false;

  return true;
}
