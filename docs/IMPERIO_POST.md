# Dos skills para revisar ideas y escribir requisitos

**Borrador para compartir después de completar el checklist de release.
No enviado.**

Estas dos skills con licencia MIT ayudan a trabajar una propuesta antes de
implementarla:

- **grill-me** examina decisiones, compara alternativas y busca riesgos y
  casos límite. Entrega una síntesis con razones, supuestos y pendientes.
- **write-a-prd** convierte una propuesta o decisiones previas en un PRD en
  Markdown con alcance, requisitos y criterios de aceptación verificables.

Cada skill contiene todas sus instrucciones en un único archivo. Se pueden
usar por separado o pasar el resumen de diseño a la redacción del PRD.
Funcionan con el contexto disponible y no exigen un repositorio, otra skill
ni un gestor de tareas. Las integraciones son opcionales y requieren la
autorización correspondiente.

Comandos para consultar e instalar desde el repositorio por HTTPS:

```sh
npx skills add https://github.com/medine-tech/agent-skills --list
npx skills add https://github.com/medine-tech/agent-skills --skill grill-me
npx skills add https://github.com/medine-tech/agent-skills --skill write-a-prd
```

Esta primera versión se concentra en análisis y documentación de producto.
La implementación, la orquestación de agentes y las operaciones de
infraestructura quedan fuera de su alcance.
