////////////////////////////////////////////////////////////////////////
// JSHint configuration                                               //
////////////////////////////////////////////////////////////////////////
/* global engine                                                      */
/* global script                                                      */
/* global midi                                                        */
//////////////////////////////////////////////////////////////////////// 

// This script is for the Numark Party Mix MK2 controller.
// It is based on the work of several authors and has been modified
// to suit the needs of the Rene Smit. (see below)

//              |
//              |
//              V

// Source .js and .xml file
// https://github.com/magtomm/MIXXX-Numark-party-mix-2

//              |
//              |
//              V

// And these are based on 
// based on https://github.com/rylito/mixxx_numark_partymix 
// forked from https://github.com/jagy128/MIXXX-Numarl-party-mix-2

//              |
//              |
//              V

// Based on the script of Ryli Dunlap (rylito)
// https://github.com/rylito/mixxx_numark_partymix

// "Thanks to authors of other scripts used as a reference and to DJ Dexter 
// and DarkPoubelle for the initial PartyMix mappings posted on the forum.""



//////////////////////////////////////////////////////////////////////// 

// === Knobs ===
// Deck 1/2
// Level → Treble
// Treble → Mid
// Filter → Quick effect super knob

// === PADS ===

// HOT CUE
// Deck 1 & 2
// 1-4 Set hotcue 1-4.
// To delete the cue, use the screen (right click on the cue number, click the bin)

// LOOP
// Deck 1 & 2
// 1 Loop start
// 2 Loop end
// 3 Loop halve (only works when quantize is set ON)
// 4 Loop exit (deletes also the loop start)

// Uses the quantize settings of the deck. (the magnet icon)
// If the quantize is set to ON, the loop will be set to the nearest beat.
// When pushing the “wrong” order, behavior might be unpredictable,
// turn the loop of on the screen

// SAMPLE 

// the sampler mode is used as a second loopmode (1,2,4,8 beats)
// to reverse:  change tha name of updateSamplerPadLEDs_ to updateSamplerPadLEDs and vica versa
//              and adjust the (un)comments in PAD_MAPPINGS

// Deck 1 & 2
// 1,2,4 and 8 beats. To unloop, press a second time. To delete the loop, go to loopmode and press 4.


// original:
// Deck 1
// 1-4 Sample 1-4

// Deck 2
// 1-4 Sample 5-8

// Samples are not automatically loaded (anymore) when the bank is empty
// If you hit the pad when the sample is playing, the sample is not stopped
// but restarted, so you can use the samples as drumcomputer

// EFFECT
// Deck 1
// 1 Toggle 1st Effect FX1
// 2 Toggle 2nd Effect FX1
// 3 Toggle 3rd Effect FX1
// 4 Vinyl stop efffect /
// (commented out:Spin back)

// Deck 2
// 1 Toggle 1st Effect FX2
// 2 Toggle 2nd Effect FX2
// 3 Toggle 3rd Effect FX2
// 4 Vinyl stop efffect /
// (commented out:Spin back)

// todo looptightening with the jogwheel https://www.youtube.com/watch?v=sa4hGzYdHwM 3:42


// the sampler mode is used as a second loopmode (1,2,4,8 beats)
// to reverse:  change tha name of updateSamplerPadLEDs_ to updateSamplerPadLEDs and vica versa
//              and adjust the (un)comments in PAD_MAPPINGS


