// Hook PreToolUse del subagente planner: solo permite escribir dentro de specs/.
// Claude Code pasa la llamada a la herramienta en JSON por stdin.
// Salida con código 2 = bloquear y devolver el motivo al agente.
import path from "node:path";

let raw = "";
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  let filePath = "";
  try {
    const data = JSON.parse(raw);
    filePath = data?.tool_input?.file_path || data?.tool_input?.path || "";
  } catch {
    process.stderr.write("solo-specs: no se pudo leer la llamada; bloqueada por seguridad.\n");
    process.exit(2);
  }
  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const rel = path.relative(path.resolve(root), path.resolve(root, filePath)).split(path.sep).join("/");
  if (rel.startsWith("specs/") && !rel.includes("..")) process.exit(0);
  process.stderr.write(
    `El planner solo puede escribir dentro de specs/. Intento bloqueado: ${rel || filePath}\n`
  );
  process.exit(2);
});
