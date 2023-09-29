// You can support spot-hinta.fi service here: https://www.buymeacoffee.com/spothintafi

// SmartHeating: outdoor temperature controlled heating with a possibility to control multiple relays with the same rules
// It is possible to configure the heating curve with seven temperature points.

// Modify these settings
let SETTINGS =
{
    // Region
    Region: "FI",

    // Relay settings
    RelayName: "Sleeping rooms and livingroom",  // Whatever name for this relay(s). Used in debug logging mostly.
    RelayNumbers: [0, 1],  // List here relays that are controlled with this script. Shelly relay numbering starts from 0.    
    Inverted: false,  // If this is set to 'true', the relay logic is inverted.

    // Location for a temperature forecast. Temperature in use is 24h moving forecasted average temperature.
    PostalCode: "00100",      // Postal code (Finland only!). Use value "" if you are outside Finland or want to use coordinates!
    Latitude: "60.169830",  // Latitude. Simple service to check the coordinates: https://www.latlong.net/
    Longitude: "24.938190",  // Longitude. Simple service to check the coordinates: https://www.latlong.net/

    // Heating hours per temperature point. 
    // NOTE! Number of hours must increase(or stay the same) when going from warmer to colder.
    HeatingHours_MaxTemperature: 25,  // Stop heating at this temperature (zero hours in all degrees above this)
    HeatingHours_Plus30: 1,  	// Number of heating hours at +30C
    HeatingHours_Plus20: 2,  	// Number of heating hours at +20C
    HeatingHours_Plus10: 3,  	// Number of heating hours at +10C
    HeatingHours_Zero: 5,  	    // Number of heating hours at 0C
    HeatingHours_Minus10: 10, 	// Number of heating hours at -10C
    HeatingHours_Minus20: 18, 	// Number of heating hours at -20C
    HeatingHours_Minus30: 24, 	// Number of heating hours at -30C

    // Minimum hours period (mainly for a daytime to avoid too long heating pauses)
    MinimumHoursPeriod_IsActive: false, // Set to true, if you want to define minimum hours period
    MinimumHoursPeriod_TemperatureStart: -10,  // Minimum hours are active only below this temperature
    MinimumHoursPeriod_Hours: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19],  // List hours for minimum hours period.
    MinimumHoursPeriod_NumberOfHours: 3,  // How many hours at minimum must be put to this period

    // Limitations and backup hours
    AllowedDays: [1, 2, 3, 4, 5, 6, 7],  // Execution days: 1=Monday to 7=Sunday.
    AllowedMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],  // Execution months: 1=January to 12=December.
    BackupHours: [1, 2, 3, 4, 12, 13, 16, 17, 21, 22],  // Backup hours if internet connection is down or spot-hinta.fi server is not responding
    MaximumPrice: 999, // Maximum allowed price in Euro cents. This can be used to f.ex. stop heating with electricity and switch to wood/oil/gas.

    // Price modification (f.ex. electricity transfer cost difference between night/day or seasonal price differences)
    PriceModifier_IsActive: false,  // Change to true if price modification is wanted
    PriceModifier_Sum: -2.30, // How much the price is modified in euro cents? Can be positive or negative amount.
    PriceModifier_Months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],  // Modify if price modification is valid only during certain months
    PriceModifier_Days: [1, 2, 3, 4, 5, 6, 7], // Modify if the price modification is valid only during certain days
    PriceModifier_Hours: [22, 23, 0, 1, 2, 3, 4, 5, 6, 7], // List here the hours which price is modified for rank calculation
};

// Don't touch below!
print("Script has started succesfully. The first relay action happens in 30 seconds.");
let cHour = ""; let Executed = ""; let previousAction = ""; let invertedOn = "true"; let invertedOff = "false;"
let urlToCall = "https://api.spot-hinta.fi/SmartHeating";
if (SETTINGS.Inverted === true) { invertedOn = "false"; invertedOff = "true"; }

Timer.set(30000, true, function () {
    let hour = new Date().getHours();
    if (cHour !== hour) { cHour = hour; Executed = false; print("The hour has now changed and a new relay action is going to be performed.") }
    if (cHour == hour && Executed == true) { print("This hour has already been executed. Waiting for an hour change."); return; }
    Shelly.call("HTTP.POST", { url: urlToCall, body: SETTINGS, timeout: 15, ssl_ca: "*" }, RunResponse);
});

function RunResponse(result, error_code) {
    if (error_code === 0 && result !== null) {
        if ((result.code === 400 || result.code === 200) && previousAction === result.code) {
            print("Response JSON: " + result.body);
            print("No action is done. The relay statuses remains the same as during previous hour.");
            return;
        }
        if (result.code === 400) {
            print("Response JSON: " + result.body);
            print("Changing relay status. Hour is too expensive. New relay status (true/false): " + invertedOff);
            for (let i = 0; i < SETTINGS.RelayNumbers.length; i++) {
                Shelly.call("Switch.Set", "{ id:" + SETTINGS.RelayNumbers[i] + ", on:" + invertedOff + "}", null, null);
            }
            previousAction = result.code;
            Executed = true;
            return;
        }
        if (result.code === 200) {
            print("Response JSON: " + result.body);
            print("Changing relay status. Hour is cheap enough. New relay status (true/false): " + invertedOn);
            for (let i = 0; i < SETTINGS.RelayNumbers.length; i++) {
                Shelly.call("Switch.Set", "{ id:" + SETTINGS.RelayNumbers[i] + ", on:" + invertedOn + "}", null, null);
            }
            previousAction = result.code;
            Executed = true;
            return;
        }
        if (result.code === 422) {
            print("Configuration error: " + JSON.stringify(result));
            Executed = false;
            return;
        }
    }

    // Backup hour functionality
    previousAction = "";
    if (SETTINGS.BackupHours.indexOf(cHour) > -1) {
        print("Error while fetching control information. It is a backup hour now. New relay status (true/false): " + invertedOn);
        for (let i = 0; i < SETTINGS.RelayNumbers.length; i++) {
            Shelly.call("Switch.Set", "{ id:" + SETTINGS.RelayNumbers[i] + ", on:" + invertedOn + "}", null, null);
        }
        Executed = false;
        return;
    }
    else {
        print("Error while fetching control information. It is not a backup hour now. New relay status (true/false): " + invertedOff);
        for (let i = 0; i < SETTINGS.RelayNumbers.length; i++) {
            Shelly.call("Switch.Set", "{ id:" + SETTINGS.RelayNumbers[i] + ", on:" + invertedOff + "}", null, null);
        }
        Executed = false;
    }
}