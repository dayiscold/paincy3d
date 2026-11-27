import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

// Keep electron-builder's install/upgrade logic. Generate the unsigned
// uninstaller during installation so packaging never runs a temporary EXE.
const require = createRequire(import.meta.url);
const templates = join(dirname(require.resolve("app-builder-lib/package.json")), "templates/nsis");
const read = (name) => readFile(join(templates, name), "utf8");
function replace(source, token, replacement) {
  if (!source.includes(token)) throw new Error("Изменился шаблон NSIS: " + token);
  return source.replace(token, () => replacement);
}
const installFiles = replace(await read("include/installer.nsh"),
  'File "/oname=${UNINSTALL_FILENAME}" "${UNINSTALLER_OUT_FILE}"',
  'WriteUninstaller "$INSTDIR\\${UNINSTALL_FILENAME}"');
const section = replace(await read("installSection.nsh"), "!include installer.nsh", installFiles);
let script = replace(await read("installer.nsi"), '!include "installSection.nsh"', section);
script = replace(script, "!insertmacro addLangs", "!insertmacro MUI_UNPAGE_INSTFILES\n!insertmacro addLangs");
// Both halves now share one NSIS symbol table and process-check variables.
const checks = await read("include/allowOnlyOneInstallerInstance.nsh");
const declarations = /^\s*Var \/GLOBAL (\w+).*$/gm;
const globals = Array.from(checks.matchAll(declarations), ([, name]) => "Var " + name);
script = replace(script, '!include "allowOnlyOneInstallerInstance.nsh"',
  globals.join("\n") + "\n" + checks.replace(declarations, ""));
await writeFile(new URL("../dist-electron/installer.nsi", import.meta.url),
  script + '\n!define BUILD_UNINSTALLER\nFunction un._GetProcessInfo\n' +
  '  !insertmacro FUNC_GETPROCESSINFO\nFunctionEnd\n!include "uninstaller.nsh"\n');
