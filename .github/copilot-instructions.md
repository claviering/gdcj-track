# AI coding agent guide for this repo

## tool
* using yarn as package manager

## Big picture
- Purpose: a Koa + TypeScript server that serves direct and 1-transfer train schedules from local JSON data and returns a Tailwind-styled HTML page.
- Data flow: JSON files (in `data/`) -> in-memory indices -> compute results -> HTML render.
- Key modules:
  - `src/dataLoader.ts`: Loads `data/SingleCityTrack.json` and each `data/{cityTrackId}.json` once at startup. Builds fast lookups (`positionByName`, `stationIdByPosition`). Exposes `DataStore`.
  - `src/schedule.ts`: Computes results. Two paths: direct trips and one-transfer trips. Applies safety caps to bound memory/response size.
  - `src/render.ts`: Pure HTML render functions using Tailwind via CDN. No client JS or build step.
  - `src/server.ts`: Koa server + routes.
  - `src/utils.ts` and `src/types.ts`: Time parsing/formatting helpers, filename sanitization, shared types.

## How the server works (with examples)
- Endpoint: `GET /train-schedule?start=起点站&end=终点站` (e.g., `/train-schedule?start=惠州北&end=肇庆`).
- Validation: rejects identical start/end and unknown stations (validated via `DataStore.allStationNames`).
- Time rules: `parseHHmmToMinutes` handles HH:mm; cross-midnight arrivals/connections add 24h when later time < earlier time.
- Transfer rules: single transfer only, matching on same station name across tracks. Ignores connections with wait > `MAX_WAIT_MINUTES` (default 180).
- Safety caps (in `src/schedule.ts`): `MAX_*_RESULTS`, pruning thresholds to keep memory bounded; solutions sorted by total duration, then wait.

## Dev workflows
- Install/build/start from project root:
  - `yarn install`
  - `yarn dev` (serves on `http://localhost:3000` or `PORT` env)
- Live dev (auto-reload): `yarn run dev` (uses `ts-node-dev`).
- TypeScript: strict mode, outputs to `dist/`. No bundler needed.

## Conventions and patterns to follow
- Data files live under `data/`: `data/SingleCityTrack.json` and `data/239.json`–`data/244.json` etc. Loader assumes this layout.
- Stations are compared by name for transfer matching; direction enforced via station positions (must increase along a track).
- Rendering is server-side only; keep `render.ts` free of side effects and return complete HTML strings.

## Extending safely
- To add tracks/cities: update `SingleCityTrack.json` and place corresponding `{cityTrackId}.json` at root; server will load on next start.
- To tweak search behavior: adjust constants in `src/schedule.ts` (e.g., `MAX_WAIT_MINUTES`) and ensure performance by keeping caps.
- To add APIs: reuse `DataStore` from `ensureDataLoaded()`; prefer read-only access patterns and avoid mutating loaded indices.

## testing
- `yarn build` and auto run tests with `yarn postbuild`.

## about the SingleCityTrack.json file

example content of the file:
```json
{
    "body": [
        {
        "trackName": "肇庆-惠州北",
        "list": [
          {
            "cityTrackId": 244,
            "trackName": "肇庆-惠州北",
            "status": 1,
            "startStationName": "肇庆",
            "endStationName": "惠州北",
            "createTime": null,
            "creator": null,
            "modifyTime": null,
            "modifier": null
          }
        ]
      }
    ]
}
```
* body: list of transport networks
    - trackName: name of the transport network
    - list: list of transport lines in the network
        * cityTrackId: unique identifier for the transport line
        * trackName: name of the transport line
        * startStationName: starting station of the line
        * endStationName: ending station of the line


## about the ${cityTrackId}.json file

example content of the file:
```json
{
    "body": {
        "stationList": [
            {
                "stationId": 6337,
                "stationName": "飞霞",
                "stationPosition": 1,
                "status": 1,
                "cityTrackId": 239
            }
        ],
        "trainTimeList": [
            {
                "trainNumber": {
                    "trainNumberId": 11870,
                    "name": "C4902/3",
                    "cityTrackId": 239
                },
                "stationArriveTimeList": [
                    {
                        "id": 710854,
                        "stationId": 6337,
                        "trainNumberId": 11870,
                        "arriveTime": "06:00"
                    }
                ]
            }
        ]
    }
}
```
* stationList: list of stations in the transport network
* trainTimeList: list of scheduled trains in the transport network
    - trainNumber: details of the train
    - stationArriveTimeList: list of arrival times at each station