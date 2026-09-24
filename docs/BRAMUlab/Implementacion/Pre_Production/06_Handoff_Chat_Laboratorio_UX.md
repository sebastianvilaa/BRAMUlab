# Handoff — Chat paralelo Laboratorio UX

**Fecha:** 24/09/2026  
**Destino:** ChatGPT — chat nuevo dentro del proyecto BRAMUlab  
**Objetivo:** conversar, observar y decidir UX/producto durante pruebas reales de Staging, sin ejecutar implementación técnica salvo bug crítico autorizado.

## Lectura obligatoria al comenzar

En este orden:

1. `docs/BRAMUlab/README.md`
2. `docs/BRAMUlab/Pre_Production.md`
3. `docs/BRAMUlab/Experiencia_Inicial.md`
4. `docs/BRAMUlab/Implementacion/Pre_Production/05_Laboratorio_UX_Uso_Real.md`

Después consultar únicamente la fuente maestra del sistema afectado.

NO leer Archivo/Backup/handoffs históricos salvo trazabilidad puntual.

## Regla principal

Sebastián no tiene que recordar qué se decidió ni en qué chat.

Antes de preguntarle una decisión:

- buscar si ya está cerrada;
- si está cerrada, explicar qué dice la fuente vigente y comparar la app actual;
- solo preguntar cuando haya una DECISIÓN ABIERTA real.

## Forma de trabajo

Sebastián prueba la app desde celular/computadora y puede mandar screenshots, comentarios o ideas sin lenguaje técnico.

Para cada hallazgo:

1. entender qué estaba haciendo;
2. revisar si la conducta ya está definida;
3. clasificar como:
   - BUG;
   - UX / VISUAL;
   - PRODUCTO;
   - YA DEFINIDO / IMPLEMENTACIÓN INCOMPLETA;
4. recomendar una dirección concreta;
5. cuando Sebastián confirme, persistir la decisión en el documento del laboratorio;
6. NO implementar inmediatamente salvo que el bug bloquee las pruebas o comprometa datos/auth/identidad/seguridad.

## Estado conocido al entrar

- Bloques 1–8: cerrados en Staging.
- Intelligence A–E: cerrada.
- F generativa: fuera del alcance actual.
- Estado Cero / perfiles progresivos: definidos pero implementación incompleta (P0.1).
- Legal/Privacidad: P0 pendiente.
- Production todavía no debe abrirse.
- BRAMUlive: producto separado.
- Login V1: email + contraseña.
- Eliminación V1: cuenta eliminada → participación histórica `Jugador eliminado`; identidad no se recupera; si vuelve crea cuenta nueva desde cero; sin cooldown anti-reset V1.

## Prioridad del laboratorio

No empezar por “diseñar en el aire”.

Preferir:

1. mirar lo que hoy existe;
2. decidir si se deja;
3. si molesta, explicar por qué;
4. definir el cambio visual/producto;
5. documentarlo.

Recorridos prioritarios:

- carga de partido;
- pendiente desde ambos lados;
- Confirmar;
- Proponer corrección;
- No participé;
- Historial;
- Resumen/Modificaciones;
- Mi Perfil;
- Perfil público;
- Ranking cuando aporte;
- Estado Cero solo para registrar gaps conocidos hasta que P0.1 sea implementado.

## Cuentas de prueba

No limpiar todo Staging sin necesidad.

Objetivo operativo próximo:

- dos cuentas reales limpias controladas por Sebastián, una en cada dispositivo;
- conservar otras identidades útiles para compañeros/rivales;
- resetear únicamente esas dos cuentas cuando Sebastián las identifique y autorice explícitamente.

La limpieza debe dejar 0 partidos oficiales/computables, 0 pendientes residuales y Nivel inicial limpio.

## Entrega acumulativa

El chat paralelo debe mantener actualizado:

`docs/BRAMUlab/Implementacion/Pre_Production/05_Laboratorio_UX_Uso_Real.md`

Al final del laboratorio producir un paquete único para implementación con:

- OBLIGATORIO antes de Production;
- CONVENIENTE antes de amigos;
- PULIDO FUTURO;
- NO TOCAR.

No convertir a Sebastián en operador técnico.
