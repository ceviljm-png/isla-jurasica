---
description: SDD · Valida la spec RF por RF (tests + Chrome DevTools)
argument-hint: "<NNN-nombre>"
---
Recorre specs/$0/spec.md requisito por requisito. Para cada RF indica qué test
lo cubre y el resultado de ejecutarlo con el comando de tests de AGENTS.md.

Los RF de interfaz que no se puedan testear así, verifícalos con
el MCP de Chrome DevTools (incluida la vista móvil de 375 px).

Si algún RF no está cubierto o falla, dilo claramente. NO arregles nada todavía.
Después comprueba los criterios de finalización y dame un veredicto:
¿la spec está cumplida? Si lo está, cambia el estado de la spec a "implementada" y actualiza MEMORY.md.
