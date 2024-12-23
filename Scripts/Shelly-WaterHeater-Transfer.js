// Thank you for your support: https://www.buymeacoffee.com/spothintafi
// Supported Shelly firmware versions: 1.0.3 - 1.4.4. Script version: 2024-11-02

// SETTINGS
let Region = "NO1"; // Supported regions: DK1, DK2, EE, FI, LT, LV, NO1, NO2, NO3, NO4, NO5, SE1, SE2, SE3, SE4
let Ranks = [1, 2, 3, 4]; // List the 'ranks' (i.e., the hour's order number by price) when the relays are activated
let Relays = [0]; // Numbers of the relays to be controlled. For example, [0,1,2] to control three relays
let NightHours = [22, 23, 0, 1, 2, 3, 4, 5, 6]; // Night shift hours. Normally, no need to change these (even during daylight saving time changes).
let PriceDifference = -1.02; // How much cheaper is the electricity transfer price during night shift?
let AllowedPrice = -999; // Daytime price that is always allowed. Night hours allow prices higher by the PriceDifference amount.
let BackupHours = [2, 3, 4, 5]; // Hours when the relay is activated if control data cannot be retrieved.

// CODE
let url = "https://api.spot-hinta.fi/PlanAhead?priorityHours=" + NightHours.join() + "&priceModifier=" + PriceDifference + "&ranksAllowed=" + Ranks.join() + "&priceAlwaysAllowed=" + AllowedPrice + "&region=" + Region;
let hour = -1;
let nextMessage = new Date(new Date().getTime() + 2 * 60 * 1000);
let previousAction = "";
print("WaterBoiler: Control will start in 15 seconds.");
let instructions = null;
let loadInstructions = true;
let instructionsTimeOut = new Date();
let previousStatus = "";
let nextStatusChange = new Date();

Timer.set(15000, true, function () {
    if (loadInstructions == true || instructionsTimeOut < new Date()) {
        LoadInstructionsFromServer();
    } else {
        ChangeRelayStatusIfNeeded();
    }
    if (new Date() > nextMessage) {
        nextMessage = new Date(new Date().getTime() + 2 * 60 * 1000);
        print("WaterBoiler: Control is operational. Relay status: " + previousStatus + " - Next status change: " + nextStatusChange.toString());
    }
});

function ChangeRelayStatusIfNeeded() {
    let relayStatus = GetCurrentlyExpectedRelayStatus();
    if (loadInstructions == true) {
        print("WaterBoiler: new control data needs to be loaded.");
        return;
    }
    if (previousStatus !== relayStatus.result) {
        SetRelayStatus(relayStatus);
        return;
    }
}

function SetRelayStatus(newStatus) {
    previousStatus = newStatus.result;
    for (let i = 0; i < Relays.length; i++) {
        Shelly.call("Switch.Set", "{ id:" + Relays[i] + ", on:" + newStatus.result + "}", null, null);
    }
    print("WaterBoiler: Relay status changed. New status: " + newStatus.result);
}

function LoadInstructionsFromServer() {
    Shelly.call("HTTP.GET", { url: url, timeout: 15, ssl_ca: "*" }, function (res, err) {
        if (err != 0 || res == null || res.code !== 200 || res.body == null) {
            print("WaterBoiler: Error fetching control data. Retrying.");
        } else {
            instructions = JSON.parse(res.body);
            loadInstructions = false;
            instructionsTimeOut = new Date(instructions[0].epochMs - 10800 * 1000);
            print("WaterBoiler: Control data successfully retrieved. New control data will be fetched by: " + instructionsTimeOut.toString());
        }
    });
}

function GetCurrentlyExpectedRelayStatus() {
    if (instructions == null || instructions.length == 0) {
        ActivateBackupHours();
        return;
    }
    const epochMs = Date.now();
    if (instructions[0].epochMs < epochMs) {
        ActivateBackupHours();
        return;
    }
    for (let i = 0; i < instructions.length; i++) {
        if (instructions.length > i && instructions[i + 1].epochMs > epochMs) {
            continue;
        }
        if (instructions.length > i && instructions[i + 1].epochMs <= epochMs) {
            nextStatusChange = new Date(instructions[i].epochMs);
            return instructions[i + 1];
        }
        if (instructions[i].epochMs <= epochMs) {
            return instructions[i];
        }
    }
    print("WaterBoiler: Error... No suitable control data found in the list.");
    ActivateBackupHours();
}

function ActivateBackupHours() {
    loadInstructions = true;
    print("WaterBoiler: Switching to backup hours.");
    if (BackupHours.indexOf(new Date().getHours()) > -1) {
        SetRelayStatus(true);
        return;
    } else {
        SetRelayStatus(false);
        return;
    }
}
