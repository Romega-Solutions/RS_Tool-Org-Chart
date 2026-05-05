const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/org-chart";

export function appPath(path: string) {
  if (!basePath) return path;
  return `${basePath}${path.startsWith("/") ? path : `/${path}`}`;
}

export function assetPath(path: string) {
  return appPath(path);
}
