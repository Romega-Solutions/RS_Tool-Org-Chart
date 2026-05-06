export const APP_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "/org-chart";

function normalizeBasePath(basePath: string) {
  if (!basePath || basePath === "/") return "";
  return `/${basePath.replace(/^\/+|\/+$/g, "")}`;
}

const normalizedBasePath = normalizeBasePath(APP_BASE_PATH);

export function appPath(path: string) {
  if (!path) return normalizedBasePath || "/";
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith("//")) return path;

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (!normalizedBasePath || normalizedPath === normalizedBasePath || normalizedPath.startsWith(`${normalizedBasePath}/`)) {
    return normalizedPath;
  }

  return `${normalizedBasePath}${normalizedPath}`;
}

export function routerPath(path: string) {
  if (!path) return "/";
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith("//")) return path;

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (!normalizedBasePath) return normalizedPath;
  if (normalizedPath === normalizedBasePath) return "/";
  if (normalizedPath.startsWith(`${normalizedBasePath}/`)) {
    return normalizedPath.slice(normalizedBasePath.length) || "/";
  }

  return normalizedPath;
}

export function apiPath(path: string) {
  return appPath(path);
}

export function assetPath(path: string | null | undefined) {
  if (!path) return path ?? "";
  return appPath(path);
}
