import scribe from './node_modules/scribe.js-ocr/scribe.js';

function runFlowChart(epSeptal, epLateral, EeSeptal, EeLateral, averageEe, LAVI, TRVelocity, EA){
    let final = "ERROR";

    let stageOneMarkerCount = 0;

    let reducedEp = false
    let EeHigh = false
    let TRVelocityHigh = false

    let isEALow = false
    let isEAHigh = false

    //graphic 1 marker checking, also marks stage 2 markers 1 and 2 if it finds them
    if (epSeptal <= 6 || epLateral <= 7 || (epSeptal + epLateral) <= 13) {
        stageOneMarkerCount += 1;
        reducedEp = true
        console.log("Reduced e' velocity");
    }
    if (averageEe > 14) {
        stageOneMarkerCount += 1;
        EeHigh = true
        console.log("High average E/e'");
    }
    if (LAVI > 34) {
        stageOneMarkerCount += 1;
        console.log("High LAVI");
    }
    if (EA <= 0.8) {
        stageOneMarkerCount += 1;
        isEALow = true;
        console.log("E/A low");

    } else if (EA >= 2) {
        stageOneMarkerCount += 1;
        isEAHigh = true
        console.log("E/A high");
    }
    
    //stage 1 marker count
    if (stageOneMarkerCount >= 2) {
        console.log("dysfunction present", stageOneMarkerCount);
        //found dysfunction, start checking graphic 2
        
        //graphic 2 marker 2 and 3 checking
        if (EeSeptal >= 15 || EeLateral >= 13) {
            EeHigh = true;
        }
        if (TRVelocity >= 2.8) {
            TRVelocityHigh = true;
        }
        console.log("reduced e': " + reducedEp + ", E/e' high: " + EeHigh + ", TR velocity high: " + TRVelocityHigh);
        console.log("is E/A high: " + isEAHigh + ", is E/A low: " + isEALow)

        //graphic 2 solving
        if (reducedEp && EeHigh && TRVelocityHigh) {
            if (isEAHigh) {
                final = "grade 3"
            } else {
                final = "grade 2"
            }
        } else if (EeHigh || TRVelocityHigh) {
            final = "purple zone"
        } else if (reducedEp) {
            if (isEALow) {
                final = "grade 1"
            } else {
                final = "purple zone"
            }
        } else {
            final = "normal";
        }
    } else {
        console.log("dysfunction NOT present", stageOneMarkerCount);
        final = "normal";
    }

    console.log(final);
    return final;
}

/*== Scribe stuff ==*/

//detect image upload and show it
const imageInputElement = document.getElementById("ImageInput");

//const uploadedImageElement = document.getElementById("UploadedImage");
const outputElem = document.getElementById("output");

