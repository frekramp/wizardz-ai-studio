import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

// Single-threaded core → no SharedArrayBuffer / COOP-COEP needed (keeps the art-wall working).
const CORE = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";

let ff: FFmpeg | null = null;
let loaded: Promise<boolean> | null = null;

async function getFF(): Promise<FFmpeg> {
  if (!ff) ff = new FFmpeg();
  if (!loaded) {
    loaded = ff.load({
      coreURL: await toBlobURL(`${CORE}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${CORE}/ffmpeg-core.wasm`, "application/wasm"),
    });
  }
  await loaded;
  return ff;
}

/** Convert a fal video URL into a looping GIF (via same-origin proxy + ffmpeg.wasm). */
export async function videoToGif(videoUrl: string, width = 512, fps = 15): Promise<Blob> {
  const f = await getFF();
  const src = `/api/proxy?url=${encodeURIComponent(videoUrl)}`;
  await f.writeFile("in.mp4", await fetchFile(src));
  // two-pass palette for clean GIF colors
  await f.exec([
    "-i", "in.mp4",
    "-vf", `fps=${fps},scale=${width}:-1:flags=lanczos,palettegen`,
    "pal.png",
  ]);
  await f.exec([
    "-i", "in.mp4",
    "-i", "pal.png",
    "-lavfi", `fps=${fps},scale=${width}:-1:flags=lanczos[x];[x][1:v]paletteuse`,
    "out.gif",
  ]);
  const data = (await f.readFile("out.gif")) as Uint8Array;
  return new Blob([data as unknown as BlobPart], { type: "image/gif" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
