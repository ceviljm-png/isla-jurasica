---
description: SDD · Adopta un proyecto YA EXISTENTE - documenta lo que hay sin tocar el código
argument-hint: "[áreas a priorizar]"
---
Este proyecto ya existe y no se desarrolló con SDD. Vamos a ponerlo en orden SIN
cambiar su comportamiento. Usa la skill sdd. NO modifiques ningún archivo de código.
Contexto o áreas a priorizar (opcional): $ARGUMENTS

Haz las fases EN ORDEN y para al final de cada una hasta que yo la apruebe:

## Fase A — Inventario (solo lectura)
Lee todo el proyecto y dame un resumen corto:
- Qué hace la aplicación, en 3-5 líneas.
- Stack, cómo se arranca y si hay tests (y con qué comando).
- Áreas funcionales que detectas (por ejemplo: login, pedidos, informes…), con los archivos de cada una.
- Riesgos: código muerto, duplicados, secretos o claves en el código, partes sin tests, cosas que parecen bugs.
No arregles nada: solo lo cuentas.

## Fase B — AGENTS.md, MEMORY.md y constitución
Con mi aprobación del inventario:
- Completa la "Descripción" y los "Comandos" de AGENTS.md (si el comando de tests real es otro, corrígelo).
- Rellena MEMORY.md con el estado real: áreas, decisiones que se deducen del código y deuda técnica.
- Propón docs/constitution.md (6 principios, máx. 15 líneas) que describan cómo ESTÁ hecho
  el proyecto y cómo queremos que siga, no un ideal que obligue a reescribirlo.
Espera mi aprobación antes de escribir la constitución.

## Fase C — Specs de lo que ya existe (ingeniería inversa)
- Crea una spec por área funcional, empezando por la numeración 000: `specs/000-<area>/spec.md`,
  `specs/001-<area>/spec.md`…, con la plantilla de la skill sdd y "Estado: implementada".
- Los requisitos describen el comportamiento ACTUAL en EARS, comprobado leyendo el código.
  No inventes requisitos que el código no cumple.
- Si algo parece un bug o no está claro si es intencionado, NO lo conviertas en requisito:
  ponlo en "Dudas abiertas" como [NECESITA ACLARACIÓN] e indica archivo:línea.
- Si un área es muy grande (más de 10 RF), divídela.
- Empieza por las áreas más importantes o con más riesgo; no hace falta cubrirlo todo de golpe.
Al terminar cada spec, enséñamela y espera mi aprobación antes de pasar a la siguiente.

## Fase D — Red de seguridad
Para cada spec aprobada, propón (sin escribirlos) los tests de caracterización mínimos
que fijarían el comportamiento actual de los RF más críticos, para poder cambiar código
después sin romper nada. Se implementarán con /sdd-plan, /sdd-tasks y /sdd-implement
sobre esa misma spec, y esas tareas SOLO añaden tests: no cambian el comportamiento.

Al final, actualiza MEMORY.md con qué specs existen, su estado y el siguiente paso.
A partir de aquí, todo cambio va por /sdd-change (sobre una spec existente) o por una spec nueva.
