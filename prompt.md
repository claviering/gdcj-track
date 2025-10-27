mission 1: update the form for searching corresponding trains.
* add a `出发时间` field below the `起点站` field to specify the departure time for the first leg of the journey.
example:
```
start station: A
end station: C
departure time: 09:00
arriveTime at station A: C123 at 09:15, C456 at 09:30, C789 at 10:00
```
* only find the first leg train departing from `起点站` at or after the specified `出发时间`.

mission 2: update the `起点站` and `终点站` fields to using a searchable select by station names instad of using input fields.
* search from the `store.allStationNames` list for matching station names as the user types.

* move the `出发时间` field to be below the `终点站` field for better form layout.
* if departure time if specified, find the only one train that closest to the specified time for the first leg of the journey.

when calculating the timeDiff, don't using Math.abs, only consider trains departing at or after the specified time. and create a function to make code reusable.