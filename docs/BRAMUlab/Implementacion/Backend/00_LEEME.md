# Implementación — Backend BRAMUlab

Esta carpeta es el espacio operativo compartido entre Sebastián, ChatGPT y Claude Code para las rondas de implementación de Backend.

## Objetivo

Evitar copiar/pegar prompts e informes largos entre chats y reducir errores de traspaso.

La documentación maestra de producto/arquitectura sigue viviendo en los archivos principales de `docs/BRAMUlab/`. Esta carpeta NO reemplaza esas fuentes: conserva el historial operativo de cada bloque.

## Estructura

Cada bloque usa su propia carpeta:

- `Bloque_01/`
- `Bloque_02/`
- `Bloque_03/`
- etc.

Convención recomendada dentro de cada bloque:

1. `01_Pedido.md` — instrucción inicial preparada por ChatGPT.
2. `02_Plan_Claude.md` — análisis/plan que Claude deja antes de implementar cuando corresponda.
3. `03_Revision_ChatGPT.md` — revisión, correcciones y autorización de ChatGPT.
4. `04_Informe_Implementacion_Claude.md` — informe final de Claude tras implementar.
5. `05_Cierre_ChatGPT.md` — revisión/cierre final si hace falta.

No todos los bloques necesitan necesariamente los cinco archivos.

## Flujo de trabajo

1. ChatGPT prepara el archivo correspondiente dentro de esta carpeta.
2. Sebastián le envía a Claude solamente una instrucción corta para actualizar `staging` y leer ese archivo.
3. Claude trabaja sobre el repo y deja su plan/informe en la carpeta del bloque además de responder en el chat.
4. Sebastián avisa a ChatGPT que Claude terminó.
5. ChatGPT lee directamente el archivo desde Dropbox/GitHub y prepara la siguiente instrucción en esta misma estructura.

## Criterio de eficiencia

El objetivo no es obligar a Claude a releer documentación innecesaria. Cada handoff debe ser autocontenido, breve cuando sea posible y apuntar por nombre a las fuentes maestras relevantes.

Mover tareas de dashboard, deploy, verificación web o documentación a ChatGPT/Work cuando no requieren edición profunda de código ayuda a reservar Claude Code para implementación, migraciones, tests y debugging de repo.

## Regla

No usar esta carpeta para redefinir producto silenciosamente. Si una decisión cambia una fuente maestra, la implementación debe actualizar también el documento maestro correspondiente.
