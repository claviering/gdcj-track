create a script to update the data/*.json
using get to fetch data from the following api to update the json file `data/SingleCityTrack.json`
```
GET https://gdcj.gzmtr.com/metrogzApi/api/cityTrack/getSingleCityTrack?status=1
'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
Authorization: eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJsb2dpblRpbWUiOiIxNzYyNzQwOTU3MTg2IiwidXNlcm5hbWUiOiJvYm1hZjYzaGVwLXBxa2V3aWRya212cHR0ejIwIn0.SBi3qvcbAwzzy7DXKmMb80X5vEXGIisIJiU4OahN3Jw
```
* remove fields: status, createTime, creator, modifyTime, modifier

using get to fetch data from the following api to update the json file `data/${cityTrackId}.json`
```
GET https://gdcj.gzmtr.com/metrogzApi/api/stationArriveTime/listByCityTrackId?cityTrackId=239
'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
Authorization: eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJsb2dpblRpbWUiOiIxNzYyNzQwOTU3MTg2IiwidXNlcm5hbWUiOiJvYm1hZjYzaGVwLXBxa2V3aWRya212cHR0ejIwIn0.SBi3qvcbAwzzy7DXKmMb80X5vEXGIisIJiU4OahN3Jw
```
* remove fields: status, createTime, creator, modifyTime, modifier, isStartStation