imageInputElement.addEventListener("change", async () => {
    if (!imageInputElement.files) return;

    console.log("recieved image");
    //const text = await scribe.extractText(imageInputElement.files, ['eng'], 'txt');
    //console.log(text);
    outputElem.value = "Loading...";
    console.log(outputElem);
    //console.log("basic text extraction done");
    console.log("starting advanced");

    // if you want more control (you do), "use `init`, `importFiles`, `recognize`, and `exportData` separately." scribe.js, line 85
    const ocrParams = { anyOk: false, vanillaMode: false, langs: ['eng'] };
    scribe.init({ ocr: true, ocrParams });
    console.log(imageInputElement.files);
    await scribe.importFiles(imageInputElement.files);
    await scribe.recognize(ocrParams.langs);
    const ocrExport = scribe.exportData('txt');
    console.log(ocrExport);

    //string modification
    const cullCharacters = [`~`,`(`,`)`,` `,`-`,`—`,`–`,`_`,"'",`=`,`+`,`,`,`{`,`}`,`“`,`”`,`»`,`¢`,`‘`,`’`,`!`,`:`,`[`,`]`,`§`,`<`,`>`,`*`,``,``,``,``,``,``]

    //get ocr export as string
    let ocrString = (await ocrExport).valueOf();
    
    //remove cull characters, which are all useless
    for (let i = 0; i < cullCharacters.length; i++) {
        ocrString = ocrString.replaceAll(cullCharacters[i], "");
    }

    //split into array by newlines
    let ocrStringArray = ocrString.split("\n");
    //remove \n from original string
    //ocrString = ocrString.replaceAll("\n", "");

    let modifiedOcrStringArray = new Array();
    //remove entries that are too short to contain useful data
    for (let i = 0; i < ocrStringArray.length; i++) {
        if (ocrStringArray[i].length > 2) {
            modifiedOcrStringArray.push(ocrStringArray[i]);
        }
    }
    
    //console.log(ocrString);
    console.log(ocrStringArray);
    console.log(modifiedOcrStringArray);
    //console.log(modifiedOcrStringArray.toString());
    
    //next: take the modified string array, cut the fluff! if you can't find a data label (ex: mveseptal) in it or any number, remove the entry
    
    //things to search for
    const dataLabels = ["MVE/EMean", "MVESeptal", "LAVolIndex", "MVELateral", "TRVelocity", "MVAVmax", "MVEVmax", "MVE/A", "LVEF"]
    const numbersArray = ["1","2","3","4","5","6","7","8","9","0"]

    modifiedOcrStringArray.forEach((currentValue, index) => {
        let hasLabel = false;
        let hasNum = false;
        //search for labels
        dataLabels.forEach((dataValue) => {
            if (modifiedOcrStringArray[index].toString().match(dataValue)) {
                hasLabel = true
            }
        });
        //search for numbers
        numbersArray.forEach((numberValue) => {
            if (modifiedOcrStringArray[index].toString().match(numberValue)) {
                hasNum = true
            }
        });

        if (!hasLabel && !hasNum) {
            //we use delete to leave the index values intact and remove the holes delete leaves later
            delete modifiedOcrStringArray[index]
        }
    })

    console.log(modifiedOcrStringArray);

    //removing holes in array
    for (let i = 0; i < modifiedOcrStringArray.length; i++) {
        //we are actively changing the array length, break if you exceed it
        if (i >= modifiedOcrStringArray.length) { break; }
        //if the array slot has something, skip, else splice out the slot and set i back by 1
        if (modifiedOcrStringArray[i]) {} else {
            modifiedOcrStringArray.splice(i, 1);
            i = i - 1
        }
    }
    
    outputElem.value = modifiedOcrStringArray.toString().replaceAll(",", "\n");
    console.log(modifiedOcrStringArray);
    console.log(modifiedOcrStringArray.toString().replaceAll(",", "\n"));
})

//read button click in module
const buttonElement = /** @type {HTMLInputElement} */ (document.getElementById('inputButton'));;
//console.log(buttonElement)
buttonElement.addEventListener("click", update)

/*== Scribe stuff end ==*/

function update() {
    //console.log(document.getElementById("ImageInput"));
    //console.log(document.getElementById("ImageInput").value);

    let finalResult, warningResult
    const warningArray = []

    //all variables and their html input ids
    const variableInput = {
        epSeptal: "epSeptal",
        epLateral: "epLateral",
        EeSeptal: "EeSeptal",
        EeLateral: "EeLateral",
        averageEe: "averageEe",
        LAVI: "LAVI",
        TRVelocity: "TRVelocity",
        EA: "EA"
    }
    
    const warningTranslation = {
        epSeptal: "e' Septal",
        epLateral: "e' Lateral",
        EeSeptal: "E/e' Septal",
        EeLateral: "E/e' Lateral",
        averageEe: "average E/e'",
        LAVI: "LA Velo Index",
        TRVelocity: "TR Velocity",
        EA: "E/A"
    }

    console.log();
    //get and assign for each variable
    let value
    for (const key of Object.keys(variableInput)) {
        value = document.getElementById(variableInput[key]).value

        //console.log(value, value == "", Number(value), Number.isNaN(Number(value)))
        if (value == "" || Number.isNaN(Number(value))) {
            console.log(variableInput[key] + " undefined")
            //if the value isn't a valid number, ex: empty or is words instead, add warning
            warningArray.push(variableInput[key]);
            variableInput[key] = 0;
        } else {
            console.log(variableInput[key] + " defined and a number: " + Number(value))
            variableInput[key] = Number(value);
        }
    }
    
    //console.log(variableInput["epSeptal"], variableInput["epLateral"], variableInput["EeSeptal"], variableInput["EeLateral"], variableInput["averageEe"], variableInput["LAVI"], variableInput["TRVelocity"], variableInput["EA"]);
    //console.log();

    finalResult = runFlowChart(variableInput["epSeptal"], variableInput["epLateral"], variableInput["EeSeptal"], variableInput["EeLateral"], variableInput["averageEe"], variableInput["LAVI"], variableInput["TRVelocity"], variableInput["EA"]);

    //display missing variable warnings
    let warning = document.getElementById("warnings");
    if (warningArray.length > 0) {
        warningResult = "Warning, missing: |";
        warningArray.forEach(element => {
            warningResult += warningTranslation[element] + "|";
        });
        warning.innerHTML = warningResult;
    }

    //show the result
    let output = document.getElementById("output");
    output.innerHTML = finalResult;
}