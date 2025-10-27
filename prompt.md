mission: streamlineing the train trainTimeList for calculating the train schedule
* current state: there are 6 lines and it will calculate all the `trainTimeList` from `${cityTrackId}.json`
* goal: first, we need to calculate which the train line is needed, then only calculate the `trainTimeList` for that line
example:
train line 1: A -> B -> C -> D -> E -> F -> G
train line 2: A -> B -> C -> J -> K -> L -> M
input: start station A, end station F
output: only calculate train line 1's `trainTimeList` since line 2 does not reach station F
* using `stationList` data from `${cityTrackId}.json` to determine which lines are needed