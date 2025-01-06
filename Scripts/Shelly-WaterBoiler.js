// Thank you for your support: https://www.buymeacoffee.com/spothintafi
// Supported Shelly firmware versions: 1.0.3 - 1.4.4. Script version: 2024-12-29

// SETTINGS
let NightHours = 3; // Number of night hours 22:00 - 07:00
let AfternoonHours = 0; // Number of afternoon hours 12:00 - 20:00
let Relay = 0; // Relay number to control
let BackupHours = [3, 4, 5]; // Hours when the relay is activated if the Internet connection fails or the service is down

// CODE
let url = "https://api.spot-hinta.fi/WaterBoiler/" + NightHours + "/" + AfternoonHours;
let hour = -1;
let previousAction = "";
print("WaterBoiler: Control will start in 30 seconds.");

Timer.set(30000, true, function () {
  if (hour == new Date().getHours()) {
    print("WaterBoiler: Waiting for the hour to change.");
    return;
  }
  Shelly.call("HTTP.GET", { url: url, timeout: 15, ssl_ca: "*" }, function (res, err) {
    hour = (err != 0 || res == null || (res.code !== 200 && res.code !== 400)) ? -1 : new Date().getHours();
    let on = false;
    if (hour === -1) {
      previousAction = "";
      if (BackupHours.indexOf(new Date().getHours()) > -1) {
        on = true;
        hour = new Date().getHours();
        print("WaterBoiler: Error condition. The current hour is a backup hour: relay will be turned on for this hour.");
      } else {
        print("WaterBoiler: Error condition. The current hour is not a backup hour: relay will not be turned on. Retrying connection.");
      }
    } else {
      if (res.code === 200) {
        on = true;
      }
    }
    if (previousAction !== on) {
      Shelly.call("Switch.Set", "{ id:" + Relay + ", on:" + on + "}", null, null);
      print("WaterBoiler: Turned " + (on ? "on" : "off"));
      previousAction = on;
    } else {
      print("WaterBoiler: Relay state not changed, as it would be the same as the previous hour.");
    }
  });
});
