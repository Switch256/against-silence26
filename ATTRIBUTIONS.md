# Attributions

AEGIS-MEDLINK (team Against the Silence, NASA Space Apps Challenge 2026) uses the following data,
3D assets and software. NASA material is used under the
[NASA Images and Media Usage Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/);
its use does not imply endorsement by NASA. No NASA logos or insignia are used.

## NASA data

| Data | Used for | Source |
| --- | --- | --- |
| DONKI space weather: solar energetic particle events (SEP), coronal mass ejections (CME), geomagnetic storms (GST), radiation belt enhancements (RBE) | AEGIS space-weather environment status, radiation-shelter guidance, context in every PulseBrief, "May 2024" replay | NASA / CCMC, [api.nasa.gov](https://api.nasa.gov/), [DONKI](https://kauai.ccmc.gsfc.nasa.gov/DONKI/). Offline snapshot in `backend/data/donki/` |

Crew vital signs in the demo are **simulated** and labelled as such; they are not NASA astronaut data.
Space-weather status is environmental risk, not a measured crew radiation dose.

## NASA 3D models (`frontend/public/models/`)

All from [NASA 3D Resources](https://science.nasa.gov/3d-resources/) ([github.com/nasa/NASA-3D-Resources](https://github.com/nasa/NASA-3D-Resources)).

| File | NASA model | Used as |
| --- | --- | --- |
| `iss.glb` | [International Space Station (ISS) (B)](https://science.nasa.gov/3d-resources/international-space-station-iss-b/) | AEGIS-1 crewed habitat (stand-in, labelled as the NASA ISS model) |
| `astronaut.glb` | [Astronaut](https://science.nasa.gov/3d-resources/astronaut/) | Crew member in the spacecraft console |
| `dsn-34m.glb` | [Deep Space Network 34-meter](https://science.nasa.gov/3d-resources/deep-space-network-34-meter/) | Serving ground station antenna, articulated to point at the spacecraft (globe and ground-station inset) |
| `dsn-70m.glb` | [Deep Space Network 70-meter](https://github.com/nasa/NASA-3D-Resources/tree/master/3D%20Models/Deep%20Space%20Network%2070-meter) | Parked 70 m antenna beside the tracking 34 m dish in the ground-station inset |
| `mro.glb` | [Mars Reconnaissance Orbiter (MRO) (A)](https://github.com/nasa/NASA-3D-Resources/tree/master/3D%20Models/Mars%20Reconnaissance%20Orbiter%20(MRO)%20(A)) | Mars relay orbiter, slow orbit around Mars |
| `tdrs.glb` | [Tracking and Data Relay Satellites (TDRS) (A)](https://github.com/nasa/NASA-3D-Resources/tree/master/3D%20Models/Tracking%20and%20Data%20Relay%20Satellites%20(TDRS)%20(A)) | Near-Earth relay satellite in a high Earth orbit |
| `lro.glb` | [Lunar Reconnaissance Orbiter (A)](https://github.com/nasa/NASA-3D-Resources/tree/master/3D%20Models/Lunar%20Reconnaissance%20Orbiter%20(A)) | Slow orbit around the Moon |

## NASA imagery (`frontend/public/textures/nasa/`)

| File | Image | Source |
| --- | --- | --- |
| `mars_nasa_3d_resources.jpg` | Mars global map: the 3D Mars | [NASA 3D Resources, Images and Textures: Mars](https://github.com/nasa/NASA-3D-Resources/tree/master/Images%20and%20Textures/Mars) |
| `moon_lroc_color_1k.jpg` | Lunar colour map (LRO LROC): the 3D Moon | NASA Goddard Scientific Visualization Studio, [CGI Moon Kit](https://svs.gsfc.nasa.gov/4720) |
| `earth_black_marble_2012_3600.jpg` | Earth at night, 2012 (Black Marble): city lights on the night side of the 3D Earth | NASA Earth Observatory, [Night Lights 2012](https://visibleearth.nasa.gov/images/79765/night-lights-2012-map) |
| `earth_day_bluemarble_2048.jpg` | Blue Marble: Earth's land surface and oceans, the day side of the 3D Earth | NASA Goddard Scientific Visualization Studio, [Blue Marble: A Seamless Image Mosaic of the Earth](https://svs.gsfc.nasa.gov/2915) (converted to JPEG) |
| `earth_day_bluemarble_4096.jpg` | Sharper day side for the live 3D Earth in the console (4096×2048, downsampled from the stitched 8192 map) | NASA Goddard SVS, [Blue Marble](https://svs.gsfc.nasa.gov/2915) (east + west 4096 halves, stitched) |
| `sky_deep_star_maps_2020_4k.jpg` | Sky of the live 3D view: real stars (Hipparcos-2, Tycho-2, Gaia DR2) and the Milky Way with its dust lanes (converted from EXR) | NASA Goddard SVS, [Deep Star Maps 2020](https://svs.gsfc.nasa.gov/4851) (`starmap_2020_4k.exr`) |
| `earth_ocean_mask_2048.png` | Ocean mask for sun glint, derived by the team from the Blue Marble above | NASA SVS 2915 (derived) |
| `earth_clouds_svs3615_2048.png` | Cloud layer, derived by the team (bright, colourless pixels) from NASA's cloud-covered equirectangular Earth | NASA Goddard SVS, [Equirectangular Projected Earth](https://svs.gsfc.nasa.gov/3615) (derived) |

All Earth, Moon and Mars imagery is now NASA-sourced; no third-party textures remain.

## Rendered and derived assets (made with Blender 5.2 by the team)

| File | What it is | NASA sources |
| --- | --- | --- |
| `frontend/public/models/aegis1.glb` | AEGIS-1 web model: the NASA ISS (B) model with the detached floating parts removed, the 8 solar-array wings split into rotatable nodes, and simple named materials (`tools/blender/prep_aegis1.py`) | NASA 3D Resources, [International Space Station (ISS) (B)](https://science.nasa.gov/3d-resources/international-space-station-iss-b/) |
| `tools/blender/textures/earth_day_bluemarble_8192.jpg` | 8192×4096 day Earth used only for the Blender renders (sharper full-screen video); the east and west 4096 px halves stitched by the team | NASA Goddard SVS, [Blue Marble](https://svs.gsfc.nasa.gov/2915) (`bluemarble-west-4096.png` + `bluemarble-east-4096.png`) |
| `frontend/public/media/hero-1080.mp4`, `hero-720.mp4`, `hero-1080.webm`, `hero-poster.jpg` | Landing hero loop (10 s): AEGIS-1 above the Earth's limb with the DTN link beam and a PulseBrief packet (`tools/blender/aegis_scene.py --mode hero`) | ISS (B) model (as above); Blue Marble 8192 (SVS 2915, stitched); Black Marble 2012 night lights; cloud layer and ocean mask derived from SVS 3615 / SVS 2915 |
| `frontend/public/media/aegis-medlink-demo-30s.mp4` | The 30-second submission video, cut in Blender's sequencer (`tools/blender/demo_video.py`) from the hero and story films above and screenshots of the live console (`docs/media/shots/`) | Same NASA sources as the films and the console |
| `frontend/public/media/story-media-720.mp4` | "How it works" clip (8 s): the link drops, bundles queue, the link returns, the bundles are delivered in priority order and a reply comes back (`tools/blender/aegis_scene.py --mode story`) | Same as the hero loop |

The starfield, atmosphere, sun glow, link beam, packets and navigation lights are procedural shaders made by the team.
The Earth scale and spacecraft scale are artistic (not to scale). The spacecraft is the NASA ISS model, standing in for AEGIS-1.

## Software

| Component | Licence |
| --- | --- |
| [dtn7-rs](https://github.com/dtn7/dtn7-rs) (BPv7 daemon, `backend/dtn/`) | see repository |
| [FastAPI](https://fastapi.tiangolo.com/), [psycopg](https://www.psycopg.org/), [Alembic](https://alembic.sqlalchemy.org/), [cbor2](https://github.com/agronholm/cbor2) | MIT / LGPL-3.0 (psycopg) |
| [Next.js](https://nextjs.org/), [React](https://react.dev/), [three.js](https://threejs.org/), [React Three Fiber](https://github.com/pmndrs/react-three-fiber), [drei](https://github.com/pmndrs/drei) | MIT |
| [Inter](https://rsms.me/inter/), [JetBrains Mono](https://www.jetbrains.com/lp/mono/) fonts | SIL Open Font License 1.1 |

## Design references

Interface decisions were informed by NASA JPL's [Stellar design system](https://github.com/nasa-jpl/react-stellar),
NASA-STD-3001 Volume 2 (Appendix F, display standards) and the NASA Human Integration Design Handbook.
No certification or endorsement is claimed.

## AI assistance

AI tools (ChatGPT, Claude) were used for brainstorming, writing and code. The idea, architecture and technical
decisions are the team's; all results were verified by the team.
