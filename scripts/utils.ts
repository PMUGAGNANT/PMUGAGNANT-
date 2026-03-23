function getFlag(name: string) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

export function readDateArg() {
  return getFlag("date");
}

export function readOptionalNumberArg(name: string) {
  const raw = getFlag(name);
  if (!raw) return null;

  const value = Number.parseInt(raw, 10);
  return Number.isNaN(value) ? null : value;
}

export function printResult(label: string, value: unknown) {
  process.stdout.write(`${label}\n`);
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
