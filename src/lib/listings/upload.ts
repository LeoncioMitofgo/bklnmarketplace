// Subida a una URL firmada de Supabase Storage con progreso real (fetch no lo da; XMLHttpRequest sí).
// Mismo formato que storage-js uploadToSignedUrl con cuerpo binario.

export function uploadWithProgress(
  signedUrl: string,
  blob: Blob,
  onProgress: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.timeout = 120_000;
    xhr.setRequestHeader("content-type", blob.type);
    xhr.setRequestHeader("cache-control", "max-age=31536000");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`upload_status_${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("network"));
    xhr.ontimeout = () => reject(new Error("timeout"));
    xhr.send(blob);
  });
}
