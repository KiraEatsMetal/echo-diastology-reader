import scribe from './libraries/node_modules/scribe.js-ocr/scribe.js';
//console.log(cv);

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

//prep for showing image upload and ocr results
const imageInputElement = document.getElementById("ImageInput");
const outputTextArea = document.getElementById("OCROutput");
const outputCanvas = document.getElementById("canvasOutput");
const imageHolder = document.getElementById("imageSrc");

//things to search for
const dataLabels = ["LVEF", "MVEEMean", "MVESeptal", "LAVolIndex", "MVELateral", "TRVelocity", "MVAVmax", "MVEA", "MVEVmax", "MVEESeptal", "MVEELateral"]

//key to match data labels to html input fields by id
const dataLabelToHTMLIDTranslator = {        
    MVESeptal: "epSeptal",
    MVELateral: "epLateral",
    MVEEMean: "averageEe",
    LAVolIndex: "LAVI",
    TRVelocity: "TRVelocity",
    MVEA: "EA",   
    MVEESeptal: "EeSeptal",
    MVEELateral: "EeLateral",
}

/*==Image loading stuff==*/
imageInputElement.addEventListener("change", async () => {
    //exit if no files uploaded
    if (!imageInputElement.files) return;
    console.log(imageInputElement.files);
    imageHolder.src = URL.createObjectURL(imageInputElement.files[0]);

    console.log("recieved image, starting scan");
    outputTextArea.value = "Loading...";

    dataLabels.forEach((dataLabel) => {
        if (dataLabelToHTMLIDTranslator[dataLabel]) {
            document.getElementById(dataLabelToHTMLIDTranslator[dataLabel]).value = null;
        }
    })

    //scribeFile(imageInputElement.files)
})
/*==end of mage loading stuff==*/

/*==OpenCV stuff==*/
imageHolder.onload = async () => {
    console.log("starting opencv processing :: ", imageHolder, imageHolder.width, imageHolder.height);
    
    //halve image resolution for better ocr results
    imageHolder.width = imageHolder.width / 2;
    console.log(imageHolder, imageHolder.width, imageHolder.height);
    
    let mat = cv.imread(imageHolder); //reads image from file to cv mat
    //reset image resolution, otherwise subsequent uses have their resolution exponentially halved
    imageHolder.width = imageHolder.width * 2;

    cv.GaussianBlur(mat, mat, {width: 3, height: 3}, 0, 0); //gauss blur
    cv.cvtColor(mat, mat, cv.COLOR_RGBA2GRAY); //grayscale
    cv.normalize(mat, mat, 0, 255, cv.NORM_MINMAX); //normalize
    cv.threshold(mat, mat, 128 + 18, 255, cv.THRESH_BINARY); //convert to black and white image, black/white cutoff is 50% (128) + testing number
    /*
    good test values:
    16, 20, 18
    */
    
    cv.imshow('canvasOutput', mat); //draw to canvas

    //creates image file from canvas output, then feeds file to scribe
    outputCanvas.toBlob(function(blob) {
        console.log("starting blob processing", blob);
        let file = new File([blob], 'canvasImage.png', { type: 'image/png' });
        console.log("blob processing results:", file);
        scribeFile([file])
    }, "image/png")

    mat.delete(); //remove from memory
    imageHolder.src = null; // remove image source since we draw it in the canvas
    console.log("canvas: ", outputCanvas); //adjust width for viewing pleasure
    console.log("finished opencv processing")
}
/*==end of OpenCV stuff==*/
//runs after you upload a file to the image input, specifically after that function feeds it to the image html element and it loads

