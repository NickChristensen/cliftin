import Database from 'better-sqlite3'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

export function createTestDb(): string {
  const dir = mkdtempSync(join(tmpdir(), 'cliftin-test-'))
  const dbPath = join(dir, 'test.sqlite')
  const db = new Database(dbPath)

  db.exec(`
create table ZWORKOUTPLAN (Z_PK integer primary key, ZNAME text, ZISCURRENT integer, ZISTEMPLATE integer, ZSOFTDELETED integer, ZDATEADDED real, ZID blob);
create table ZWORKOUTPROGRAMSINFO (Z_PK integer primary key, ZSECONDARYWORKOUTPROGRAMID blob, ZSELECTEDWORKOUTPROGRAMID blob);
create table ZPERIOD (Z_PK integer primary key, ZWORKOUTPLAN integer, Z_FOK_WORKOUTPLAN integer);
create table ZROUTINE (Z_PK integer primary key, ZNAME text, ZSOFTDELETED integer, ZPERIOD integer, ZWORKOUTPLAN integer, Z_FOK_PERIOD integer);
create table Z_12ROUTINES (Z_12EXERCISES integer, Z_28ROUTINES integer, Z_FOK_12EXERCISES integer, primary key (Z_12EXERCISES, Z_28ROUTINES));
create table ZEXERCISECONFIGURATION (Z_PK integer primary key, ZINFORMATION integer, ZREPS integer, ZSETS integer, ZWEIGHT real, ZTIME integer);
create table ZSETCONFIGURATION (Z_PK integer primary key, ZEXERCISECONFIGURATION integer, ZSETINDEX integer, ZREPS integer, ZWEIGHT real, ZTIME integer, ZRPE integer);
create table ZWORKOUTRESULT (Z_PK integer primary key, ZROUTINE integer, ZROUTINENAME text, ZSTARTDATE real, ZDURATION real);
create table ZEXERCISERESULT (Z_PK integer primary key, ZWORKOUT integer, ZCONFIGURATION integer, Z_FOK_WORKOUT integer);
create table ZGYMSETRESULT (Z_PK integer primary key, ZEXERCISE integer, Z_FOK_EXERCISE integer, ZREPS integer, ZWEIGHT real, ZVOLUME real, ZRPE integer, ZTIME integer);
create table ZEXERCISEINFORMATION (Z_PK integer primary key, ZNAME text, ZMUSCLES text, ZSECONDARYMUSCLES text, ZEQUIPMENT integer, ZTIMERBASED integer, ZSUPPORTSONEREPMAX integer, ZISUSERCREATED integer, ZSOFTDELETED integer, ZDEFAULTPROGRESSMETRIC text, ZPERCEPTIONSCALE text);
create table ZEQUIPMENT2 (Z_PK integer primary key, ZNAME text, ZID text, ZMEASURMENTUNIT text);
create table ZSETTINGS (ZMEASURMENTUNIT text);
  `)

  db.exec(`
insert into ZWORKOUTPLAN values (1, 'Active Program', 0, 0, 0, 700000000, X'AA11');
insert into ZWORKOUTPLAN values (2, 'Old Program', 1, 0, 0, 690000000, X'BB22');
insert into ZWORKOUTPLAN values (3, 'Deleted Program', 0, 0, 1, 680000000, X'CC33');
insert into ZWORKOUTPROGRAMSINFO values (1, null, X'AA11');
insert into ZPERIOD values (10, 1, 100);
insert into ZROUTINE values (100, 'Day A', 0, 10, null, 100);
insert into ZROUTINE values (101, 'Day B', 0, 10, null, 200);
insert into ZEQUIPMENT2 values (1, 'settings:equipment:equipment_default_name', 'smithMachine', null);
insert into ZEQUIPMENT2 values (2, 'Straight Curl Bar', 'BBB6E07D-B75F-459D-9FF8-4A97AD6AE665', null);
insert into ZSETTINGS values ('imperial');
insert into ZEXERCISEINFORMATION values (1000, 'squat', 'legs', 'glutes', 1, 0, 1, 0, 0, 'maxWeight', 'rpe');
insert into ZEXERCISEINFORMATION values (1001, 'bench_press', 'chest', 'triceps', 1, 0, 1, 0, 0, 'maxWeight', 'rpe');
insert into ZEXERCISEINFORMATION values (1002, 'bench', 'chest', 'triceps', 2, 0, 1, 1, 0, 'maxWeight', 'rpe');
insert into ZEXERCISEINFORMATION values (1003, 'deleted_exercise', 'legs', 'glutes', 1, 0, 1, 0, 1, 'maxWeight', 'rpe');
insert into ZEXERCISECONFIGURATION values (2000, 1000, 5, 3, 100, null);
insert into ZEXERCISECONFIGURATION values (2001, 1001, 5, 3, 80, null);
insert into Z_12ROUTINES values (2000, 100, 200);
insert into Z_12ROUTINES values (2001, 100, 100);
insert into ZSETCONFIGURATION values (3000, 2000, 1, 5, 100, null, 16);
insert into ZSETCONFIGURATION values (3001, 2000, 2, 5, 102.5, null, null);
insert into ZWORKOUTRESULT values (4000, 100, 'Day A', 700000100, 3600);
insert into ZWORKOUTRESULT values (4001, 100, 'Day A', 700000200, 3500);
insert into ZEXERCISERESULT values (5000, 4000, 2000, 200);
insert into ZEXERCISERESULT values (5002, 4000, 2001, 100);
insert into ZEXERCISERESULT values (5001, 4001, 2000, 100);
insert into ZGYMSETRESULT values (6000, 5000, 100, 5, 100, 500, null, null);
insert into ZGYMSETRESULT values (6001, 5000, 200, 5, 102.5, 512.5, null, null);
insert into ZGYMSETRESULT values (6003, 5002, 200, 5, 80, 400, null, null);
insert into ZGYMSETRESULT values (6004, 5002, 100, 5, 82.5, 412.5, null, null);
insert into ZGYMSETRESULT values (6002, 5001, 100, 6, 105, 630, null, null);
  `)

  db.close()
  return dbPath
}