var NumarkPartyMix = function() {

    var SCRATCH_LONGPRESS_DELAY = 0;
    var LIBRARY_LONGPRESS_DELAY = 500;
    var FLASH_DELAY = 200;
    // var USE_FLASH = false;
    var USE_FLASH = true;
    var USE_SAMPLE_BANK = true;

    var RESOLUTION = 300; //// intervalsPerRev - orignal value =300
   
    var RECORD_SPEED = 33 + (1 / 3);  
    var ALPHA = 1.0 / 8; //how rapidly the position guess is corrected
    var BETA = ALPHA / 32; // beta adjusts how rapidly the velocity estimate is corrected.
    var RAMP_DOWN = true;
    var RAMP_UP = false;

    // the resolution of the MIDI control (in intervals per revolution, typically 128.)
    // the speed of the imaginary record at 0% pitch (in revolutions per minute (RPM) typically 33+1/3, adjust for comfort)
    // the alpha-beta filter coefficients (together these affect responsiveness and looseness of the imaginary slip mat):
    // the alpha value for the filter (start with 1/8 (0.125) and tune from there)
    // the beta value for the filter (start with alpha/32 and tune from there)
    // whether you want Mixxx to ramp the deck speed down or to stop instantly. (TRUE for ramping, which is the default.)

    // It’s hard to directly relate alpha and beta to physical things 
    // because they’re coefficients. The alpha-beta filter code that 
    // uses them was lifted from xwax almost exactly. You can read up 
    // on such filters here: en.wikipedia.org/wiki/Alpha_beta_filter 
    // That page mentions that alpha is how rapidly the position guess 
    // is corrected while beta adjusts how rapidly the velocity estimate 
    // is corrected. The article even says that the values are usually 
    // determined experimentally. I’ll add that link to the wiki too 
    // incase others want to know that level of detail
    var ON = 0x7F;
    var OFF = 0x00;
    var DIM = 0x01;
    var FLASH = 0x40; // not recognized by the controller, but used as a flag to flash this with the script

    var SELF = 'SELF';
    var NOOP = 'NOOP';
    var PAD_PRESS = 'PAD_PRESS';

    var PFL_CONTROL = 0x1B;

    var PLAY_BUTTON = 0x00;

    var forEach = function(array, func) {
        for (var i = 0; i < array.length; i++) {
            func(array[i]);
        }
    };

    var lookup = function(dict) {
        iterItems(dict, function(k, v) {
            dict[v] = k;
        });
        return dict;
    };

    

    //begin flash timer;
    var flashTimer = 0;
    var flashVal = DIM;

    var flashSet = {};
    var flashCount = 0;

    var flashLoop = function() {
        try {
            // Add error handling for the flash operation
            flashVal = (flashVal === DIM) ? ON : DIM;
            iterItems(flashSet, function(key, controlBytes) {
                // Add validation to ensure controlBytes is valid
                if (controlBytes && controlBytes.length >= 2) {
                    midi.sendShortMsg(controlBytes[0], controlBytes[1], flashVal);
                }
            });
        } catch (error) {
            // Log error and stop timer if MIDI operations fail
            console.error("Flash timer error:", error);
            if (flashTimer) {
                engine.stopTimer(flashTimer);
                flashTimer = 0;
            }
        }
    };

    var makeFlash = function(statusByte, controlByte) {
        // Ensure parameters are valid
        if (statusByte === undefined || controlByte === undefined) {
            console.error("Invalid parameters for makeFlash:", statusByte, controlByte);
            return;
        }
        
        // Use consistent string key format
        var key = statusByte + ',' + controlByte;
        
        if (!(key in flashSet)) {
            flashSet[key] = [statusByte, controlByte];
            flashCount += 1;

            // Only start timer if not already running
            if (!flashTimer) {
                try {
                    flashTimer = engine.beginTimer(FLASH_DELAY, flashLoop, false);
                } catch (error) {
                    console.error("Failed to start flash timer:", error);
                    flashTimer = 0;
                }
            }
        }
    };

    var stopFlash = function(statusByte, controlByte) {
        // Ensure parameters are valid
        if (statusByte === undefined || controlByte === undefined) {
            return;
        }
        
        // Use consistent string key format
        var key = statusByte + ',' + controlByte;
        
        if (key in flashSet) {
            delete flashSet[key];
            flashCount -= 1;

            // Stop timer when no more items to flash
            if (flashCount <= 0 && flashTimer) {
                try {
                    engine.stopTimer(flashTimer);
                } catch (error) {
                    console.error("Failed to stop flash timer:", error);
                }
                flashTimer = 0;
                flashCount = 0; // Reset to ensure consistency
            }
        }
    };
    //end flash timer

    var deckPadMode = {};

    var padCallbackMappings = {};

    var syncPadLedCallbackHelper = function(group, control, valueByte) {
        var key = [group, control];
        var mappings = padCallbackMappings[key];
        forEach(mappings, function(mapping) {
            if (deckPadMode[mapping.deck] === mapping.modeName) {
                if (valueByte === FLASH) {
                    makeFlash(mapping.statusByte, mapping.controlByte);
                } else {
                    stopFlash(mapping.statusByte, mapping.controlByte); // clear if flashing
                    midi.sendShortMsg(mapping.statusByte, mapping.controlByte, valueByte);
                }
            }
        });
    };


    //used to select relevent pad if callback has multiple mappings
    var syncSelfCallbackHelper = function(group, control, statusByte, controlByte, valueByte) {
        var key = [group, control];
        var mappings = padCallbackMappings[key];
		//var str = JSON.stringify(padCallbackMappings);
		//print(str);
        //forEach(mappings, function(mapping) {
        //    if (deckPadMode[mapping.deck] === mapping.modeName && mapping.statusByte === statusByte && mapping.controlByte === controlByte) {
        //        midi.sendShortMsg(mapping.statusByte, mapping.controlByte, valueByte);
        //    }
        //});
    };

    var padDefProto = {
        getCallbackKeyMappings: function() {
            var callbackKeyMappings = {};
            callbackKeyMappings[[this.group, this.bindingControl]] = function(value, group, control) {
                syncPadLedCallbackHelper(group, control, value ? ON : DIM);
            };
            return callbackKeyMappings;
        },
        handle: function(isPressed) {
            if (this.toggle) {
                if (isPressed) {
                    script.toggleControl(this.group, this.actionControl);
                }
            } else {
                engine.setValue(this.group, this.actionControl, isPressed);
            }
        },
    };

    var padDefCue = function(deck, cueNum) {
        this.group = '[Channel' + deck + ']';
        this.actionControl = 'hotcue_' + cueNum + '_activate';
        this.bindingControl = 'hotcue_' + cueNum + '_enabled';
        this.toggle = false;
    };
    padDefCue.prototype = padDefProto;


    // padDefLoop not used anymore, but kept if you want to use it
    // for the loop buttons, it loops [beatloopNum] counts
    var padDefLoop = function(deck, beatloopNum) {
        this.group = '[Channel' + deck + ']';
        this.actionControl = 'beatloop_' + beatloopNum;
        this.bindingControl = this.actionControl;
        this.toggle = true;
    };
    padDefLoop.prototype = padDefProto;


    var padDefLoopControl = function(deck, controlName) {
        this.group = '[Channel' + deck + ']';
        this.actionControl = controlName;
        this.bindingControl = controlName;
        
        this.toggle = true;
    };
    
       
    
    padDefLoopControl.prototype = {
        getCallbackKeyMappings: function() {
            var callbackKeyMappings = {};
            callbackKeyMappings[[this.group, this.bindingControl]] = function(value, group, control) {
                syncPadLedCallbackHelper(group, control, value ? ON : DIM);
            };
            return callbackKeyMappings;
        },
        

        handle: function(isPressed) {
            if (isPressed) {
                // If trying to set loop endpoint and loop is already active, don't allow it
                if (this.actionControl === 'loop_out' && engine.getValue(this.group, 'loop_enabled')) {
                    //engine.setValue(this.group, this.actionControl, 1);
                    // Do nothing - prevent setting a new loop endpoint when loop is already running
                    return;
                }
                if (this.actionControl === 'loop_in' && engine.getValue(this.group, 'loop_enabled')) {
                    //engine.setValue(this.group, this.actionControl, 1);
                    // Do nothing - prevent setting a new loop endpoint when loop is already running
                    return;
                }
                // If exiting loop, also clear the loop start position
                if (this.actionControl === 'reloop_exit') {
                    engine.setValue(this.group, this.actionControl, 1);
                    // Clear the loop start position after exiting
                    engine.setValue(this.group, 'loop_start_position', -1);
                } else {
                    engine.setValue(this.group, this.actionControl, 1);
                }
            }
        }
    };

    

    var padDefSampler = function(samplerNum) {
        var trackLoaded = {};

        var getCurrentBankedGroup = function() {
            if (USE_SAMPLE_BANK) {
                var bank = engine.getValue(this.group, 'sampler_bank_current'); //0,1,2,3
                return '[Sampler' + ((bank * 4) + samplerNum) + ']'; //4 is num of pads
            }
			return '[Sampler' + samplerNum + ']'; //4 is num of pads
        };

        var trackPlayCallback = function(value, group, control) {
            if (getCurrentBankedGroup() === group) {
                var isLoaded = trackLoaded[group];
				var setLED = OFF;

                if (USE_FLASH && value) {
                    setLED = FLASH;
                } else if ((USE_FLASH && isLoaded && !value) || (!USE_FLASH && value)) {
                    setLED = ON;
                } else if ((USE_FLASH && !isLoaded) || (!USE_FLASH && isLoaded)) {
                    setLED = DIM;
                }

                syncPadLedCallbackHelper(group, control, setLED);
            }
        };

        var trackLoadedCallback = function(value, group, control) {
			trackLoaded[group] = value > 0;
            if (getCurrentBankedGroup() === group) {
                var isLoaded = trackLoaded[group];
                var setLED = ON;

                if (!isLoaded && !USE_FLASH) {
                    setLED = OFF;
                } else if ((isLoaded && !USE_FLASH) || (!isLoaded && USE_FLASH)) {
                    setLED = DIM;
                }

                syncPadLedCallbackHelper(group, control, setLED);
            }
        };

        this.getCallbackKeyMappings = function() {
            var callbackKeyMappings = {};
            for (var i = 0; i < 4; i++) { //number of banks
                var bindingGroup = '[Sampler' + (samplerNum + (i * 4)) + ']'; //number of pads
                callbackKeyMappings[[bindingGroup, 'play']] = trackPlayCallback,
                    /* jshint expr: true */
                    callbackKeyMappings[[bindingGroup, 'track_samples']] = trackLoadedCallback;
                /* jshint expr: false */
            }
            return callbackKeyMappings;
        };

        this.handle = function(isPressed) {
			if (isPressed) {
                var bankedGroup = getCurrentBankedGroup();
				if (engine.getValue(bankedGroup, "track_loaded") === 0) {
                    // Commented OUT
                    // DO NOT LOAD SELECTED TRACK IF BANK IS EMPTY
                    //    engine.setValue(bankedGroup, "LoadSelectedTrack", 1);
                    } else {
                        if (engine.getValue(bankedGroup, "play") === 1) {
                            engine.setValue(bankedGroup, "start_play", 1);
                            // stops the sample if it is playing. If this is
                            // not done, you can not use the samples as drumcomputer
                            //engine.setValue(bankedGroup, "start_stop", 1);
                        } else {
                            engine.setValue(bankedGroup, "start_play", 1);
                        }
                        
                    }
					
            }
        };
    };

    var padDefSampleBank = function(sampleBankNum) {
        // not used anymore.
        var samplerBankChangeCallback = function(value, group, control) {
            var key = [group, control];
            var mappings = padCallbackMappings[key];
            var targetControlByte = PAD_NUM_CONTROL_BYTE['PAD' + (value + 1)];
            forEach(mappings, function(mapping) {
                if (deckPadMode[mapping.deck] === mapping.modeName) {
                    var isActive = mapping.controlByte === targetControlByte;
                    midi.sendShortMsg(mapping.statusByte, mapping.controlByte, isActive ? ON : DIM);
					print("\n\n midi.sendShortMsg(mapping.statusByte, mapping.controlByte, isActive ? ON : DIM);");
                }
            });

            var bankOffset = value * 4;
            for (var i = 1; i <= 4; i++) {
                var bankGroup = '[Sampler' + (bankOffset + i) + ']';
                engine.trigger(bankGroup, 'track_samples');
                engine.trigger(bankGroup, 'play');
            }
        };

        this.getCallbackKeyMappings = function() {
            var callbackKeyMappings = {};
            callbackKeyMappings[['[Deere]', 'sampler_bank_current']] = samplerBankChangeCallback;
            return callbackKeyMappings;
        };

        this.handle = function(isPressed) {
            if (isPressed) {
				print("\n\n\n function(isPressed)");
			    engine.setValue('[Deere]', 'sampler_bank_' + sampleBankNum, 1);
            }
        };
    };

    var padDefNoOp = {
        getCallbackKeyMappings: function() {
            var callbackKeyMappings = {};
            callbackKeyMappings[[SELF, NOOP]] = null;
            return callbackKeyMappings;
        },
        handle: function(isPressed) {},
    };

    var padDefSimpleEffect = function(func) {
        this.getCallbackKeyMappings = function() {
            var callbackKeyMappings = {};
            callbackKeyMappings[[SELF, PAD_PRESS]] = null;
            return callbackKeyMappings;
        };

        this.handle = function(isPressed) {
            func(isPressed);
        };
    };

    var padDefGeneric = function(group, control, toggle) {
        this.group = group;
        this.actionControl = control;
        this.bindingControl = control;
        this.toggle = true;
    };
    padDefGeneric.prototype = padDefProto;



    // Begin pad mappings
    var PAD_MAPPINGS = {
        DECK1: {
            PAD1: {
                CUE: new padDefCue(1, 1),
                // LOOP: new padDefLoop(1, 0.5),
                LOOP: new padDefLoopControl(1, 'loop_in'),
                // SAMPLER: new padDefSampler(1),
		        SAMPLER: new padDefLoop(1, 1),

                EFFECT: new padDefGeneric('[EffectRack1_EffectUnit1_Effect1]', 'enabled'),
            },
            PAD2: {
                CUE: new padDefCue(1, 2),
                // LOOP: new padDefLoop(1, 1),
                LOOP: new padDefLoopControl(1, 'loop_out'),
                // SAMPLER: new padDefSampler(2),
		        SAMPLER: new padDefLoop(1, 2),
                EFFECT: new padDefGeneric('[EffectRack1_EffectUnit1_Effect2]', 'enabled'),
            },
            PAD3: {
                CUE: new padDefCue(1, 3),
                // LOOP: new padDefLoop(1, 2),
                LOOP: new padDefLoopControl(1, 'loop_halve'),
                
                // SAMPLER: new padDefSampler(3),
		        SAMPLER: new padDefLoop(1, 4),
                // EFFECT: new padDefSimpleEffect(function(val) {
                //     engine.brake(1, val);}
                EFFECT: new padDefGeneric('[EffectRack1_EffectUnit1_Effect3]', 'enabled'),
                
            },
            PAD4: {
                CUE: new padDefCue(1, 4),
                // LOOP: new padDefLoop(1, 4),
                LOOP: new padDefLoopControl(1, 'reloop_exit'),
                //SAMPLER: new padDefSampler(4),
		        SAMPLER: new padDefLoop(1, 8),
                EFFECT: new padDefSimpleEffect(function(val) {
                    engine.brake(1, val);}
                //     engine.spinback(1, val);
                )
            },
        },
        DECK2: {
            PAD1: {
                CUE: new padDefCue(2, 1),
                // LOOP: new padDefLoop(2, 0.5),
                LOOP: new padDefLoopControl(2, 'loop_in'),
                //SAMPLER: USE_SAMPLE_BANK ? new padDefSampleBank(1) : padDefNoOp,
                //SAMPLER: new padDefSampler(5),
		        SAMPLER: new padDefLoop(2, 1),
                EFFECT: new padDefGeneric('[EffectRack1_EffectUnit2_Effect1]', 'enabled'),
            },
            PAD2: {
                CUE: new padDefCue(2, 2),
                // LOOP: new padDefLoop(2, 1),
                LOOP: new padDefLoopControl(2, 'loop_out'),
                //SAMPLER: USE_SAMPLE_BANK ? new padDefSampleBank(2) : padDefNoOp,
                //SAMPLER: new padDefSampler(6),
		        SAMPLER: new padDefLoop(2, 2),
                EFFECT: new padDefGeneric('[EffectRack1_EffectUnit2_Effect2]', 'enabled'),
            },
            PAD3: {
                CUE: new padDefCue(2, 3),
                // LOOP: new padDefLoop(2, 2),
                LOOP: new padDefLoopControl(2, 'loop_halve'),
                
                //SAMPLER: USE_SAMPLE_BANK ? new padDefSampleBank(3) : padDefNoOp,
                SAMPLER: new padDefSampler(7),
		        SAMPLER: new padDefLoop(2, 4),

                // EFFECT: new padDefSimpleEffect(function(val) {
                //     engine.brake(2, val);
                // }),
                EFFECT: new padDefGeneric('[EffectRack1_EffectUnit2_Effect3]', 'enabled'),
            },
            PAD4: {
                CUE: new padDefCue(2, 4),
                // LOOP: new padDefLoop(2, 4),
                LOOP: new padDefLoopControl(2, 'reloop_exit'),
                // SAMPLER: USE_SAMPLE_BANK ? new padDefSampleBank(4) : padDefNoOp,
                //SAMPLER: new padDefSampler(8),
		        SAMPLER: new padDefLoop(2, 8),
                EFFECT: new padDefSimpleEffect(function(val) {
                    engine.brake(2, val);
                    //     engine.spinback(2, val);
                }),
            },
        }
    };
    // End pad mappings

    var iterItems = function(obj, func) {
        for (var k in obj) {
            if (!obj.hasOwnProperty(k)) {
                continue;
            }
            func(k, obj[k]);
        }
    };

    var PAD_MODE_CONTROL_BYTE = lookup({
        CUE: 0x00,
        LOOP: 0x0E,
        SAMPLER: 0x0B,
        EFFECT: 0x0F,
    });

    var PAD_NUM_CONTROL_BYTE = lookup({
        PAD1: 0x14,
        PAD2: 0x15,
        PAD3: 0x16,
        PAD4: 0x17,
    });

    var DECK_PAD_CHANNEL = lookup({
        DECK1: 4,
        DECK2: 5,
    });

    var initPads = function() {
        engine.connectControl('[Channel1]', 'play', function(value) {
            NumarkPartyMix.play(0, PLAY_BUTTON, value, 0x90, '[Channel1]');
        });

        engine.connectControl('[Channel2]', 'play', function(value) {
            NumarkPartyMix.play(1, PLAY_BUTTON, value, 0x91, '[Channel2]');
        });

      

        iterItems(PAD_MAPPINGS, function(deck, pads) {
            iterItems(pads, function(pad, modes) {
                iterItems(modes, function(mode, defs) {
                    var deckPadChannel = DECK_PAD_CHANNEL[deck];
                    var statusByte = deckPadChannel + 0x90;
                    var controlByte = PAD_NUM_CONTROL_BYTE[pad];
                    var callbackKeys = defs.getCallbackKeyMappings();
                    iterItems(callbackKeys, function(key, callbackFunc) {
                        var existing = padCallbackMappings[key];
                        if (existing === undefined) {
                            existing = [];
                            padCallbackMappings[key] = existing;
                            var groupAndControl = key.split(',');
                            if (groupAndControl[0] !== SELF) {
                                engine.connectControl(groupAndControl[0], groupAndControl[1], callbackFunc);
                            }
                        }
                        existing.push({
                            'deck': deck,
                            'modeName': mode,
                            'statusByte': statusByte,
                            'controlByte': controlByte
                        });
                    });
                });
            });
        });
    };



    var updateHotCuePadLEDs = function(deckName) {
        var deckNum = (deckName === 'DECK1') ? 1 : 2;
        var status = (deckNum === 1) ? 0x94 : 0x95;

        for (var i = 1; i <= 4; i++) {
            var controlByte = PAD_NUM_CONTROL_BYTE['PAD' + i];
            var cueEnabled = engine.getValue('[Channel' + deckNum + ']', 'hotcue_' + i + '_enabled');
            stopFlash(status, controlByte);
            midi.sendShortMsg(status, controlByte, cueEnabled ? ON : DIM);
        }
    };

    var updateLoopPadLEDs = function(deckName) {
        //   Convert deck name to deck number
        var deckNum = (deckName === 'DECK1') ? 1 : 2;
        var group = '[Channel' + deckNum + ']';

        var loopActive = engine.getValue(group, 'loop_enabled');
        var loopStartPos = engine.getValue(group, 'loop_start_position');
        var loopStartSet = loopStartPos !== -1;

        // Use the correct MIDI channel - matching your original working code
        var status = (deckNum === 1) ? 0x94 : 0x95;
        
        var pad1 = PAD_NUM_CONTROL_BYTE.PAD1;
        var pad2 = PAD_NUM_CONTROL_BYTE.PAD2;
        var pad3 = PAD_NUM_CONTROL_BYTE.PAD3;
        var pad4 = PAD_NUM_CONTROL_BYTE.PAD4;

        // Debug output to see what's happening
        print("Deck " + deckNum + " - loopActive: " + loopActive + ", loopStartPos: " + loopStartPos + ", loopStartSet: " + loopStartSet);

        // Stop any flashing first
        stopFlash(status, pad1);
        stopFlash(status, pad2);
        stopFlash(status, pad3);
        stopFlash(status, pad4);

        if (loopActive) {
            // Loop is active: pad1 (loop_in) and pad2 (loop_out) solid, pad3 (halve) and pad4 (exit) flashing
            print("Setting loop active state for deck " + deckNum);
            midi.sendShortMsg(status, pad1, ON);
            midi.sendShortMsg(status, pad2, ON);
            makeFlash(status, pad3);
            makeFlash(status, pad4);
        } else if (loopStartSet) {
            // Loop start set but not active: pad1 solid, pad2 flashing (can set end), others dim
            print("Setting loop start set state for deck " + deckNum + " Status : " + status );
            midi.sendShortMsg(status, pad1, ON);
            makeFlash(status, pad2);
            midi.sendShortMsg(status, pad3, DIM);
            midi.sendShortMsg(status, pad4, DIM);
        } else {
            // No loop: pad1 flashing (can set start), others dim
            print("Listen to me very well. Setting no loop state for deck " + deckNum);
            print ("Status :"+ status);
            makeFlash(status, pad1);
            midi.sendShortMsg(status, pad2, DIM);
            midi.sendShortMsg(status, pad3, DIM);
            midi.sendShortMsg(status, pad4, DIM);
        }
    };



    var connectLoopLedListeners = function() {
        var deckLoopCallback = function(deckName) {
            return function() {
                if (deckPadMode[deckName] === 'LOOP') {
                    updateLoopPadLEDs(deckName);
                }
            };
        };

        engine.connectControl('[Channel1]', 'loop_enabled', deckLoopCallback('DECK1'));
        engine.connectControl('[Channel1]', 'loop_start_position', deckLoopCallback('DECK1'));
        engine.connectControl('[Channel2]', 'loop_enabled', deckLoopCallback('DECK2'));
        engine.connectControl('[Channel2]', 'loop_start_position', deckLoopCallback('DECK2'));
    };

    var updateEffectPadLEDs = function(deckName) {
        var deckNum = (deckName === 'DECK1') ? 1 : 2;
        var status = (deckNum === 1) ? 0x94 : 0x95;

        for (var i = 1; i <= 4; i++) {
            //var effectGroup = '[EffectRack' + deckNum + '_EffectUnit' + deckNum + '_Effect' + i + ']';
            var effectGroup = '[EffectRack1_EffectUnit' + deckNum + '_Effect' + i + ']';
            var enabled = engine.getValue(effectGroup, 'enabled');
            var controlByte = PAD_NUM_CONTROL_BYTE['PAD' + i];
            stopFlash(status, controlByte); // Clear any flashing just in case
            midi.sendShortMsg(status, controlByte, enabled ? ON : DIM);
        }
    };

    var updateSamplerPadLEDs_ = function(deckName) {
        // used when the sampler mode is used as a sampler mode
        var deckNum = (deckName === 'DECK1') ? 1 : 2;
        var status = (deckNum === 1) ? 0x94 : 0x95;

        for (var i = 1; i <= 4; i++) {
            var samplerNum = deckNum === 1 ? i : i + 4;
            var group = '[Sampler' + samplerNum + ']';

            var playing = engine.getValue(group, 'play');
            var loaded = engine.getValue(group, 'track_loaded');
            var controlByte = PAD_NUM_CONTROL_BYTE['PAD' + i];

            stopFlash(status, controlByte);

            let value;
            if (playing && USE_FLASH) {
                value = ON; // not FLASH
            } else if (loaded) {
                value = DIM;
            } else {
                value = OFF;
            }

            midi.sendShortMsg(status, controlByte, value);
        }
    };

    var updateSamplerPadLEDs = function(deckName) {
        // used when the sampler mode is used as a loop mode (1,2,4,8 beats)
        // this is used to update the LEDS of the pads when sampler mode is used as a loop mode
        var deckNum = (deckName === 'DECK1') ? 1 : 2;
        var group = '[Channel' + deckNum + ']';
        var status = (deckNum === 1) ? 0x94 : 0x95;

        
        var pad1 = PAD_NUM_CONTROL_BYTE.PAD1;
        var pad2 = PAD_NUM_CONTROL_BYTE.PAD2;
        var pad3 = PAD_NUM_CONTROL_BYTE.PAD3;
        var pad4 = PAD_NUM_CONTROL_BYTE.PAD4;

        // Mapping van pad naar beatloop-lengte
        var padLoopLengths = {
            PAD1: 1,
            PAD2: 2,
            PAD3: 4,
            PAD4: 8
        };

        // Stop any flashing first
        stopFlash(status, pad1);
        stopFlash(status, pad2);
        stopFlash(status, pad3);
        stopFlash(status, pad4);

        iterItems(padLoopLengths, function(pad, length) {
            var controlByte = PAD_NUM_CONTROL_BYTE[pad];
            var isActive = engine.getValue(group, 'beatloop_' + length + '_enabled');
            
            midi.sendShortMsg(status, controlByte, isActive ? ON : OFF);
        });
    };

    var connectHotCueLedListeners = function() {
        ['DECK1', 'DECK2'].forEach(function(deckName) {
            var deckNum = (deckName === 'DECK1') ? 1 : 2;
            for (var i = 1; i <= 4; i++) {
                var control = 'hotcue_' + i + '_enabled';
                engine.connectControl('[Channel' + deckNum + ']', control, function() {
                    if (deckPadMode[deckName] === 'CUE') {
                        updateHotCuePadLEDs(deckName);
                    }
                });
            }
        });
    };

    var connectPadModeLedListeners = function() {
        connectLoopLedListeners();
        connectHotCueLedListeners();
        // future: connectHotCueLedListeners(), connectEffectLedListeners(), etc.
    };
    
    this.init = function(id, debugging) {
        connectPadModeLedListeners();

        var pflLED = function(value, group, control) {

            var channel = (group === '[Channel1]') ? 0 : 1;

            if (value) {
                midi.sendShortMsg(0x90 + channel, PFL_CONTROL, ON);
            } else {
                midi.sendShortMsg(0x80 + channel, PFL_CONTROL, OFF);
            }
        };

        //TODO this syntax changes to engine.makeConnection in 2.1
        engine.connectControl('[Channel1]', 'pfl', pflLED);
        engine.connectControl('[Channel2]', 'pfl', pflLED);


        // When you load a new track or use SYNC, Mixxx updates the internal tempo. 
        // But your physical fader hasn't moved yet, so Mixxx waits until you cross 
        // the current value to avoid a sudden tempo jump. That’s soft takeover.
        // engine.softTakeover("[Channel1]", "rate", false);
        // engine.softTakeover("[Channel2]", "rate", false);


     
        initPads();


        // The SysEx message to send to the controller to force the midi controller
        // to send the status of every item on the control surface.
        // 0x00 0x20 0x7F is Serato mfg. ID used in SysEx messages.
        var ControllerStatusSysex = [0xF0, 0x00, 0x20, 0x7F, 0x00, 0xF7];

        // After midi controller receives this Outbound Message request SysEx Message,
        // midi controller will send the status of every item on the
        // control surface. (Mixxx will be initialized with current values)
        //
        // Explanation of Serato's Sysex message is here which helped figure out what Numark
        // was using for this controller:
        // https://www.mixxx.org/wiki/doku.php/serato_sysex
        midi.sendSysexMsg(ControllerStatusSysex, ControllerStatusSysex.length);
    };

    var longPressTimers = {};

    var longPressHelper = function(status, control, delay, onDownCallback, onTimerEndWhileDownCallback, onUpBeforeTimerEndCallback, onUpAfterTimerEndCallback) {
        /*jslint bitwise: true */
        var opcode = status & 0xF0;
        /*jslint bitwise: false */
        var channel = (status - opcode);
        var timerKey = [channel, control];
        var timer = longPressTimers[timerKey];

        var resetTimer = function() {
            longPressTimers[timerKey] = 0;
        };

        var call = function(func) {
            if (func) {
                func();
            }
        };

        if (opcode === 0x80) {
            if (timer) {
                engine.stopTimer(timer);
                resetTimer();
                call(onUpBeforeTimerEndCallback);
            } else {
                call(onUpAfterTimerEndCallback);
            }
        } else if (opcode === 0x90) {
            call(onDownCallback);
            timer = engine.beginTimer(delay, function() {
                resetTimer();
                call(onTimerEndWhileDownCallback);
            }, true);
            longPressTimers[timerKey] = timer;
        }
    };

    this.handlePfl = function(channel, control, value, status, group) {
        engine.setValue(group, 'pfl', value ? 1 : 0);
    };
	
	
	this.play = function(channel, control, value, status, group){
		if(engine.getValue("[Channel" + (channel+1) + "]", "play") === 1) {
			midi.sendShortMsg(0x90+channel, control, ON);
		}
		else {
			midi.sendShortMsg(0x90+channel, control, DIM);
		}
	};
	
    this.setPadMode = function(channel, control, value, status, group) {
        var deck = DECK_PAD_CHANNEL[channel];
        var modeName = PAD_MODE_CONTROL_BYTE[control];
        deckPadMode[deck] = modeName;

        iterItems(padCallbackMappings, function(key, mappings) {
            forEach(mappings, function(bindings) {
                if (bindings.deck === deck && bindings.modeName === modeName) {
                    var groupAndControl = key.split(',');
                    var triggerGroup = groupAndControl[0];
                    var triggerControl = groupAndControl[1];
                    if (triggerGroup !== SELF) {
                        engine.trigger(triggerGroup, triggerControl);
                    } else {
                        syncPadLedCallbackHelper(triggerGroup, triggerControl, triggerControl === NOOP ? OFF : DIM);
                    }
                }
            });
        });

        if (modeName === 'CUE') {
            engine.beginTimer(10, function() {
                updateHotCuePadLEDs(deck);
            }, true);
        }

        if (modeName === 'LOOP') {
            engine.beginTimer(10, function() {
                updateLoopPadLEDs(deck);
            }, true);
        }

        if (modeName === 'EFFECT') {
            engine.beginTimer(10, function() {
                updateEffectPadLEDs(deck);
            }, true);
        }

        if (modeName === 'SAMPLER') {
            engine.beginTimer(10, function() {
                updateSamplerPadLEDs(deck);
            }, true);
        }
    };


    
    this.handlePad = function(channel, control, value, status, group) {
        var deck = DECK_PAD_CHANNEL[channel];
        var modeName = deckPadMode[deck];
        if (modeName === undefined) {
            return;
        }

        var padNum = PAD_NUM_CONTROL_BYTE[control];
        var padDefinition = PAD_MAPPINGS[deck][padNum][modeName];

        padDefinition.handle(value ? 1 : 0);
        
        if (modeName === 'CUE') {// && value) {
            // Small delay to ensure loop state is updated
            engine.beginTimer(10, function() {
                updateHotCuePadLEDs(deck);
            }, true);
        }
        // Update loop LEDs immediately after any loop pad action
        if (modeName === 'LOOP') {// && value) {
            // Small delay to ensure loop state is updated
            engine.beginTimer(10, function() {
                updateLoopPadLEDs(deck);
            }, true);
        }

        if (modeName === 'EFFECT') {
            engine.beginTimer(10, function() {
                updateEffectPadLEDs(deck);
            }, true);
        }

        if (modeName === 'SAMPLER') {
            engine.beginTimer(10, function() {
                updateSamplerPadLEDs(deck);
            }, true);
        }
        syncSelfCallbackHelper(SELF, PAD_PRESS, 0x90 + channel, control, value ? ON : DIM);
    };

    this.scratch = function(channel, control, value, status, group) {

        var stopScratching = function() {
            if (engine.isScratching(script.deckFromGroup(group))) {
                engine.scratchDisable(script.deckFromGroup(group), RAMP_UP);
                midi.sendShortMsg(status, control, DIM);
                return false;
            }
            return true;
        };

        var onDownCallback = function() {
            if (stopScratching()) {
                engine.scratchEnable(script.deckFromGroup(group), RESOLUTION, RECORD_SPEED, ALPHA, BETA, RAMP_DOWN);
                midi.sendShortMsg(status, control, ON);
            }
        };

        longPressHelper(status, control, SCRATCH_LONGPRESS_DELAY, onDownCallback, null, null, stopScratching);
    };

    this.wheelTurn = function(channel, control, value, status, group) {

        // A: For a control that centers on 0:
          var newValue = (value < 64) ? value : value - 128;
          //var newValue = (value - 128);
        // In either case, register the movement
        if (engine.isScratching(script.deckFromGroup(group))) {
            engine.scratchTick(script.deckFromGroup(group), newValue); // Scratch!
        } else {
            engine.setValue(group, 'jog', newValue); // Pitch bend
        }
    };

    //TODO The library functions have been improved greatly in 2.1. Update this to use them. For now, this will do

    var focusSidePane = true;

    this.moveVertical = function(channel, control, value, status, group) {

        var encoderValue = (value == 0x01) ? 1 : -1;

        if (focusSidePane) {
            engine.setValue('[Playlist]', 'SelectPlaylist', encoderValue);
        } else {
            engine.setValue('[Playlist]', 'SelectTrackKnob', encoderValue);
        }
    };

    this.toggleView = function(channel, control, value, status, group) {

        var toggleFocus = function() {
            focusSidePane = !focusSidePane;
        };

        var selectSidebar = function() {
            if (focusSidePane) {
                //TODO this is deprecated in 2.1
                engine.setValue('[Playlist]', 'ToggleSelectedSidebarItem', 1);
            }
        };

        longPressHelper(status, control, LIBRARY_LONGPRESS_DELAY, null, selectSidebar, toggleFocus, null);
    };


    this.shutdown = function() {
		print("\n\n\n shutdown \n\n\n");
        // set modes back to CUE
        var cueByte = PAD_MODE_CONTROL_BYTE.CUE;
        midi.sendShortMsg(0x94, cueByte, ON);
        midi.sendShortMsg(0x95, cueByte, ON);

        // dim pads
        iterItems(PAD_MAPPINGS, function(deck, pads) {
            iterItems(pads, function(pad, modes) {
                midi.sendShortMsg(DECK_PAD_CHANNEL[deck] + 0x90, PAD_NUM_CONTROL_BYTE[pad], DIM);
            });
        });

        forEach([0x90, 0x91], function(deck) {
            // turn off LEDs for sync/play/cue
            forEach([0x00, 0x01, 0x02], function(control) {
                midi.sendShortMsg(deck, control, OFF);
            });

            // dim LEDs for scratch buttons
            midi.sendShortMsg(deck, 0x07, DIM);
        });

        // untoggle (dim) PFL switches
        forEach([0x80, 0x81], function(deck) {
            midi.sendShortMsg(deck, PFL_CONTROL, OFF);
        });
    };
};

NumarkPartyMix = new NumarkPartyMix();
