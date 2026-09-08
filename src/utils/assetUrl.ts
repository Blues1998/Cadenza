// The app is served under a base path (/Cadenza/ on GitHub Pages), so an
// asset written as an absolute path from the server root resolves to the
// wrong URL everywhere except a root deployment — /font/Bravura.woff2 is a
// 404 when the app actually lives at /Cadenza/font/Bravura.woff2, and
// alphaTab reports that as "rendering cannot start".
//
// import.meta.env.BASE_URL carries the configured base in both dev and build
// and always ends in a slash, so it is the one safe prefix for anything under
// public/.
export function assetUrl(path: string): string {
  return import.meta.env.BASE_URL + path.replace(/^\/+/, '');
}
