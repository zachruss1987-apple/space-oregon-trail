/** Scene registry; the first entry starts on boot. */
import { FlareScene } from '@/minigames/FlareScene';
import { SalvageRunScene } from '@/minigames/SalvageRunScene';
import { ThreadingScene } from '@/minigames/ThreadingScene';
import { ArrivalScene } from './ArrivalScene';
import { BootScene } from './BootScene';
import { DeathScene } from './DeathScene';
import { HazardScene } from './HazardScene';
import { MapScene } from './MapScene';
import { OptionsScene } from './OptionsScene';
import { SetupScene } from './SetupScene';
import { StationScene } from './StationScene';
import { StoreScene } from './StoreScene';
import { SuppliesScene } from './SuppliesScene';
import { TitleScene } from './TitleScene';
import { TravelScene } from './TravelScene';
import { WaypointScene } from './WaypointScene';

export const SCENES = [BootScene, TitleScene, OptionsScene, SetupScene, StoreScene, TravelScene, SuppliesScene, MapScene, WaypointScene, HazardScene, StationScene, DeathScene, ArrivalScene, SalvageRunScene, ThreadingScene, FlareScene];
