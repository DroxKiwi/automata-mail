declare module "libmime" {
  interface Libmime {
    decodeWords(str: string): string;
  }
  const libmime: Libmime;
  export default libmime;
}
