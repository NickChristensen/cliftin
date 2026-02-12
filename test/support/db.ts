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
create table ZPERIOD (Z_PK integer primary key, ZWORKOUTPLAN integer);
create table ZROUTINE (Z_PK integer primary key, ZNAME text, ZSOFTDELETED integer, ZPERIOD integer, ZWORKOUTPLAN integer);
create table Z_12ROUTINES (Z_12EXERCISES integer, Z_28ROUTINES integer, primary key (Z_12EXERCISES, Z_28ROUTINES));
create table ZEXERCISECONFIGURATION (Z_PK integer primary key, ZINFORMATION integer, ZREPS integer, ZSETS integer, ZWEIGHT real, ZTIME integer);
create table ZSETCONFIGURATION (Z_PK integer primary key, ZEXERCISECONFIGURATION integer, ZSETINDEX integer, ZREPS integer, ZWEIGHT real, ZTIME integer, ZRPE integer);
create table ZWORKOUTRESULT (Z_PK integer primary key, ZROUTINE integer, ZROUTINENAME text, ZSTARTDATE real, ZDURATION real);
create table ZEXERCISERESULT (Z_PK integer primary key, ZWORKOUT integer, ZCONFIGURATION integer);
create table ZGYMSETRESULT (Z_PK integer primary key, ZEXERCISE integer, ZREPS integer, ZWEIGHT real, ZVOLUME real, ZRPE integer, ZTIME integer);
create table ZEXERCISEINFORMATION (Z_PK integer primary key, ZNAME text, ZMUSCLES text, ZSECONDARYMUSCLES text, ZEQUIPMENT integer, ZTIMERBASED integer, ZSUPPORTSONEREPMAX integer, ZSOFTDELETED integer, ZDEFAULTPROGRESSMETRIC text, ZPERCEPTIONSCALE text);
create table ZEQUIPMENT2 (Z_PK integer primary key, ZNAME text);
  `)

  db.exec(`
insert into ZWORKOUTPLAN values (1, 'Active Program', 0, 0, 0, 700000000, X'AA11');
insert into ZWORKOUTPLAN values (2, 'Old Program', 1, 0, 0, 690000000, X'BB22');
insert into ZWORKOUTPROGRAMSINFO values (1, null, X'AA11');
insert into ZPERIOD values (10, 1);
insert into ZROUTINE values (100, 'Day A', 0, 10, 1);
insert into ZROUTINE values (101, 'Day B', 0, 10, 1);
insert into ZEQUIPMENT2 values (1, 'barbell');
insert into ZEXERCISEINFORMATION values (1000, 'squat', 'legs', 'glutes', 1, 0, 1, 0, 'maxWeight', 'rpe');
insert into ZEXERCISEINFORMATION values (1001, 'bench_press', 'chest', 'triceps', 1, 0, 1, 0, 'maxWeight', 'rpe');
insert into ZEXERCISEINFORMATION values (1002, 'bench', 'chest', 'triceps', 1, 0, 1, 0, 'maxWeight', 'rpe');
insert into ZEXERCISECONFIGURATION values (2000, 1000, 5, 3, 100, null);
insert into ZEXERCISECONFIGURATION values (2001, 1001, 5, 3, 80, null);
insert into Z_12ROUTINES values (2000, 100);
insert into Z_12ROUTINES values (2001, 100);
insert into ZSETCONFIGURATION values (3000, 2000, 1, 5, 100, null, null);
insert into ZSETCONFIGURATION values (3001, 2000, 2, 5, 102.5, null, null);
insert into ZWORKOUTRESULT values (4000, 100, 'Day A', 700000100, 3600);
insert into ZWORKOUTRESULT values (4001, 100, 'Day A', 700000200, 3500);
insert into ZEXERCISERESULT values (5000, 4000, 2000);
insert into ZEXERCISERESULT values (5001, 4001, 2000);
insert into ZGYMSETRESULT values (6000, 5000, 5, 100, 500, null, null);
insert into ZGYMSETRESULT values (6001, 5000, 5, 102.5, 512.5, null, null);
insert into ZGYMSETRESULT values (6002, 5001, 6, 105, 630, null, null);
  `)

  db.close()
  return dbPath
}
