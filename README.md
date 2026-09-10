# Agent Skills

Cinco skills para revisar ideas, definir requisitos y trabajar conversaciones
comerciales con evidencia,
con licencia [MIT](LICENSE). Cada una contiene sus instrucciones completas
en un único `SKILL.md` y puede usarse por separado.

| Skill | Para qué sirve |
| --- | --- |
| [grill-me](skills/grill-me/SKILL.md) | Cuestionar un diseño, comparar alternativas y explorar riesgos antes de implementar. |
| [write-a-prd](skills/write-a-prd/SKILL.md) | Redactar un PRD en Markdown con alcance, requisitos y criterios de aceptación verificables. |
| [sales-coach](skills/sales-coach/SKILL.md) | Practicar conversaciones comerciales por turnos y recibir feedback sobre conductas observadas. |
| [b2b-sales-operating-system](skills/b2b-sales-operating-system/SKILL.md) | Calificar oportunidades, organizar el pipeline y preparar próximos pasos comerciales con evidencia. |
| [b2b-proposal](skills/b2b-proposal/SKILL.md) | Redactar propuestas para compradores con alcance, inversión, condiciones y pendientes explícitos. |

Puedes usar el resumen de `grill-me` como entrada de `write-a-prd`, o empezar
directamente con cualquiera de las cinco. No requieren otra skill, una base de
conocimiento, un repositorio ni una integración concreta. Cuando hay un
proyecto, consultan sus instrucciones; cuando no lo hay, trabajan con el
contexto proporcionado.

## Instalación

Los comandos de descubrimiento e instalación por HTTPS son:

```sh
npx skills add https://github.com/medine-tech/agent-skills --list
npx skills add https://github.com/medine-tech/agent-skills --skill grill-me
npx skills add https://github.com/medine-tech/agent-skills --skill write-a-prd
npx skills add https://github.com/medine-tech/agent-skills --skill sales-coach
npx skills add https://github.com/medine-tech/agent-skills --skill b2b-sales-operating-system
npx skills add https://github.com/medine-tech/agent-skills --skill b2b-proposal
```

## Ejemplos de uso

Estos ejemplos son sintéticos. La invocación concreta depende del agente
que utilices.

**Revisión interactiva de una propuesta:**

> Usa grill-me para revisar esta idea: permitir que una persona reserve un
> libro de un catálogo compartido. Quiero comparar opciones y decidir qué
> ocurre cuando dos personas intentan reservar el mismo ejemplar. Hazme una
> pregunta a la vez con tu recomendación.

**Revisión autónoma autorizada:**

> Usa grill-me para analizar la propuesta de un catálogo de lectura personal.
> Sólo guarda título y estado de lectura; compartir listas queda fuera.
> Decide autónomamente los detalles de diseño y entrega una síntesis con
> razones, riesgos y supuestos. No implementes la propuesta.

**PRD a partir de decisiones disponibles:**

> Usa write-a-prd con estas decisiones: el catálogo permite añadir títulos,
> marcarlos como pendientes o leídos y filtrar por estado. No incluye cuentas
> ni recomendaciones. Redacta el PRD en Markdown con criterios verificables.
> Trabaja autónomamente y deja como pendientes los datos que no estén definidos.

**Primera conversación comercial:**

> Usa sales-coach para practicar mi primera visita a un taller ficticio. No
> tengo una reunión acordada. Ofrezco ayudar a ordenar solicitudes, sin prometer
> ahorros ni integraciones. Ensayemos por texto: interpreta a quien atiende y
> espera mis respuestas. Después dame feedback sobre lo que observaste.

**Revisión de oportunidades:**

> Usa b2b-sales-operating-system con estas notas ficticias: una cuenta pidió
> información, otra rechazó el seguimiento y otra quiere evaluar una demo.
> Propón estados y próximos pasos basados en evidencia, sin enviar mensajes
> ni registrar compromisos que nadie haya aceptado.

**Propuesta con incertidumbres:**

> Usa b2b-proposal para preparar una propuesta breve para un taller ficticio.
> Busca organizar solicitudes; hay una demo, pero la importación está pendiente
> de validar. Aún no hay precio ni fecha aprobados. Redacta para el comprador
> conservando esos pendientes y las condiciones para decidir.

Las skills responden en el idioma del usuario. En una sesión interactiva,
las preguntas se concentran en decisiones abiertas. Con autonomía ya
autorizada, avanzan sobre lo delegado y distinguen sus decisiones de los
acuerdos previos. Su salida sigue siendo útil en Markdown cuando una
integración opcional no está disponible o falla.

## Alcance de esta versión

El alcance incluye análisis de diseño, requisitos, entrenamiento y documentación
comercial. Quedan fuera la implementación y las operaciones de infraestructura.
Los skills comerciales pueden usarse con notas y texto: navegación, voz,
almacenamiento, CRM y exportación a otros formatos son opcionales. Preparar una
propuesta o practicar no concede permiso para contactar cuentas, publicar,
modificar registros o asumir compromisos. Cada operación externa requiere una
herramienta disponible y autorización aplicable a la operación y al destino.

El entrenador no mantiene un historial automático ni certifica capacidad de
venta. Distingue prácticas con ayuda, simulaciones y actuaciones reales; solo
evalúa lo observable. Los documentos comerciales conservan incertidumbres,
precios autorizados y límites de entrega, sin fabricar pruebas ni urgencia.

La [nota de cambios](CHANGELOG.md) describe la adaptación portable.

## Desarrollo

Usa Node **24.19.0** y npm **12.0.2**. El código de ejecución emplea la
biblioteca estándar de Node; TypeScript y los tipos de Node son herramientas
de desarrollo con versiones fijadas.

```sh
npm ci --ignore-scripts
npm test
npm run lint
npm run typecheck
npm run build
npm run check:leaks
```

El build compila los scripts en el directorio ignorado `dist`. Las pruebas
del detector usan respuestas sintéticas de Git y del sistema de archivos en
memoria. La suite de skills lee los artefactos reales para comprobar el
inventario, los archivos, la metadata y los comandos de instalación. Estas
pruebas estructurales no demuestran el comportamiento de un agente.

Lint comprueba tipos estrictos y código sin uso; typecheck revisa por separado
los contratos de los scripts y las pruebas.

## Revisión de publicación

El [checklist de release](docs/RELEASE_CHECKLIST.md) describe el orden de
publicación y la verificación anónima de clone, listado e instalaciones
separadas desde directorios vacíos.

Añade explícitamente los nuevos archivos públicos al índice antes del gate
de leaks. Ejecútalo desde la raíz y sin cambios concurrentes: inspecciona el
índice completo, el contenido actual de sus archivos, HEAD, las referencias
locales disponibles y su historial alcanzable. Borrar un valor del archivo
actual no lo elimina del historial.

El gate emite JSON y termina con **0** si la inspección es completa y limpia,
**1** si encuentra contenido bloqueado o **2** si no puede completarla. Los
diagnósticos contienen reglas, ámbitos, ordinales opacos, líneas válidas y
totales. Consulta la [política de publicación](docs/PUBLICATION_POLICY.md)
para conocer la cobertura, los límites y cómo resolver hallazgos.

Antes de publicar, un revisor debe examinar el diff, el historial completo,
las referencias previstas y la metadata, incluida la autoría. Los patrones
automáticos no identifican toda información confidencial. La revisión también
debe comprobar el uso independiente de las skills y la instalación por HTTPS
desde un entorno limpio; compilar o validar metadata no demuestra que esa
instalación haya funcionado.