/*==Scribe stuff and word proccessing==*/
async function scribeFile(filelist) {
    // if you want more control, "use `init`, `importFiles`, `recognize`, and `exportData` separately." scribe.js, line 85
    //start ocr engine
    const ocrParams = { anyOk: false, vanillaMode: false, langs: ['eng'] };
    scribe.init({ ocr: true, ocrParams });
    
    //import and read files
    console.log("scribing files")
    await scribe.importFiles(filelist);

    await scribe.recognize(ocrParams.langs);
    const ocrExport = scribe.exportData('txt');
    console.log("scribed files")
    console.log(ocrExport);

    //string modification
    //get ocr export as string and remove cull characters, which are all useless
    let ocrString = (await ocrExport).valueOf();
    const cullCharacters = [`~`,`(`,`)`,` `,`-`,`—`,`–`,`_`,"'",`=`,`+`,`,`,`{`,`}`,`“`,`”`,`»`,`¢`,`‘`,`’`,`!`,`:`,`[`,`]`,`§`,`<`,`>`,`*`,`/`,`\\`,`?`,``,``,``]
    cullCharacters.forEach((value) => { ocrString = ocrString.replaceAll(value, ""); })

    //split into array by newlines
    let ocrStringArray = ocrString.split("\n");
    console.log(ocrStringArray);

    //remove entries that are too short to contain useful data
    ocrStringArray.forEach((value, index) => {if (value.length <= 2) { delete ocrStringArray[index] }})
    //removing holes in array
    ocrStringArray = removeArrayHoles(ocrStringArray);

    //next: take the string array, cut the fluff! if you can't find a data label (ex: mveseptal) in it or any number, remove the entry    

    ocrStringArray.forEach((currentValue, index) => {
        let hasLabel = false;
        let hasNum = false;
        //search for labels
        dataLabels.forEach((dataLabel) => {
            if (currentValue.match(new RegExp(dataLabel, "i"))) { hasLabel = true; }
        });

        //search for numbers
        if (currentValue.match(/\d/)) { hasNum = true }

        //delete if no number or label found
        if (!hasLabel && !hasNum) {
            //we use delete to leave the index values intact and remove the holes delete leaves later
            delete ocrStringArray[index];
        }
    })

    //removing holes in array
    ocrStringArray = removeArrayHoles(ocrStringArray);

    //add combined string to end of array
    let combinedString = "";
    ocrStringArray.forEach((entry) => {
        combinedString += entry;
    })
    console.log("combined string: ", combinedString);
    ocrStringArray.push(combinedString);
    
    //display results
    outputTextArea.value = ocrStringArray.toString().replaceAll(",", "\n");
    console.log(ocrStringArray);
    console.log(outputTextArea.value);

    dataLabels.forEach((dataLabel) => {
        if (dataLabelToHTMLIDTranslator[dataLabel]) {
            document.getElementById(dataLabelToHTMLIDTranslator[dataLabel]).value = null;
        }
    })

    //find any with both label and value, apply value to matching html input field
    //per entry, search for each data label. if found, look for a number. if found, set that number as the matching html element's value.
    ocrStringArray.forEach((ocrEntry) => {
        dataLabels.forEach((dataLabel) => {
            if (ocrEntry.match(new RegExp(dataLabel, "i"))) {
                //start number search after the location of the found label
                let foundNumber = findFirstNumberInString(ocrEntry.slice(ocrEntry.search(new RegExp(dataLabel, "i"))));
                if (foundNumber && dataLabelToHTMLIDTranslator[dataLabel]) {
                    //found a number for one of the data labels we use
                    document.getElementById(dataLabelToHTMLIDTranslator[dataLabel]).value = foundNumber;
                    console.log("setting " + dataLabel + "/" +  dataLabelToHTMLIDTranslator[dataLabel] + " to " + foundNumber);
                } else if (dataLabelToHTMLIDTranslator[dataLabel]) {
                    //couldn't find a number for a data label we use
                    console.log("no found number for " + dataLabel + "/" + dataLabelToHTMLIDTranslator[dataLabel])
                } else {
                    //we have some data labels that our flowchart doesn't use but we still spot.
                    console.log("does not use " + dataLabel);
                }
            }
        })
    })

    update();
}
/*==end of Scribe stuff and word proccessing==*/

//finds the first consecutive numbers/periods, returns as a float
function findFirstNumberInString(string) {
    let stringLength = string.length;
    let firstNumberPos = string.search(/\d/);

    //if you find a digit in the string, check each consecutive value until it isn't a digit or a dot, creating a string with the number as it goes. Also stops if it finds more than 1 dot in the consecutive number.
    if (firstNumberPos != -1) {
        let numberEndPos = firstNumberPos + 1;
        let numberString = string[firstNumberPos]
        let dotFound = false

        while (numberEndPos < stringLength) {
            if (string[numberEndPos].search(/\d/) != -1) {
                //if the string at this pos is a digit, add to the string
                numberString += string[numberEndPos];
            } else if (string[numberEndPos].indexOf(".") != -1 && dotFound == false) {
                //if the string at this pos is a dot AND you haven't added a dot yet, add to string
                numberString += string[numberEndPos];
                dotFound = true;
            } else {
                //break if not a number digit or if it is a second dot
                break;
            }
            numberEndPos += 1;
        }
        return parseFloat(numberString);
        //the detected number is from firstnumberpos to endnumberpos - 1
    }
    return null;
}

function removeArrayHoles(array) {
    let newArray = [];
    for (let i = 0; i < array.length; i++) {
        //if the array slot has something, add to new array
        if (array[i]) {
            newArray.push(array[i]);
        }
    }
    return newArray;
}

//read button click in module
const buttonElement = /** @type {HTMLInputElement} */ (document.getElementById('inputButton'));;
//console.log(buttonElement)
buttonElement.addEventListener("click", update)

function update() {
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