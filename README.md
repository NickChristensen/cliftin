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
cliftin/1.0.1 darwin-arm64 node-v25.6.0
$ cliftin --help [COMMAND]
USAGE
  $ cliftin COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`cliftin exercises list`](#cliftin-exercises-list)
* [`cliftin exercises show SELECTOR`](#cliftin-exercises-show-selector)
* [`cliftin help [COMMAND]`](#cliftin-help-command)
* [`cliftin programs list`](#cliftin-programs-list)
* [`cliftin programs show [SELECTOR]`](#cliftin-programs-show-selector)
* [`cliftin workouts list`](#cliftin-workouts-list)
* [`cliftin workouts show WORKOUTID`](#cliftin-workouts-show-workoutid)

## `cliftin exercises list`

List exercises

```
USAGE
  $ cliftin exercises list [--json] [--equipment <value>] [--muscle <value>] [--name <value>] [--sort
    name|lastPerformed|timesPerformed]

FLAGS
  --equipment=<value>  Filter by equipment name
  --muscle=<value>     Filter by muscle group
  --name=<value>       Filter by name contains
  --sort=<option>      [default: name]
                       <options: name|lastPerformed|timesPerformed>

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  List exercises
```

_See code: [src/commands/exercises/list.ts](https://github.com/nickchristensen/cliftin/blob/v1.0.1/src/commands/exercises/list.ts)_

## `cliftin exercises show SELECTOR`

Show one exercise detail and history

```
USAGE
  $ cliftin exercises show SELECTOR [--json] [--all | --limit <value>] [--from <value>] [--max-reps <value>]
    [--max-weight <value>] [--min-reps <value>] [--min-weight <value>] [--program <value>] [--routine <value>] [--to
    <value>]

ARGUMENTS
  SELECTOR  exercise id or name

FLAGS
  --all                 Return all matching history rows (no limit)
  --from=<value>        History start date YYYY-MM-DD
  --limit=<value>       History row limit (default: 100)
  --max-reps=<value>    History max top reps
  --max-weight=<value>  History max top weight
  --min-reps=<value>    History min top reps
  --min-weight=<value>  History min top weight
  --program=<value>     History filter by program id or name
  --routine=<value>     History filter by routine id or name
  --to=<value>          History end date YYYY-MM-DD

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Show one exercise detail and history
```

_See code: [src/commands/exercises/show.ts](https://github.com/nickchristensen/cliftin/blob/v1.0.1/src/commands/exercises/show.ts)_

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

## `cliftin programs list`

List programs

```
USAGE
  $ cliftin programs list [--json]

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  List programs
```

_See code: [src/commands/programs/list.ts](https://github.com/nickchristensen/cliftin/blob/v1.0.1/src/commands/programs/list.ts)_

## `cliftin programs show [SELECTOR]`

Show one program hierarchy

```
USAGE
  $ cliftin programs show [SELECTOR] [--json] [--active] [--current]

ARGUMENTS
  [SELECTOR]  program id or name

FLAGS
  --active   Show active program detail
  --current  Alias for --active

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Show one program hierarchy
```

_See code: [src/commands/programs/show.ts](https://github.com/nickchristensen/cliftin/blob/v1.0.1/src/commands/programs/show.ts)_

## `cliftin workouts list`

List workouts

```
USAGE
  $ cliftin workouts list [--json] [--limit <value> | --all] [--on <value> | --from <value> | --to <value>]
    [--program <value>] [--routine <value>]

FLAGS
  --all              Return all matching workouts (no limit)
  --from=<value>     Start date YYYY-MM-DD
  --limit=<value>    Limit workouts (default: 25)
  --on=<value>       Single date YYYY-MM-DD
  --program=<value>  Filter by program id or name
  --routine=<value>  Filter by routine id or name
  --to=<value>       End date YYYY-MM-DD

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  List workouts
```

_See code: [src/commands/workouts/list.ts](https://github.com/nickchristensen/cliftin/blob/v1.0.1/src/commands/workouts/list.ts)_

## `cliftin workouts show WORKOUTID`

Show one workout with exercises and sets

```
USAGE
  $ cliftin workouts show WORKOUTID [--json]

ARGUMENTS
  WORKOUTID  workout id

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Show one workout with exercises and sets
```

_See code: [src/commands/workouts/show.ts](https://github.com/nickchristensen/cliftin/blob/v1.0.1/src/commands/workouts/show.ts)_
<!-- commandsstop -->
