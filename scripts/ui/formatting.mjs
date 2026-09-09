export function titleCase(value) {
  return String(value ?? "")
    .replaceAll("-", " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/(^|\s)\S/g, letter => letter.toUpperCase());
}
