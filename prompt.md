bug in Process reverse tracks separately
when `transferStations.get(key)!.leg2.push({ track, fromPos: candidatePos, toPos: posEnd, isReverse });`
current leg2 push track is not correctly reversed, it it getting from reverseTrackIds
you should get it from trackIds instead and leg2 push the track from trackIds