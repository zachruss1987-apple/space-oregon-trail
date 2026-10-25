/** Crew names. Source: docs/design/world.md. */

/** Default crew; index 0 is the captain. */
export const DEFAULT_CREW_NAMES: readonly string[] = ['Ezra', 'Temperance', 'Amos', 'Lucinda', 'Hollis'];

/** Pool for "Random names", NPCs, beacons and seeded scores. */
export const NAME_POOL: readonly string[] = [
  'Abigail', 'Bartholomew', 'Cora', 'Delphine', 'Eli', 'Florence', 'Gideon', 'Hester', 'Ignatius', 'Jemima',
  'Kit', 'Lavinia', 'Mordecai', 'Nell', 'Obadiah', 'Prudence', 'Silas', 'Theodora', 'Ulysses', 'Zebulon',
];

/** Crew size. */
export const CREW_SIZE = 5;
/** Name length bounds (printable ASCII). */
export const NAME_MIN_LENGTH = 1;
export const NAME_MAX_LENGTH = 12;
