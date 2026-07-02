export function getProvider(name: string) {
  return (process.env[name] ?? "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .toLowerCase();
}
