cliftin
=================

CLIftin: A read-only CLI for Liftin'


[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/@nickchristensen/cliftin.svg)](https://npmjs.org/package/@nickchristensen/cliftin)
[![Downloads/week](https://img.shields.io/npm/dw/@nickchristensen/cliftin.svg)](https://npmjs.org/package/@nickchristensen/cliftin)


<!-- toc -->
* [Configuration](#configuration)
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->

# Configuration

cliftin reads your Liftin database directly. By default it looks for the Liftin app's SQLite file at:

```
$HOME/Library/Containers/com.nstrm.Bello/Data/Library/Application Support/Liftin/BelloDataModel.sqlite
```

To use a different path, set `LIFTIN_DB_PATH` in your environment or in a `.env.local` file at the project root:

```sh
LIFTIN_DB_PATH=/path/to/BelloDataModel.sqlite
```

# Usage
```sh-session
$ npm install -g @nickchristensen/cliftin
$ cliftin COMMAND
running command...
$ cliftin --help [COMMAND]
USAGE
  $ cliftin COMMAND
...
```
# Commands
<!-- commands -->
* [`cliftin exercises list`](#cliftin-exercises-list)
* [`cliftin exercises show SELECTOR`](#cliftin-exercises-show-selector)
* [`cliftin help [COMMAND]`](#cliftin-help-command)
* [`cliftin programs list`](#cliftin-programs-list)
* [`cliftin programs show [SELECTOR]`](#cliftin-programs-show-selector)
* [`cliftin routines from-workout [WORKOUTID]`](#cliftin-routines-from-workout-workoutid)
* [`cliftin routines latest`](#cliftin-routines-latest)
* [`cliftin routines list`](#cliftin-routines-list)
* [`cliftin routines next`](#cliftin-routines-next)
* [`cliftin routines show SELECTOR`](#cliftin-routines-show-selector)
* [`cliftin workouts list`](#cliftin-workouts-list)
* [`cliftin workouts next`](#cliftin-workouts-next)
* [`cliftin workouts show [WORKOUTID]`](#cliftin-workouts-show-workoutid)

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

_See code: [src/commands/exercises/list.ts](https://github.com/nickchristensen/cliftin/blob/v4.1.0/src/commands/exercises/list.ts)_

## `cliftin exercises show SELECTOR`

Show one exercise detail and history

```
USAGE
  $ cliftin exercises show SELECTOR [--json] [--all | --limit <value>] [--from <value>] [--max-reps <value>]
    [--max-weight <value>] [--min-reps <value>] [--min-weight <value>] [--no-warmup] [--program <value>] [--routine
    <value>] [--to <value>]

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
  --no-warmup           Hide warmup sets from output
  --program=<value>     History filter by program id or name
  --routine=<value>     History filter by routine id or name
  --to=<value>          History end date YYYY-MM-DD

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Show one exercise detail and history
```

_See code: [src/commands/exercises/show.ts](https://github.com/nickchristensen/cliftin/blob/v4.1.0/src/commands/exercises/show.ts)_

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

_See code: [src/commands/programs/list.ts](https://github.com/nickchristensen/cliftin/blob/v4.1.0/src/commands/programs/list.ts)_

## `cliftin programs show [SELECTOR]`

Show one program hierarchy

```
USAGE
  $ cliftin programs show [SELECTOR] [--json]

ARGUMENTS
  [SELECTOR]  program id or name (default: active program)

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Show one program hierarchy
```

_See code: [src/commands/programs/show.ts](https://github.com/nickchristensen/cliftin/blob/v4.1.0/src/commands/programs/show.ts)_

## `cliftin routines from-workout [WORKOUTID]`

Show the planned routine for a completed workout

```
USAGE
  $ cliftin routines from-workout [WORKOUTID] [--json]

ARGUMENTS
  [WORKOUTID]  workout id (default: latest workout)

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Show the planned routine for a completed workout
```

_See code: [src/commands/routines/from-workout.ts](https://github.com/nickchristensen/cliftin/blob/v4.1.0/src/commands/routines/from-workout.ts)_

## `cliftin routines latest`

Show the planned routine for the latest workout

```
USAGE
  $ cliftin routines latest [--json]

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Show the planned routine for the latest workout
```

_See code: [src/commands/routines/latest.ts](https://github.com/nickchristensen/cliftin/blob/v4.1.0/src/commands/routines/latest.ts)_

## `cliftin routines list`

List planned routines

```
USAGE
  $ cliftin routines list [--json] [--name <value>] [--program <value>] [--week <value>]

FLAGS
  --name=<value>     Filter by routine name contains
  --program=<value>  Filter by program id or name
  --week=<value>     Filter by week number

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  List planned routines
```

_See code: [src/commands/routines/list.ts](https://github.com/nickchristensen/cliftin/blob/v4.1.0/src/commands/routines/list.ts)_

## `cliftin routines next`

Show the up-next routine from the active program

```
USAGE
  $ cliftin routines next [--json]

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Show the up-next routine from the active program
```

_See code: [src/commands/routines/next.ts](https://github.com/nickchristensen/cliftin/blob/v4.1.0/src/commands/routines/next.ts)_

## `cliftin routines show SELECTOR`

Show one planned routine

```
USAGE
  $ cliftin routines show SELECTOR [--json]

ARGUMENTS
  SELECTOR  routine id or name

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Show one planned routine
```

_See code: [src/commands/routines/show.ts](https://github.com/nickchristensen/cliftin/blob/v4.1.0/src/commands/routines/show.ts)_

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

_See code: [src/commands/workouts/list.ts](https://github.com/nickchristensen/cliftin/blob/v4.1.0/src/commands/workouts/list.ts)_

## `cliftin workouts next`

Redirect to routines next

```
USAGE
  $ cliftin workouts next [--json]

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Redirect to routines next
```

_See code: [src/commands/workouts/next.ts](https://github.com/nickchristensen/cliftin/blob/v4.1.0/src/commands/workouts/next.ts)_

## `cliftin workouts show [WORKOUTID]`

Show one workout with exercises and sets

```
USAGE
  $ cliftin workouts show [WORKOUTID] [--json] [--no-warmup]

ARGUMENTS
  [WORKOUTID]  workout id (default: latest workout)

FLAGS
  --no-warmup  Hide warmup sets from output

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Show one workout with exercises and sets
```

_See code: [src/commands/workouts/show.ts](https://github.com/nickchristensen/cliftin/blob/v4.1.0/src/commands/workouts/show.ts)_
<!-- commandsstop -->
