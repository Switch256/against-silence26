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
| `earth_ocean_mask_2048.png` | Ocean mask for sun glint, derived by the team from the Blue Marble above | NASA SVS 2915 (derived) |
| `earth_clouds_svs3615_2048.png` | Cloud layer, derived by the team (bright, colourless pixels) from NASA's cloud-covered equirectangular Earth | NASA Goddard SVS, [Equirectangular Projected Earth](https://svs.gsfc.nasa.gov/3615) (derived) |

All Earth, Moon and Mars imagery is now NASA-sourced; no third-party textures remain.

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
