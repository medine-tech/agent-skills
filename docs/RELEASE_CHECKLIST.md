# Checklist de release

Este procedimiento describe qué comprobar; no registra una publicación ni
una instalación ya realizada. Aplica la [política de publicación](PUBLICATION_POLICY.md)
y conserva los resultados, las rutas temporales y la aprobación fuera del
contenido versionado.

## Orden de publicación

- [ ] Identificar el commit y las refs exactas que se expondrán; revisar el
  diff, el historial completo y la metadata, incluida la autoría y los
  mensajes de commits y tags.
- [ ] Después del merge, comprobar en `main` los cinco checks: `npm test`,
  `npm run lint`, `npm run typecheck`, `npm run build` y `npm run check:leaks`.
  Registrar el SHA al que corresponden y confirmar las refs previstas.
- [ ] Registrar privadamente la revisión independiente y su aprobación
  antes de cambiar la visibilidad del repositorio.
- [ ] Confirmar que el repositorio es público y conserva la licencia MIT.
- [ ] Ejecutar la verificación anónima siguiente. El SHA clonado debe ser
  el commit revisado; el listado debe contener exactamente los cinco skills
  del inventario siguiente, y cada instalación separada debe coincidir con él.
- [ ] Conservar versiones, salidas, códigos de salida, SHA y comparaciones;
  reconciliar los criterios de aceptación y sus evidencias en el tracker
  o registro privado de la entrega.
- [ ] Mantener [el post](IMPERIO_POST.md) como borrador. Completar este
  checklist no lo envía ni autoriza una publicación en redes.

Si algún check falla o no puede completarse, la verificación queda pendiente.
No sustituirlo por una ejecución autenticada ni introducir credenciales para
obtener un resultado exitoso.

## Verificación anónima por HTTPS

Ejecuta el bloque después de confirmar la publicación, desde una cuenta limpia
sin `.netrc` ni configuración de autenticación accesible. Requiere `sh`, Git,
Node 24.19.0, npm 12.0.2, `mktemp` y `cmp`; la CLI queda fijada a `skills@1.5.25`.

`env -i` elimina variables heredadas; no impide que una herramienta localice
archivos de la cuenta mediante el sistema. Por eso la cuenta limpia es una
condición del procedimiento. No se reasignan `HOME` ni `CODEX_HOME`. Los
directorios GitHub/XDG y la caché son nuevos, los dos archivos de configuración
npm están vacíos y se desactivan los hooks de instalación de paquetes. La CLI
se ejecuta explícitamente con `npx`.

El helper elimina los credential helpers de Git, desactiva prompts y bloquea
SSH. No se usa `GIT_ALLOW_PROTOCOL` como garantía: la CLI puede reemplazarlo.
Las instalaciones usan el alcance de proyecto y copias regulares, sin `--global`.

```sh
(
  set -eu
  release_check_root=$(mktemp -d)
  mkdir "$release_check_root/clone" "$release_check_root/list" \
    "$release_check_root/gh" "$release_check_root/config" \
    "$release_check_root/state" "$release_check_root/cache"
  : > "$release_check_root/npm-user.conf"
  : > "$release_check_root/npm-global.conf"

  release_run() {
    env -i PATH="$PATH" \
      GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null \
      GIT_TERMINAL_PROMPT=0 GIT_CONFIG_COUNT=1 \
      GIT_CONFIG_KEY_0=credential.helper GIT_CONFIG_VALUE_0='' \
      GIT_SSH_COMMAND=false GIT_ASKPASS=false \
      GH_CONFIG_DIR="$release_check_root/gh" \
      XDG_CONFIG_HOME="$release_check_root/config" \
      XDG_STATE_HOME="$release_check_root/state" \
      npm_config_userconfig="$release_check_root/npm-user.conf" \
      npm_config_globalconfig="$release_check_root/npm-global.conf" \
      npm_config_cache="$release_check_root/cache" \
      npm_config_ignore_scripts=true DISABLE_TELEMETRY=1 DO_NOT_TRACK=1 \
      "$@"
  }

  cd "$release_check_root"
  printf 'Directorio de verificación: %s\n' "$release_check_root"
  release_run node --version
  release_run npm --version
  release_run git clone https://github.com/medine-tech/agent-skills "$release_check_root/clone"
  release_run git -C "$release_check_root/clone" rev-parse HEAD

  cd "$release_check_root/list"
  release_run npx --yes skills@1.5.25 add https://github.com/medine-tech/agent-skills --list

  for release_skill in b2b-proposal b2b-sales-operating-system grill-me sales-coach write-a-prd; do
    mkdir "$release_check_root/$release_skill"
    cd "$release_check_root/$release_skill"
    release_run npx --yes skills@1.5.25 add https://github.com/medine-tech/agent-skills --skill "$release_skill" --agent codex --yes --copy
    test -f ".agents/skills/$release_skill/SKILL.md"
    test ! -L .agents
    test ! -L .agents/skills
    test ! -L ".agents/skills/$release_skill"
    test ! -L ".agents/skills/$release_skill/SKILL.md"
    test -f skills-lock.json
    test ! -L skills-lock.json
    set -- .agents/skills/*
    test "$#" -eq 1
    test "$1" = ".agents/skills/$release_skill"
    set -- ".agents/skills/$release_skill/"*
    test "$#" -eq 1
    test "$1" = ".agents/skills/$release_skill/SKILL.md"
    cmp "$release_check_root/clone/skills/$release_skill/SKILL.md" ".agents/skills/$release_skill/SKILL.md"
  done
)
```

El bloque se detiene en el primer error y devuelve su código de salida; no
canalices su salida de una forma que oculte ese resultado. Además de las
comprobaciones de archivos, revisa el listado y contrasta el SHA con el commit
aprobado. Si las copias difieren, conserva el fallo y resuelve qué revisión se
descargó antes de repetir. Una ejecución exitosa no sustituye esas dos
comprobaciones ni la revisión de publicación.
