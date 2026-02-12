cliftin
=================

CLIftin: A read-only CLI for Liftin'


[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/cliftin.svg)](https://npmjs.org/package/cliftin)
[![Downloads/week](https://img.shields.io/npm/dw/cliftin.svg)](https://npmjs.org/package/cliftin)


<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g cliftin
$ cliftin COMMAND
running command...
$ cliftin (--version)
cliftin/0.0.0 darwin-arm64 node-v24.13.1
$ cliftin --help [COMMAND]
USAGE
  $ cliftin COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`cliftin hello PERSON`](#cliftin-hello-person)
* [`cliftin hello world`](#cliftin-hello-world)
* [`cliftin help [COMMAND]`](#cliftin-help-command)
* [`cliftin plugins`](#cliftin-plugins)
* [`cliftin plugins add PLUGIN`](#cliftin-plugins-add-plugin)
* [`cliftin plugins:inspect PLUGIN...`](#cliftin-pluginsinspect-plugin)
* [`cliftin plugins install PLUGIN`](#cliftin-plugins-install-plugin)
* [`cliftin plugins link PATH`](#cliftin-plugins-link-path)
* [`cliftin plugins remove [PLUGIN]`](#cliftin-plugins-remove-plugin)
* [`cliftin plugins reset`](#cliftin-plugins-reset)
* [`cliftin plugins uninstall [PLUGIN]`](#cliftin-plugins-uninstall-plugin)
* [`cliftin plugins unlink [PLUGIN]`](#cliftin-plugins-unlink-plugin)
* [`cliftin plugins update`](#cliftin-plugins-update)

## `cliftin hello PERSON`

Say hello

```
USAGE
  $ cliftin hello PERSON -f <value>

ARGUMENTS
  PERSON  Person to say hello to

FLAGS
  -f, --from=<value>  (required) Who is saying hello

DESCRIPTION
  Say hello

EXAMPLES
  $ cliftin hello friend --from oclif
  hello friend from oclif! (./src/commands/hello/index.ts)
```

_See code: [src/commands/hello/index.ts](https://github.com/nickchristensen/cliftin/blob/v0.0.0/src/commands/hello/index.ts)_

## `cliftin hello world`

Say hello world

```
USAGE
  $ cliftin hello world

DESCRIPTION
  Say hello world

EXAMPLES
  $ cliftin hello world
  hello world! (./src/commands/hello/world.ts)
```

_See code: [src/commands/hello/world.ts](https://github.com/nickchristensen/cliftin/blob/v0.0.0/src/commands/hello/world.ts)_

## `cliftin help [COMMAND]`

Display help for cliftin.

```
USAGE
  $ cliftin help [COMMAND...] [-n]

ARGUMENTS
  [COMMAND...]  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for cliftin.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v6.2.37/src/commands/help.ts)_

## `cliftin plugins`

List installed plugins.

```
USAGE
  $ cliftin plugins [--json] [--core]

FLAGS
  --core  Show core plugins.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  List installed plugins.

EXAMPLES
  $ cliftin plugins
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.56/src/commands/plugins/index.ts)_

## `cliftin plugins add PLUGIN`

Installs a plugin into cliftin.

```
USAGE
  $ cliftin plugins add PLUGIN... [--json] [-f] [-h] [-s | -v]

ARGUMENTS
  PLUGIN...  Plugin to install.

FLAGS
  -f, --force    Force npm to fetch remote resources even if a local copy exists on disk.
  -h, --help     Show CLI help.
  -s, --silent   Silences npm output.
  -v, --verbose  Show verbose npm output.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Installs a plugin into cliftin.

  Uses npm to install plugins.

  Installation of a user-installed plugin will override a core plugin.

  Use the CLIFTIN_NPM_LOG_LEVEL environment variable to set the npm loglevel.
  Use the CLIFTIN_NPM_REGISTRY environment variable to set the npm registry.

ALIASES
  $ cliftin plugins add

EXAMPLES
  Install a plugin from npm registry.

    $ cliftin plugins add myplugin

  Install a plugin from a github url.

    $ cliftin plugins add https://github.com/someuser/someplugin

  Install a plugin from a github slug.

    $ cliftin plugins add someuser/someplugin
```

## `cliftin plugins:inspect PLUGIN...`

Displays installation properties of a plugin.

```
USAGE
  $ cliftin plugins inspect PLUGIN...

ARGUMENTS
  PLUGIN...  [default: .] Plugin to inspect.

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Displays installation properties of a plugin.

EXAMPLES
  $ cliftin plugins inspect myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.56/src/commands/plugins/inspect.ts)_

## `cliftin plugins install PLUGIN`

Installs a plugin into cliftin.

```
USAGE
  $ cliftin plugins install PLUGIN... [--json] [-f] [-h] [-s | -v]

ARGUMENTS
  PLUGIN...  Plugin to install.

FLAGS
  -f, --force    Force npm to fetch remote resources even if a local copy exists on disk.
  -h, --help     Show CLI help.
  -s, --silent   Silences npm output.
  -v, --verbose  Show verbose npm output.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Installs a plugin into cliftin.

  Uses npm to install plugins.

  Installation of a user-installed plugin will override a core plugin.

  Use the CLIFTIN_NPM_LOG_LEVEL environment variable to set the npm loglevel.
  Use the CLIFTIN_NPM_REGISTRY environment variable to set the npm registry.

ALIASES
  $ cliftin plugins add

EXAMPLES
  Install a plugin from npm registry.

    $ cliftin plugins install myplugin

  Install a plugin from a github url.

    $ cliftin plugins install https://github.com/someuser/someplugin

  Install a plugin from a github slug.

    $ cliftin plugins install someuser/someplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.56/src/commands/plugins/install.ts)_

## `cliftin plugins link PATH`

Links a plugin into the CLI for development.

```
USAGE
  $ cliftin plugins link PATH [-h] [--install] [-v]

ARGUMENTS
  PATH  [default: .] path to plugin

FLAGS
  -h, --help          Show CLI help.
  -v, --verbose
      --[no-]install  Install dependencies after linking the plugin.

DESCRIPTION
  Links a plugin into the CLI for development.

  Installation of a linked plugin will override a user-installed or core plugin.

  e.g. If you have a user-installed or core plugin that has a 'hello' command, installing a linked plugin with a 'hello'
  command will override the user-installed or core plugin implementation. This is useful for development work.


EXAMPLES
  $ cliftin plugins link myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.56/src/commands/plugins/link.ts)_

## `cliftin plugins remove [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ cliftin plugins remove [PLUGIN...] [-h] [-v]

ARGUMENTS
  [PLUGIN...]  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ cliftin plugins unlink
  $ cliftin plugins remove

EXAMPLES
  $ cliftin plugins remove myplugin
```

## `cliftin plugins reset`

Remove all user-installed and linked plugins.

```
USAGE
  $ cliftin plugins reset [--hard] [--reinstall]

FLAGS
  --hard       Delete node_modules and package manager related files in addition to uninstalling plugins.
  --reinstall  Reinstall all plugins after uninstalling.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.56/src/commands/plugins/reset.ts)_

## `cliftin plugins uninstall [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ cliftin plugins uninstall [PLUGIN...] [-h] [-v]

ARGUMENTS
  [PLUGIN...]  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ cliftin plugins unlink
  $ cliftin plugins remove

EXAMPLES
  $ cliftin plugins uninstall myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.56/src/commands/plugins/uninstall.ts)_

## `cliftin plugins unlink [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ cliftin plugins unlink [PLUGIN...] [-h] [-v]

ARGUMENTS
  [PLUGIN...]  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ cliftin plugins unlink
  $ cliftin plugins remove

EXAMPLES
  $ cliftin plugins unlink myplugin
```

## `cliftin plugins update`

Update installed plugins.

```
USAGE
  $ cliftin plugins update [-h] [-v]

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Update installed plugins.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.56/src/commands/plugins/update.ts)_
<!-- commandsstop -->
