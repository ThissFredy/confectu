const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export async function hasValidImageSignature(blob: Blob): Promise<boolean> {
  const header = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  return isPng(header) || isJpeg(header) || isWebp(header);
}

function isPng(header: Uint8Array): boolean {
  return (
    header.length >= 8 &&
    PNG_SIGNATURE.every((byte, index) => header[index] === byte)
  );
}

function isJpeg(header: Uint8Array): boolean {
  return (
    header.length >= 3 &&
    header[0] === 0xff &&
    header[1] === 0xd8 &&
    header[2] === 0xff
  );
}

function isWebp(header: Uint8Array): boolean {
  return (
    header.length >= 12 &&
    header[0] === 0x52 &&
    header[1] === 0x49 &&
    header[2] === 0x46 &&
    header[3] === 0x46 &&
    header[8] === 0x57 &&
    header[9] === 0x45 &&
    header[10] === 0x42 &&
    header[11] === 0x50
  );
}
