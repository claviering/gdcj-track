bug: in computeRelevantTracks function.
you should using loadedTracks stations to determine if both start and end stations are on the same line.

example data structure `${cityTrackId}.json`:
```json
{
    "body": {
        "stationList": [
      {
        "stationId": 6420,
        "stationName": "惠州北",
        "stationPosition": 1,
        "status": 1,
        "cityTrackId": 241
      },
      {
        "stationId": 6421,
        "stationName": "小金口",
        "stationPosition": 2,
        "status": 1,
        "cityTrackId": 241
      },
      {
        "stationId": 6422,
        "stationName": "云山",
        "stationPosition": 3,
        "status": 1,
        "cityTrackId": 241
      },
      {
        "stationId": 6423,
        "stationName": "西湖东",
        "stationPosition": 4,
        "status": 1,
        "cityTrackId": 241
      },
      {
        "stationId": 6424,
        "stationName": "龙丰",
        "stationPosition": 5,
        "status": 1,
        "cityTrackId": 241
      },
      {
        "stationId": 6425,
        "stationName": "惠环",
        "stationPosition": 6,
        "status": 1,
        "cityTrackId": 241
      },
      {
        "stationId": 6426,
        "stationName": "陈江南",
        "stationPosition": 7,
        "status": 1,
        "cityTrackId": 241
      },
      {
        "stationId": 6427,
        "stationName": "沥林北",
        "stationPosition": 8,
        "status": 1,
        "cityTrackId": 241
      },
      {
        "stationId": 6428,
        "stationName": "银瓶",
        "stationPosition": 9,
        "status": 1,
        "cityTrackId": 241
      },
      {
        "stationId": 6429,
        "stationName": "樟木头东",
        "stationPosition": 10,
        "status": 1,
        "cityTrackId": 241
      },
      {
        "stationId": 6430,
        "stationName": "常平东",
        "stationPosition": 11,
        "status": 1,
        "cityTrackId": 241
      },
      {
        "stationId": 6431,
        "stationName": "常平南",
        "stationPosition": 12,
        "status": 1,
        "cityTrackId": 241
      },
      {
        "stationId": 6432,
        "stationName": "大朗镇",
        "stationPosition": 13,
        "status": 1,
        "cityTrackId": 241
      },
      {
        "stationId": 6433,
        "stationName": "松山湖北",
        "stationPosition": 14,
        "status": 1,
        "cityTrackId": 241
      },
      {
        "stationId": 6434,
        "stationName": "寮步",
        "stationPosition": 15,
        "status": 1,
        "cityTrackId": 241
      },
      {
        "stationId": 6435,
        "stationName": "东城南",
        "stationPosition": 16,
        "status": 1,
        "cityTrackId": 241
      },
      {
        "stationId": 6436,
        "stationName": "西平西",
        "stationPosition": 17,
        "status": 1,
        "cityTrackId": 241
      },
      {
        "stationId": 6437,
        "stationName": "道滘",
        "stationPosition": 18,
        "status": 1,
        "cityTrackId": 241
      },
      {
        "stationId": 6438,
        "stationName": "东莞西",
        "stationPosition": 19,
        "status": 1,
        "cityTrackId": 241
      },
      {
        "stationId": 6439,
        "stationName": "麻涌",
        "stationPosition": 20,
        "status": 1,
        "cityTrackId": 241
      },
      {
        "stationId": 6440,
        "stationName": "广州莲花山",
        "stationPosition": 21,
        "status": 1,
        "cityTrackId": 241
      },
      {
        "stationId": 6441,
        "stationName": "化龙南",
        "stationPosition": 22,
        "status": 1,
        "cityTrackId": 241
      },
      {
        "stationId": 6442,
        "stationName": "深井",
        "stationPosition": 23,
        "status": 1,
        "cityTrackId": 241
      },
      {
        "stationId": 6443,
        "stationName": "琶洲",
        "stationPosition": 24,
        "status": 1,
        "cityTrackId": 241
      },
      {
        "stationId": 6444,
        "stationName": "科韵路",
        "stationPosition": 25,
        "status": 1,
        "cityTrackId": 241
      },
      {
        "stationId": 6445,
        "stationName": "岑村",
        "stationPosition": 26,
        "status": 1,
        "cityTrackId": 241
      },
      {
        "stationId": 6446,
        "stationName": "龙洞",
        "stationPosition": 27,
        "status": 1,
        "cityTrackId": 241
      },
      {
        "stationId": 6447,
        "stationName": "大源",
        "stationPosition": 28,
        "status": 1,
        "cityTrackId": 241
      },
      {
        "stationId": 6448,
        "stationName": "帽峰山",
        "stationPosition": 29,
        "status": 1,
        "cityTrackId": 241
      },
      {
        "stationId": 6449,
        "stationName": "竹料",
        "stationPosition": 30,
        "status": 1,
        "cityTrackId": 241
      },
      {
        "stationId": 6450,
        "stationName": "白云机场东",
        "stationPosition": 31,
        "status": 1,
        "cityTrackId": 241
      },
      {
        "stationId": 6451,
        "stationName": "白云机场南",
        "stationPosition": 32,
        "status": 1,
        "cityTrackId": 241
      },
      {
        "stationId": 6452,
        "stationName": "白云机场北",
        "stationPosition": 33,
        "status": 1,
        "cityTrackId": 241
      },
      {
        "stationId": 6453,
        "stationName": "花山镇",
        "stationPosition": 34,
        "status": 1,
        "cityTrackId": 241
      },
      {
        "stationId": 6454,
        "stationName": "花城街",
        "stationPosition": 35,
        "status": 1,
        "cityTrackId": 241
      },
      {
        "stationId": 6455,
        "stationName": "花都",
        "stationPosition": 36,
        "status": 1,
        "cityTrackId": 241
      },
      {
        "stationId": 6456,
        "stationName": "乐同",
        "stationPosition": 37,
        "status": 1,
        "cityTrackId": 241
      },
      {
        "stationId": 6457,
        "stationName": "狮岭",
        "stationPosition": 38,
        "status": 1,
        "cityTrackId": 241
      },
      {
        "stationId": 6458,
        "stationName": "银盏",
        "stationPosition": 39,
        "status": 1,
        "cityTrackId": 241
      },
      {
        "stationId": 6459,
        "stationName": "龙塘镇",
        "stationPosition": 40,
        "status": 1,
        "cityTrackId": 241
      },
      {
        "stationId": 6460,
        "stationName": "清城",
        "stationPosition": 41,
        "status": 1,
        "cityTrackId": 241
      },
      {
        "stationId": 6461,
        "stationName": "燕湖",
        "stationPosition": 42,
        "status": 1,
        "cityTrackId": 241
      },
      {
        "stationId": 6462,
        "stationName": "洲心",
        "stationPosition": 43,
        "status": 1,
        "cityTrackId": 241
      },
      {
        "stationId": 6463,
        "stationName": "飞霞",
        "stationPosition": 44,
        "status": 1,
        "cityTrackId": 241
      }
    ],
        "trainTimeList": []
    }
}
```
when input start station `银瓶` and end station `科韵路`, we can see from the `stationList` that both stations are on the line and direction is `银瓶` to `科韵路` with `cityTrackId` 241, so we only need to calculate the `trainTimeList` for that line.