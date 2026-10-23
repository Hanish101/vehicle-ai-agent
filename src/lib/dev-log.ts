/** Console-only diagnostics. Never surface these strings in the UI. */
export function logDev(message: string, detail?: unknown) {
  const prefix = "[dev build]";
  if (detail !== undefined) {
    console.warn(prefix, message, detail);
  } else {
    console.warn(prefix, message);
  }
}
