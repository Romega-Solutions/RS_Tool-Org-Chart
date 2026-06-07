const EMAIL_SIGNATURE_PUBLIC_URL =
  process.env.EMAIL_SIGNATURE_PUBLIC_URL ?? "https://rs-tool-email-signature.vercel.app";

export function buildEmailSignatureUrl(path = "", search = "") {
  const target = new URL(EMAIL_SIGNATURE_PUBLIC_URL);
  const cleanBasePath = target.pathname.replace(/\/$/, "");
  const cleanPath = path.replace(/^\//, "");

  target.pathname = cleanPath ? `${cleanBasePath}/${cleanPath}` : cleanBasePath || "/";
  target.search = search;
  return target;
}
