import "server-only";
import { createReadStream } from "node:fs";
import type { Readable } from "node:stream";
import { DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const globalForS3 = globalThis as unknown as { s3?: S3Client };

function client() {
  globalForS3.s3 ??= new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? "auto",
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    // Neuere SDK-Versionen senden standardmäßig zusätzliche Prüfsummen-Header, die nicht jeder
    // S3-kompatible Anbieter versteht. Nur senden, wenn eine Operation sie verlangt.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });
  return globalForS3.s3;
}

const bucket = () => process.env.S3_BUCKET!;

export async function putObject(key: string, body: Buffer | Readable, contentType: string) {
  await new Upload({
    client: client(),
    params: { Bucket: bucket(), Key: key, Body: body, ContentType: contentType },
  }).done();
}

export function putFile(key: string, path: string, contentType: string) {
  return putObject(key, createReadStream(path), contentType);
}

export async function getObjectStream(key: string) {
  const res = await client().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  if (!res.Body) throw new Error(`Objekt ${key} ist leer`);
  return res.Body as Readable;
}

export function presignDownload(key: string, contentType: string, expiresInSeconds = 300) {
  return getSignedUrl(
    client(),
    new GetObjectCommand({ Bucket: bucket(), Key: key, ResponseContentType: contentType }),
    { expiresIn: expiresInSeconds },
  );
}

export async function deleteObjects(keys: string[]) {
  if (keys.length === 0) return;
  await client().send(
    new DeleteObjectsCommand({
      Bucket: bucket(),
      Delete: { Objects: keys.map((Key) => ({ Key })) },
    }),
  );
}

/** Löscht alle Objekte unter einem Präfix, z. B. alle Aufnahmen einer Person. Gibt die Anzahl zurück. */
export async function deleteByPrefix(prefix: string) {
  let deleted = 0;
  let token: string | undefined;
  do {
    const page = await client().send(
      new ListObjectsV2Command({ Bucket: bucket(), Prefix: prefix, ContinuationToken: token }),
    );
    const keys = (page.Contents ?? []).flatMap((object) => (object.Key ? [object.Key] : []));
    await deleteObjects(keys);
    deleted += keys.length;
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return deleted;
}
