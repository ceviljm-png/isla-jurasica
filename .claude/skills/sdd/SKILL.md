---
name: sdd
description: Úsala siempre que trabajes con Spec-Driven Development en este proyecto (docs/constitution.md o cualquier archivo dentro de specs/) - redactar, revisar o cambiar specs, planes y tareas, o implementar y validar tareas de una spec.
---

# Spec-Driven Development (SDD)

Modelo: **spec-anchored**. La spec se mantiene viva y se actualiza para guiar la evolución del código.

## Flujo
Constitución → Spec → Clarificación → Plan → Tareas → Implementación → Validación → Cambio (vuelta a Spec).

- Nunca pases a la siguiente fase sin la aprobación explícita del usuario.
- La spec manda: si algo no está en la spec, no se implementa. Si falta una decisión, para y pregunta.
- Un cambio de requisitos se hace primero en la spec, luego en el plan y las tareas, y por último en el código.
- Cada spec vive en su carpeta: `specs/NNN-nombre/` con `spec.md`, `plan.md` y `tasks.md` (NNN = siguiente número libre, con tres cifras).
- Si `docs/constitution.md` está PENDIENTE, el primer paso es `/sdd-constitution`.
- El comando de tests es el que figura en `AGENTS.md` (sección Comandos).
- Al terminar cada fase, actualiza `MEMORY.md`.
- La clarificación puede repetirse después del plan o de las tareas si algo no está claro.

## Plantilla de spec (spec.md)
```
# Spec NNN — <Nombre>

Estado: borrador | aprobada | implementada

## Contexto y objetivo
## Usuarios
## Historias de usuario
- HU-1. Como <rol>, quiero <acción> para <beneficio>.
## Definiciones (solo si hay términos que puedan interpretarse de varias formas)
## Requisitos funcionales
## Requisitos no funcionales
## Casos límite
## Fuera de alcance
## Criterios de finalización
## Dudas abiertas
- [NECESITA ACLARACIÓN] <duda>
```
La spec describe el QUÉ y el POR QUÉ. Nada de stack, arquitectura ni nombres de archivos.

## Requisitos en EARS (en español)
- RF-x: CUANDO <evento>, EL SISTEMA <respuesta>.
- RF-x: SI <condición no deseada>, ENTONCES EL SISTEMA <respuesta>.
- RF-x: MIENTRAS <estado>, EL SISTEMA <respuesta>.
- RF-x: EL SISTEMA <comportamiento permanente>.

Una frase = un comportamiento. Cada RF debe ser verificable: nada de "rápido", "intenso" o "bonito" sin un criterio medible.

## Plan (plan.md)
Archivos y responsabilidades · Funciones puras de lógica (con "hoy"/dependencias como parámetro) · Algoritmo en pseudocódigo · Interfaz · Decisiones justificadas con su alternativa descartada · Estrategia de tests con el comando de tests del proyecto. Indica qué RF cubre cada parte.

## Tareas (tasks.md)
```
- [ ] **Tn. <Descripción>.** RF-x, RF-y
  - Hecho cuando: <comprobación verificable>.
```
Máximo 20-30 min por tarea, en orden de dependencia. Si salen más de 10, propón dividir la spec.

## Implementación
Una sola tarea cada vez: tests primero (en rojo), después el código, tests en verde, marcar la tarea y parar.

## Validación
Recorre la spec RF por RF: qué test lo cubre y su resultado. Los RF de interfaz se verifican con el MCP de Chrome DevTools (incluida la vista móvil de 375 px). Termina con un veredicto: ¿la spec está cumplida?
