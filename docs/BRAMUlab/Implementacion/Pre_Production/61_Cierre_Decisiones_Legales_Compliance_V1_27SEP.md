# BRAMUlab — Cierre Central de decisiones legales/compliance V1

**Fecha:** 27/09/2026  
**Rama:** `staging`  
**Ámbito:** P0.2 — Términos / Privacidad / datos personales  
**Resultado:** decisiones de producto cerradas; implementación legal UI todavía pendiente.

## 1. Criterio general

BRAMUlab no exige una “firma” o aprobación de abogado para publicar sus Términos o Política de Privacidad. La revisión jurídica externa queda recomendada como reducción de riesgo, no como dependencia automática de V1.

La base de cumplimiento usada para esta ronda es normativa/fuentes oficiales argentinas vigentes:
- Ley 25.326 y Decreto 1558/2001;
- Resolución AAIP 4/2019 sobre criterios de consentimiento y menores;
- Código Civil y Comercial, autonomía progresiva;
- AAIP — Registro Nacional de Bases de Datos Personales;
- AAIP — transferencias internacionales;
- Ley 24.240 de Defensa del Consumidor.

Si aparece una cuestión concreta no resoluble con seguridad razonable desde estas fuentes, puede escalarse una consulta puntual profesional sin convertir toda la salida en dependiente de un estudio jurídico.

## 2. Responsable

DECISIÓN CERRADA:
- BRAMUlab es operado por una persona humana, único titular del proyecto;
- no se inventa sociedad ni cargo;
- denominación funcional: **titular y responsable de BRAMUlab**.

DATOS A COMPLETAR antes de publicar:
- nombre legal completo;
- domicilio a efectos de privacidad;
- CUIT/CUIL cuando corresponda;
- email público de privacidad/soporte.

## 3. Edad mínima

DECISIÓN CERRADA:
- mínimo V1: **13 años**;
- no 18+;
- menores de 13 no pueden crear deliberadamente una cuenta.

Fundamento:
- la normativa vigente usa autonomía progresiva, no un umbral digital fijo;
- el Código Civil y Comercial define adolescente desde los 13 años;
- la referencia de 13 años del proyecto de actualización de datos personales es coherente como criterio de producto, pero NO se presenta como ley vigente.

V1:
- declaración explícita 13+;
- información clara y accesible;
- intervención del responsable parental/tutor cuando corresponda por capacidad/madurez;
- no crear un sistema pesado de verificación parental sin una necesidad jurídica concreta demostrada.

## 4. Ley / jurisdicción

DECISIÓN CERRADA:
- leyes de la República Argentina;
- no imponer un fuero exclusivo que reduzca derechos de consumidor;
- autoridad/tribunal competente según normativa aplicable.

## 5. Conservación

DECISIÓN CERRADA:
- criterio por finalidad y necesidad, no números inventados;
- cuenta/perfil mientras cuenta activa;
- eliminación/anominización según P0.3;
- partidos compartidos permanecen anonimizados para preservar historia de terceros;
- logs/eventos solo mientras sean necesarios para seguridad/operación.

BLOQUE 9:
- verificar que no exista retención técnica indefinida accidental.

## 6. Registro AAIP

DECISIÓN OPERATIVA:
- tratar la inscripción del responsable/base aplicable como acción previa a Production;
- trámite online y gratuito vía TAD;
- no requiere sociedad ni abogado;
- requiere intervención de Sebastián por identidad/Clave Fiscal/CUIT-CUIL.

## 7. Transferencias internacionales

DECISIÓN CERRADA DE REDACCIÓN:
- no inventar regiones;
- confirmar Supabase/Vercel/SMTP reales en Production;
- declarar el procesamiento internacional cuando exista;
- aplicar los mecanismos de la Ley 25.326/AAIP cuando el destino no sea adecuado (incluidas cláusulas contractuales modelo cuando corresponda).

## 8. Propiedad intelectual / responsabilidad

DECISIÓN CERRADA:
- BRAMU conserva derechos sobre software/diseño/marca propios;
- usuario conserva derechos sobre su contenido;
- usuario otorga licencia limitada a operar las funciones elegidas;
- Nivel/Ranking/Intelligence no son certificaciones ni asesoramiento profesional;
- no redactar renuncias absolutas de responsabilidad;
- preservar expresamente derechos irrenunciables de consumo.

## 9. BRAMUlive

No hace falta definir infraestructura/cuentas legales compartidas para publicar BRAMUlab.
Los documentos V1 de BRAMUlab cubren BRAMUlab y aclaran únicamente que BRAMUlive es un producto separado y fuera de su alcance.

## 10. Qué sigue bloqueando P0.2

No quedan ocho decisiones jurídicas abiertas.

Quedan tareas concretas:
1. completar datos identificatorios/contacto;
2. registrar responsable/base ante AAIP cuando corresponda;
3. confirmar regiones/proveedores reales de Production;
4. integrar Términos/Privacidad en frontend;
5. agregar declaración 13+ y copy de menores;
6. re-aceptación por versión;
7. reemplazar `piloto_v1` por la versión legal real al final;
8. QA del flujo.

No tocar frontend en esta ronda documental mientras h21 está siendo implementado por Claude.
