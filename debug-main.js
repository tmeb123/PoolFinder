// Pool Finder Diagnostics — main.js
// Geotab add-in entry point using the official geotab.addin.* namespace pattern

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
    ['btn-groups','btn-devices','btn-trips','btn-counts','btn-all'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.disabled = false;
    });
  }

  return {
    runGroups: function() {
      setStatus('groups-status', 'Fetching groups...', 'info');
      _api.call('Get', { typeName: 'Group' },
        function(groups) {
          var shaped = groups.map(function(g) {
            return { id: g.id, name: g.name || '(no name)', parent: g.parent ? g.parent.id : null };
          });
          setStatus('groups-status', '✓ ' + groups.length + ' groups found', 'ok');
          setOut('groups-out', shaped);
        },
        function(err) { setStatus('groups-status', '✗ ' + JSON.stringify(err), 'err'); }
      );
    },

    runDevices: function() {
      setStatus('devices-status', 'Fetching devices...', 'info');
      _api.call('Get', { typeName: 'Device', resultsLimit: 10 },
        function(devices) {
          var shaped = devices.map(function(d) {
            return { id: d.id, name: d.name, groups: d.groups ? d.groups.map(function(g){ return g.id; }) : [] };
          });
          setStatus('devices-status', '✓ ' + devices.length + ' devices returned', 'ok');
          setOut('devices-out', shaped);
        },
        function(err) { setStatus('devices-status', '✗ ' + JSON.stringify(err), 'err'); }
      );
    },

    runTrips: function() {
      setStatus('trips-status', 'Fetching sample trips...', 'info');
      var fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 90);
      _api.call('Get', {
        typeName: 'Trip',
        search: { fromDate: fromDate.toISOString() },
        resultsLimit: 3
      },
        function(trips) {
          setStatus('trips-status', '✓ ' + trips.length + ' trips returned', 'ok');
          setOut('trips-out', trips);
        },
        function(err) { setStatus('trips-status', '✗ ' + JSON.stringify(err), 'err'); }
      );
    },

    runCounts: function() {
      setStatus('counts-status', 'Fetching devices...', 'info');
      var fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 90);
      _api.call('Get', { typeName: 'Device', resultsLimit: 5 },
        function(devices) {
          var results = [], done = 0;
          devices.forEach(function(device) {
            _api.call('Get', {
              typeName: 'Trip',
              search: { deviceSearch: { id: device.id }, fromDate: fromDate.toISOString() },
              resultsLimit: 1000
            },
              function(trips) {
                results.push({
                  vehicle: device.name,
                  deviceId: device.id,
                  tripCount: trips.length,
                  sampleTrip: trips.length > 0 ? { start: trips[0].start, stop: trips[0].stop } : null
                });
                if (++done === devices.length) {
                  setStatus('counts-status', '✓ Done', 'ok');
                  setOut('counts-out', results);
                }
              },
              function(err) {
                results.push({ vehicle: device.name, error: err });
                if (++done === devices.length) {
                  setStatus('counts-status', '⚠ Done with errors', 'warn');
                  setOut('counts-out', results);
                }
              }
            );
          });
        },
        function(err) { setStatus('counts-status', '✗ ' + JSON.stringify(err), 'err'); }
      );
    },

    runAll: function() {
      this.runGroups();
      this.runDevices();
      this.runTrips();
      this.runCounts();
    },

    // Called by MyGeotab lifecycle
    initialize: function(api, state, callback) {
      _api = api;
      setStatus('api-status', '✓ MyGeotab api object received! Click any button to run diagnostics.', 'ok');
      enableButtons();
      callback();
    },
    focus: function(api, state) {},
    blur:  function() {}
  };
}());

// Register with Geotab using official namespace
geotab = geotab || {};
geotab.addin = geotab.addin || {};
geotab.addin.poolFinderDebug = function() {
  return {
    initialize: function(api, state, callback) { pfDebug.initialize(api, state, callback); },
    focus:      function(api, state)           { pfDebug.focus(api, state); },
    blur:       function()                     { pfDebug.blur(); }
  };
};
