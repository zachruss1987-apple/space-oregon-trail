/** Scene registry; the first entry starts on boot. */
import { SalvageRunScene } from '@/minigames/SalvageRunScene';
import { ArrivalScene } from './ArrivalScene';
import { DeathScene } from './DeathScene';
import { HazardScene } from './HazardScene';
import { MapScene } from './MapScene';
import { SetupScene } from './SetupScene';
import { StationScene } from './StationScene';
import { StoreScene } from './StoreScene';
import { SuppliesScene } from './SuppliesScene';
import { TitleScene } from './TitleScene';
import { TravelScene } from './TravelScene';
import { WaypointScene } from './WaypointScene';

export const SCENES = [TitleScene, SetupScene, StoreScene, TravelScene, SuppliesScene, MapScene, WaypointScene, HazardScene, StationScene, DeathScene, ArrivalScene, SalvageRunScene];
