// Applicaiton constatns
var thermo_url = process.env.Thermo_url;
var thermo_port = 8090;
var prefered_summer_temp = 68;
var prefered_winter_temp = 72;
var debug_on = false;

var http = require('http');
var queryString = require('querystring');
var util = require('util');
//
// Lambda function:
exports.handler = function (event, context) {

    console.log('Running event');
    
    // Control Remot thermostat (3M - CT50) - using API https://lowpowerlab.com/downloads/RadioThermostat_CT50_Honeywell_Wifi_API_V1.3.pdf 
    // End the lambda function when the send function completes.
    CallThermostat(event.to, 'Hello from Lambda Functions!', 
                function (status) { context.done(null, status); });  
};

// Sends an Command to Remote thermostat using the Twilio RadioThermostat API 
// setTemperature: Target temprature to set
// setmode: What mode to set on thermostat ( Heat , Cool etc )
// command: Various commands string based on that send controls to thermostat
// completedCallback(status) : Callback with status message when the function completes.
function CallThermostat(setTemperature,setmode, command, callback) {

    console.log("Prinitng :" + util.format("%s world", "Hello") + " " + process.env.test_env_variable);
    console.log(arguments);
    var messageString="";
    var message = {};
    var options ={};
    
    // if we know the setMode then let's use that 
    // This operations will require 'HTTP POST'
    // Options and headers for the HTTP request   
    if(setmode !== undefined ){
    setTemperature = (typeof setTemperature === "object" || isNaN(setTemperature)) ? setTemperature : parseInt(setTemperature, 10);
    
    if(setmode === "Heat")
    {
        
        message = {
        tmode: 1, 
        t_heat: setTemperature
        };
    }
    else if(setmode === "Cool")
    {
        message = {
        tmode: 2, 
        t_cool: setTemperature
        }; 
    }
    else if(setmode === "heaterOn")
    {
        message = {
        tmode: 1
        };
    }
    else if(setmode === "CoolOn")
    {
        message = {
        tmode: 2
        };
    }    
    else if(setmode === "turnOff")
    {
        message = {
        tmode: 0
        };
    }
    else if(setmode === "turnOn")
    {
        message = {
        tmode: 3
        };
    }    
    else
    {
        message = {
        tmode: 3, 
        t_heat: setTemperature
        };
    }
    
    // JSON Object
    messageString = JSON.stringify(message);
    options = {
        host: thermo_url,
        port: thermo_port,
        path: '/tstat',
        method: 'POST',
        headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(messageString)
                 }
    };
    
    } // If user just sent us temperature but did not gave us mode - we set "AUTO" mode to thermostat and send temperature to thermo stat 
    else if(setTemperature !== undefined && setmode === undefined)
    {
    setTemperature = (typeof setTemperature === "object" || isNaN(setTemperature)) ? setTemperature : parseInt(setTemperature, 10);
    message = {
        tmode: 3, 
        t_heat: setTemperature
        };
        
    //We need to post JSON Object string
    
    messageString = JSON.stringify(message);
    options = {
        host: thermo_url,
        port: thermo_port,
        path: '/tstat',
        method: 'POST',
        headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(messageString)
                 }
    };
    
    }// for get operation 
    else
    {
        options = {
        host: thermo_url,
        port: thermo_port,
        path: '/tstat',
        method: 'GET',
        headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                 }
       };
    }
                    
    

    
    // Setup the HTTP request
    var req = http.request(options, function (res) {
        var stamp3 = new Date();
        res.setEncoding('utf-8');
              
        // Collect response data as it comes back.
        var responseString = '';
        res.on('data', function (data) {
            responseString += data;
        });
        
        // Log the responce received from Twilio.
        // Or could use JSON.parse(responseString) here to get at individual properties.
        res.on('end', function () {
            //Response time math 
            
            // Calculate time in ms for debugging purpose 
            var time_duration_debug_line ="";
            if( debug_on ){
            var stamp4 = new Date();
            var dif = stamp4.getTime() - stamp3.getTime();
            var Seconds_from_T1_to_T2 = dif / 1000;
            var Seconds_Between_Dates = Math.abs(Seconds_from_T1_to_T2);  
            
            time_duration_debug_line = ", it took " + (Seconds_Between_Dates) + " milliseconds to get reply";
            }


            console.log('Thermo Stat Response: ' + responseString);
            console.log('Response code '+ res.statusCode);
            
            var parsedResponse = JSON.parse(responseString);
            
            var sessionAttributes = {};
            var cardTitle = "Default";
            var speechOutput = "Default, message"; //<- This should never go back to user 
            
            var repromptText = "";
            var shouldEndSession = true;
            
              if("getTemp" === command) {
                cardTitle = "Current temperature"
                speechOutput = util.format("Current temprature is %s degrees %s", parsedResponse.temp,time_duration_debug_line);
                //speechOutput = "Current temprature is " + parsedResponse.temp + ", it took " + (Seconds_Between_Dates) + " milliseconds to get reply";
              }
              else if("getCurrentSetting" === command )
              {

                 var mode = getModeFromThermoReply(parsedResponse);
                  
                 var targetTemp = getTargetTempFromTermoReply(mode,parsedResponse);
                 cardTitle = "Current Settings";
                 // if mode is not off then we return room and target temp 
                 if(mode !== "OFF"){
                     
                     console.log("parsedResponse.tstate is :" + parsedResponse.tstate);
                     var values = checkIfWeNeedPrompt(mode,parsedResponse);
                     
                     if(!isEmptyObject(values)){
                     sessionAttributes = values.sessionAttributes;
                     repromptText = values.repromptText;
                     shouldEndSession = values.shouldEndSession;
                     }
                    
                    speechOutput = "Current thermostat mode is : "+ mode +", target temprature is : " +targetTemp + ", current room temprature is " + parsedResponse.temp + time_duration_debug_line;
                 } // Only Room temp to return 
                 else
                 {
                    speechOutput = "Current thermostat mode is : "+ mode +", current room temprature is " + parsedResponse.temp + time_duration_debug_line;
                 }
                 
              } 
              else if("setTemp" == command)
              {   
                  cardTitle = "Thermostat control";
                  // if sucessfull 
                  if(parsedResponse.success === 0){
                    if(setmode === "heaterOn")
                        {
                        speechOutput = "Sucessfully turned ON heater " + time_duration_debug_line;
                        // Ask question back as part of reply - to check settings and if need adjust settings to start A/C
                         sessionAttributes = {"from_heaterOn":true};
                         repromptText = "Would you like to check current settings ?";
                         shouldEndSession = false;
                        }
                    else if(setmode === "CoolOn")
                        {
                        speechOutput = "Sucessfully turned ON A/C " + time_duration_debug_line;
                        // Ask question back as part of reply - to check settings and if need adjust settings to start heater
                         sessionAttributes = {"from_heaterOn":true};
                         repromptText = "Would you like to check current settings ?";
                         shouldEndSession = false;                        
                        }    
                    else if(setmode === "turnOff")
                        {
                        speechOutput = "Sucessfully turned OFF the thermostat " + time_duration_debug_line;
                        }
                    else if(setmode === "turnOn")
                        {
                        speechOutput = "Sucessfully turned ON the thermostat " + time_duration_debug_line;
                        }                        
                    else
                        {
                        speechOutput = "Sucessfully set the temprature to "+ setTemperature + " degrees" + time_duration_debug_line;
                        }
                  }
                  else
                  {   // Rarealy you should see this 
                      speechOutput = "Something went wrrong while sending command to thermostat " + time_duration_debug_line;
                  }
              
              }
          
            
            // Send reply back to Alexa
            callback(sessionAttributes,
                     buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
            
            
        });
    });
    
    // Handler for HTTP request errors.
    req.on('error', function (e) {
        console.error('HTTP error: ' + e.message);
        
        var sessionAttributes = {};
            var cardTitle = "Failed";
            var speechOutput = "Unfortunately, comunication with thermostat request has finished with errors.";
            
            var repromptText = "";
            var shouldEndSession = true;

            callback(sessionAttributes,
                     buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
        
    });
    
    // Send the HTTP request to the Twilio API.
    // Log the message we are sending to Twilio.
    console.log('Radio thermostat API call: ' + messageString);
    req.setTimeout(30000, function(){
    this.abort();
    }.bind(req));
    req.write(messageString);

    
    req.end();

}

// As of now this function saves data in varaibles for Winter or Summer prefered temp , we need to save this in to DB 
function SetpredefinedTemps(setTemperature,weather, callback) {

    // Handler for HTTP request errors.
    
            console.log('Set weather temprature : ' + setTemperature);
            
            if(weather === "summer")
               {
                   console.log("Setting summer temp");
                   prefered_summer_temp = setTemperature;
                   prefered_summer_temp = (typeof setTemperature === "object" || isNaN(setTemperature)) ? setTemperature : parseInt(setTemperature, 10);
                   
               }
            else if(weather === "winter")
            {
                console.log("Setting winter temp");
                prefered_winter_temp = setTemperature;
                prefered_winter_temp = (typeof setTemperature === "object" || isNaN(setTemperature)) ? setTemperature : parseInt(setTemperature, 10);
            }
        
            var sessionAttributes = {};
            var cardTitle = "Set";
            var speechOutput = weather + " temprature set to " + setTemperature;
            
            var repromptText = "";
            var shouldEndSession = true;

            callback(sessionAttributes,
                     buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
        

}

// Route the incoming request based on type (LaunchRequest, IntentRequest,
// etc.) The JSON body of the request is provided in the event parameter.
exports.handler = function (event, context) {
    try {
        console.log("event.session.application.applicationId=" + event.session.application.applicationId);

        /**
         * Uncomment this if statement and populate with your skill's application ID to
         * prevent someone else from configuring a skill that sends requests to this function.
         */
        /*
        if (event.session.application.applicationId !== "amzn1.echo-sdk-ams.app.[unique-value-here]") {
             context.fail("Invalid Application ID");
         }
        */

        if (event.session.new) {
            onSessionStarted({requestId: event.request.requestId}, event.session);
        }

        if (event.request.type === "LaunchRequest") {
            onLaunch(event.request,
                     event.session,
                     function callback(sessionAttributes, speechletResponse) {
                        context.succeed(buildResponse(sessionAttributes, speechletResponse));
                     });
        }  else if (event.request.type === "IntentRequest") {
            onIntent(event.request,
                     event.session,
                     function callback(sessionAttributes, speechletResponse) {
                         context.succeed(buildResponse(sessionAttributes, speechletResponse));
                     });
        } else if (event.request.type === "SessionEndedRequest") {
            onSessionEnded(event.request, event.session);
            context.succeed();
        }
    } catch (e) {
        context.fail("Exception: " + e);
    }
};

/**
 * Called when the session starts.
 */
function onSessionStarted(sessionStartedRequest, session) {
    console.log("onSessionStarted requestId=" + sessionStartedRequest.requestId +
            ", sessionId=" + session.sessionId);
}

/**
 * Called when the user launches the skill without specifying what they want.
 */
function onLaunch(launchRequest, session, callback) {
    console.log("onLaunch requestId=" + launchRequest.requestId +
            ", sessionId=" + session.sessionId);

    // Dispatch to your skill's launch.
    getWelcomeResponse(callback);
   
  
}

/**
 * Called when the user specifies an intent for this skill.
 */
function onIntent(intentRequest, session, callback) {
    console.log("onIntent requestId=" + intentRequest.requestId +
            ", sessionId=" + session.sessionId);

    var intent = intentRequest.intent;
    var intentName = intentRequest.intent.name;
    var setTemperature;
    var mode;
    console.log("!!!!! intent is : "+ intentName);

    if("AMAZON.HelpIntent" === intentName)
    {
        var helpText = "Here are some example commands are :" 
                        + "set the temperature to 76 degrees ,"
                        + "set heat to 76 ,"
                        + "get temperature ,"
                        + "what is room temperature ,"
                        + "get setting ,"
                        + "turn off ,"
                        + "heater on ,"
                        + "AC on";
        var sessionAttributes = {};
        callback(sessionAttributes,
                     buildSpeechletResponse("Help", helpText, "", true));                        

    }
    else if("AMAZON.YesIntent" === intentName){
    
    console.log("Session attributes :" + session.attributes );
    console.log("Session attributes.from_heaterOn :" + session.attributes.from_heaterOn );
    
        if(session.attributes.from_heaterOn === true){
        var command = "getCurrentSetting";
        CallThermostat(setTemperature,mode,command,callback);
        }
        else if(session.attributes.from_tstate_heat === true)
        {
        command = "setTemp";
    
         setTemperature = session.attributes.new_temp_toSet;
         mode = "Heat";
    
        CallThermostat(setTemperature,mode,command,callback);
        }

    }
    else if("AMAZON.NoIntent" === intentName){
        var sessionAttributes = {};
        callback(sessionAttributes,
                     buildSpeechletResponse("Thanks", "Okay ,Thanks", "", true));

    }    
    else if("getTemp" === intentName){
        
    var command = "getTemp";
    
    CallThermostat(setTemperature,mode,command,callback);

    }
    else if("settings" === intentName){
        
    command = "getCurrentSetting";
    
    CallThermostat(setTemperature,mode,command,callback);

    }
    else if("turnOff" === intentName){
        
    command = "setTemp";
    mode = "turnOff";
    
    CallThermostat(setTemperature,mode,command,callback);

    }
    else if("turnOn" === intentName){
        
    command = "setTemp";
    mode = "turnOn";
    
    CallThermostat(setTemperature,mode,command,callback);

    }
    else if("heaterOn" === intentName){
        
    command = "setTemp";
    mode = "heaterOn";
    
    CallThermostat(setTemperature,mode,command,callback);

    } 
    else if("coolOn" === intentName){
        
    command = "setTemp";
    mode = "CoolOn";
    
    CallThermostat(setTemperature,mode,command,callback);

    }     
    else if("setTemp" === intentName){
        
    command = "setTemp";
    
    var setTemperature = intentRequest.intent.slots.setTemperature.value;
    var mode = intentRequest.intent.slots.mode.value;
    var partOfYear = intentRequest.intent.slots.partOfYear.value;
    
    console.log("##### partOfYear is : "+ partOfYear);
    
    
    if(setTemperature === undefined && mode === undefined && partOfYear !== undefined)
    {
        if(partOfYear === "summer")
        {
            setTemperature = prefered_summer_temp;
            mode = "Cool";
        }
        else if(partOfYear === "winter")
        {
            setTemperature = prefered_winter_temp;
            mode = "Heat";
        }
    }
    else if(setTemperature === undefined && mode !== undefined && partOfYear !== undefined)
    {
        if(partOfYear === "summer")
        {
           setTemperature = prefered_summer_temp;
        }
        else if(partOfYear === "winter")
        {
           setTemperature = prefered_winter_temp;
        }
    }
    else if(setTemperature !== undefined && mode === undefined && partOfYear !== undefined)
    {
        if(partOfYear === "summer")
        {
           mode = "Cool";
        }
        else if(partOfYear === "sinter")
        {
           mode = "Heat";
        }
    }
    
    
    console.log("%%%%% setTemperature is : "+ setTemperature);
    console.log("$$$$$ mode is : "+ mode);
    
    CallThermostat(setTemperature,mode,command,callback);

    }
    else if("preferred" === intentName){
        
    var setTemperature = intentRequest.intent.slots.setTemperature.value;
    
    var partOfYear = intentRequest.intent.slots.partOfYear.value;

    console.log("%%%%% setTemperature is : "+ setTemperature);
    
    console.log("##### partOfYear is : "+ partOfYear);
    
    SetpredefinedTemps(setTemperature,partOfYear,callback);

    }
    else {
        throw "Invalid intent";
    }
    
 
}

/**
 * Called when the user ends the session.
 * Is not called when the skill returns shouldEndSession=true.
 */
function onSessionEnded(sessionEndedRequest, session) {
    console.log("onSessionEnded requestId=" + sessionEndedRequest.requestId +
            ", sessionId=" + session.sessionId);
    // Add cleanup logic here
}

    function checkIfWeNeedPrompt(mode,parsedResponse)
    {
                    console.log(arguments); 
                    if(mode === "Heat" && parsedResponse.tstate === 0 ) 
                     {
                 
                    // speechOutput = "Current thermostat mode is : "+ mode +", current room temprature is " + parsedResponse.temp + ", it took " + (Seconds_Between_Dates) + " milliseconds to get reply";
                     sessionAttributes = {"from_tstate_heat":true , "new_temp_toSet": (parsedResponse.temp+2)};
                     repromptText = "Heater is not running , would you like to set new target temprature to " + (parsedResponse.temp + 2) + " ?";
                    shouldEndSession = false;
                     
                    }
                    else if(mode === "Cool" && parsedResponse.tstate === 0 ) 
                     {
                 
                    // speechOutput = "Current thermostat mode is : "+ mode +", current room temprature is " + parsedResponse.temp + ", it took " + (Seconds_Between_Dates) + " milliseconds to get reply";
                     sessionAttributes = {"from_tstate_cool":true , "new_temp_toSet": (parsedResponse.temp-2)};
                     repromptText = "A/C is not running , would you like to set new target temprature to " + (parsedResponse.temp - 2) + " ?";
                     shouldEndSession = false;
                     
                    }
                    else
                    {
                        return {};
                    }
                    
                    console.log("shouldEndSession : " + shouldEndSession);
                    
                return {
                    sessionAttributes: sessionAttributes,
                    repromptText: repromptText,
                    shouldEndSession: shouldEndSession
                };
    }

    function getModeFromThermoReply(parsedResponse)
    {
                 var mode ="";
                 if(parsedResponse.tmode === 1)
                  mode = "Heat";
                 else if(parsedResponse.tmode === 2)
                  mode = "Cool";
                 if(parsedResponse.tmode === 0)
                  mode = "OFF";
                  
                 return mode;
    }

    function getTargetTempFromTermoReply(mode,parsedResponse)
    {
                 var targetTemp = "";
                 if(mode === "Heat")
                    targetTemp = parsedResponse.t_heat;
                 else if(mode === "Cool")
                    targetTemp = parsedResponse.t_cool;
                    
                return targetTemp;
    }
    
    function isEmptyObject(obj) {
        for (var key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
              return false;
            }
        }
    return true;
    }

// --------------- Functions that control the skill's behavior -----------------------



function getWelcomeResponse(callback) {
    // If we wanted to initialize the session to have some attributes we could add those here.
    var sessionAttributes = {};
    var cardTitle = "Welcome";
    var speechOutput = "Thermostat app, using me you can control your Radio Thermostat ?";
    // If the user either does not reply to the welcome message or says something that is not
    // understood, they will be prompted again with this text.
    var repromptText = "Please tell me what action to undertake, for example to get currnet temprature you can say 'get current temprature?'" +
    " or to 'turn on heater and set it to 70 degress!";
    var shouldEndSession = false;

    callback(sessionAttributes,
             buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
}
// --------------- Helpers that build all of the responses -----------------------

function buildSpeechletResponse(title, output, repromptText, shouldEndSession) {
    return {
        outputSpeech: {
            type: "PlainText",
            text: output
        },
        card: {
            type: "Simple",
            title: "SessionSpeechlet - " + title,
            content: "SessionSpeechlet - " + output
        },
        reprompt: {
            outputSpeech: {
                type: "PlainText",
                text: repromptText
            }
        },
        shouldEndSession: shouldEndSession
    };
}

function buildResponse(sessionAttributes, speechletResponse) {
    return {
        version: "1.0",
        sessionAttributes: sessionAttributes,
        response: speechletResponse
    };
}