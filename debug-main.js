// Pool Finder Diagnostics v2 — full fleet trip analysis
var pfDebug = (function() {
  var _api = null;

  function setStatus(id, msg, type) {
    var el = document.getElementById(id);
    if (el) { el.textContent = msg; el.className = 'status ' + type; }
  }
  function setOut(id, data) {
    var el = document.getElementById(id);
    if (el) el.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  }
  function enableButtons() {
    ['btn-analyze'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.disabled = false;
    });
  }

  // Group ID constants from diagnostic run
  var GROUP_IDS = {
    VAN:         'b279E',
    PICKUP:      'b279F',
    BACKHOE:     'b279D',
    DEPOT_NORTH: 'b279A',
    DEPOT_SOUTH: 'b279B'
  };

  function resolveVehicle(device) {
    var groups = device.groups || [];
    var type = groups.includes(GROUP_IDS.VAN)     ? 'Van'
              : groups.includes(GROUP_IDS.PICKUP)  ? 'Pickup'
              : groups.includes(GROUP_IDS.BACKHOE) ? 'Backhoe'
              : 'Unknown';
    var depot = groups.includes(GROUP_IDS.DEPOT_NORTH) ? 'Depot North'
               : groups.includes(GROUP_IDS.DEPOT_SOUTH) ? 'Depot South'
               : 'Unknown';
    return { id: device.id, name: device.name, type: type, depot: depot };
  }

  function analyzeTrips(trips) {
    if (!trips.length) return { count: 0, note: 'No trips' };

    // Get unique start hours across all trips
    var hourCounts = new Array(24).fill(0);
    var uniqueStartTimes = new Set();
    var uniqueStopTimes  = new Set();
    var durations = [];

    trips.forEach(function(t) {
      var start = new Date(t.start);
      var stop  = new Date(t.stop);
      hourCounts[start.getUTCHours()]++;
      uniqueStartTimes.add(t.start);
      uniqueStopTimes.add(t.stop);
      durations.push((stop - start) / 3600000);
    });

    var peakHour = hourCounts.indexOf(Math.max.apply(null, hourCounts));
    var avgDur   = (durations.reduce(function(a,b){return a+b;},0) / durations.length).toFixed(1);
    var allSameStart = uniqueStartTimes.size === 1;
    var allSameStop  = uniqueStopTimes.size  === 1;

    return {
      count:        trips.length,
      uniqueStarts: uniqueStartTimes.size,
      uniqueStops:  uniqueStopTimes.size,
      allSameStart: allSameStart,
      allSameStop:  allSameStop,
      peakHour:     peakHour + ':00 UTC',
      avgDurHrs:    parseFloat(avgDur),
      sampleStart:  trips[0].start,
      sampleStop:   trips[0].stop,
      verdict:      allSameStart && allSameStop
                    ? '⚠ SYNTHETIC — all trips identical, unusable for pooling analysis'
                    : '✓ REAL — varied timestamps, usable for pooling analysis'
    };
  }

  return {
    runAnalysis: function() {
      setStatus('main-status', 'Fetching all 50 vehicles...', 'info');
      setOut('main-out', 'Loading...');

      var fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 14);
      var fromISO = fromDate.toISOString();

      _api.call('Get', { typeName: 'Device', resultsLimit: 100 },
        function(devices) {
          // Filter to only our fleet vehicles (ones with type assignment)
          var fleet = devices.map(resolveVehicle).filter(function(v) {
            return v.type !== 'Unknown';
          });

          setStatus('main-status', 'Got ' + fleet.length + ' fleet vehicles — pulling trips (this takes ~30s)...', 'info');

          var results = [];
          var done    = 0;
          var total   = fleet.length;

          fleet.forEach(function(vehicle) {
            _api.call('Get', {
              typeName: 'Trip',
              search: {
                deviceSearch: { id: vehicle.id },
                fromDate: fromISO
              },
              resultsLimit: 500
            },
              function(trips) {
                var analysis = analyzeTrips(trips);
                results.push({
                  name:   vehicle.name,
                  type:   vehicle.type,
                  depot:  vehicle.depot,
                  id:     vehicle.id,
                  trips:  analysis
                });
                done++;
                setStatus('main-status',
                  'Pulling trips... ' + done + '/' + total + ' vehicles done', 'info');
                if (done === total) { finish(results); }
              },
              function(err) {
                results.push({ name: vehicle.name, error: JSON.stringify(err) });
                done++;
                if (done === total) { finish(results); }
              }
            );
          });
        },
        function(err) {
          setStatus('main-status', '✗ Failed to fetch devices: ' + JSON.stringify(err), 'err');
        }
      );
    },

    initialize: function(api, state, callback) {
      _api = api;
      setStatus('api-status', '✓ Connected to MyGeotab — click Analyze Fleet to pull 14 days of trip data', 'ok');
      enableButtons();
      callback();
    },
    focus: function(api, state) {},
    blur:  function() {}
  };

  function finish(results) {
    // Sort by depot then type then name
    results.sort(function(a,b) {
      if (!a.trips) return 1;
      var d = (a.depot||'').localeCompare(b.depot||'');
      if (d !== 0) return d;
      var t = (a.type||'').localeCompare(b.type||'');
      if (t !== 0) return t;
      return a.name.localeCompare(b.name);
    });

    // Summary counts
    var syntheticCount = 0, realCount = 0, noTripCount = 0;
    results.forEach(function(r) {
      if (!r.trips) return;
      if (r.trips.count === 0) noTripCount++;
      else if (r.trips.allSameStart && r.trips.allSameStop) syntheticCount++;
      else realCount++;
    });

    var summary = {
      totalVehicles:  results.length,
      syntheticData:  syntheticCount,
      variedData:     realCount,
      noTrips:        noTripCount,
      RECOMMENDATION: realCount > 0
        ? '✓ USE REAL DATA — ' + realCount + ' vehicles have varied timestamps'
        : '⚠ USE SYNTHETIC PATTERNS — all demo trips are identical, real pooling analysis not possible with this data'
    };

    var el = document.getElementById('main-status');
    el.textContent = '✓ Done! ' + results.length + ' vehicles analyzed — see summary below';
    el.className = 'status ok';

    document.getElementById('summary-out').textContent = JSON.stringify(summary, null, 2);
    document.getElementById('main-out').textContent    = JSON.stringify(results, null, 2);
  }
}());

geotab = geotab || {};
geotab.addin = geotab.addin || {};
geotab.addin.poolFinderDebug = function() {
  return {
    initialize: function(api, state, cb) { pfDebug.initialize(api, state, cb); },
    focus:      function(api, state)     { pfDebug.focus(api, state); },
    blur:       function()               { pfDebug.blur(); }
  };
};
