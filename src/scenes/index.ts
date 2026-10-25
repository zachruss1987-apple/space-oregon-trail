/** Scene registry; the first entry starts on boot. */
import { ArrivalScene } from './ArrivalScene';
import { DeathScene } from './DeathScene';
import { MapScene } from './MapScene';
import { SetupScene } from './SetupScene';
import { StoreScene } from './StoreScene';
import { SuppliesScene } from './SuppliesScene';
import { TitleScene } from './TitleScene';
import { TravelScene } from './TravelScene';
import { WaypointScene } from './WaypointScene';

export const SCENES = [TitleScene, SetupScene, StoreScene, TravelScene, SuppliesScene, MapScene, WaypointScene, DeathScene, ArrivalScene];
