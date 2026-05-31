import scribe from './libraries/node_modules/scribe.js-ocr/scribe.js';
//console.log(cv);

function runFlowChart(epSeptal, epLateral, EeSeptal, EeLateral, averageEe, LAVI, TRVelocity, EA){
    console.log("RUNNING FLOWCHART")
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

//enter label as key, get array of fragments of that label. you want these to be the shortest fragments unique to the word
const dataLabelFragmentArrays = {
    //LVEF: [], DOES NOT USE
    MVEEMean: [],
    MVESeptal: [],
    LAVolIndex: ["lav", "dex"], //failed: la
    MVELateral: [],
    TRVelocity: ["tr", "velo", "city"], //failed: vel
    //MVAVmax: [], DOES NOT USE
    MVEA: [],
    //MVEVmax: [], DOES NOT USE
    //MVEESeptal: [], not on data
    //MVEELateral: [], not on data
}

//could also go a step further and define letter substitutions to try
/*
ex: trveIocity -> trveLocity, replace i's with l's and test the edited word
define a dict of letters to try swapping (i to l, etc), then FIGURE THIS OUT BEFORE YOU EVEN TRY TO IMPLEMENT THIS, THIS WILL BE A PAIN
*/
const letterSubstitutions = {
    v: ["y"],
    l: ["i"],
    e: ["f"]
}

/*==Image loading stuff==*/
imageInputElement.addEventListener("change", async () => {
    if (!imageInputElement.files) return; //exit if no files uploaded
    //console.log(imageInputElement.files);
    imageHolder.src = URL.createObjectURL(imageInputElement.files[0]); //convert uploaded file to image source so opencv can read and process it

    console.log()
    console.log(":: recieved image, starting scan");
    outputTextArea.value = "Loading...";

    //clear current data labels
    dataLabels.forEach((dataLabel) => {
        if (dataLabelToHTMLIDTranslator[dataLabel]) {
            document.getElementById(dataLabelToHTMLIDTranslator[dataLabel]).value = null;
        }
    })

    //scribeFile(imageInputElement.files)
})
/*==end of image loading stuff==*/

/*==OpenCV stuff==*/
imageHolder.onload = async () => {
    console.log()
    console.log(":: starting opencv processing :: ", imageHolder, imageHolder.width, imageHolder.height);
    
    imageHolder.width = imageHolder.width / 2; //halve image resolution for better ocr results
    //console.log(imageHolder, imageHolder.width, imageHolder.height);
    let imageInput = cv.imread(imageHolder); //reads image from file to cv mat
    imageHolder.width = imageHolder.width * 2; //reset image resolution, otherwise subsequent uses have their resolution exponentially halved

    //adjusting image for better ocr results
    cv.GaussianBlur(imageInput, imageInput, {width: 3, height: 3}, 0, 0); //gauss blur
    cv.cvtColor(imageInput, imageInput, cv.COLOR_RGBA2GRAY); //grayscale
    cv.normalize(imageInput, imageInput, 0, 255, cv.NORM_MINMAX); //normalize
    cv.threshold(imageInput, imageInput, 128 + 18, 255, cv.THRESH_BINARY_INV); //convert to black and white image, black/white cutoff is 50% (128) + testing number
    //good test values: 16, 20, 18

    //gap closing
    cv.dilate(imageInput, imageInput, cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 2))); //thickens lines
    cv.erode(imageInput, imageInput, cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 2))); //thins them
    //doing these in that order closes gaps, reverse order removes small items. ORDER REVERSES IF IMAGE IS BW VS WB

    //box detection adapted from https://towardsdatascience.com/checkbox-table-cell-detection-using-opencv-python-332c57d25171/
    let line_min_width = 15
    //object that defines a horizontal line
    let kernal_h = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(line_min_width, 1)); //[[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]]
    //object that defines a vertical line
    let kernal_v = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(1, line_min_width)); //[[1], [1], [1], [1], [1], [1], [1], [1], [1], [1], [1], [1], [1], [1], [1]]

    //creates two bw images, one with detected vertical lines and one with detected horizontal lines
    let img_bin_h = new cv.Mat();
    cv.morphologyEx(imageInput, img_bin_h, cv.MORPH_OPEN, kernal_h);
    let img_bin_v = new cv.Mat();
    cv.morphologyEx(imageInput, img_bin_v, cv.MORPH_OPEN, kernal_v);

    //merge both images
    let img_bin_final = new cv.Mat();
    cv.add(img_bin_h, img_bin_v, img_bin_final);
    //remove unmerged
    img_bin_h.delete(); //remove from memory
    img_bin_v.delete(); //remove from memory

    //invert image
    cv.bitwise_not(img_bin_final, img_bin_final);
    //fill holes in the boxes
    cv.erode(img_bin_final, img_bin_final, cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5))); //thickens lines
    cv.dilate(img_bin_final, img_bin_final, cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5))); //thins them
    
    //output variables for connectedComponentsWithStats
    let labels = new cv.Mat();
    let stats = new cv.Mat();
    let centroids = new cv.Mat();

    let numLabels = cv.connectedComponentsWithStats(img_bin_final, labels, stats, centroids); //detects boxes, outputs data to previous output variables

    //area sorting variables
    let areaDict = {}
    let areaArray = []
    //adapted from https://github.com/TechStark/opencv-js/pull/119
    for (let i = 1; i < numLabels; i++) {
        const area   = stats.intAt(i, cv.CC_STAT_AREA);
        areaArray.push(area) //add every area to an array
        areaDict[area] = i //and add each area and its index to a dict, so you can get the index from the area later
    }
    areaArray.sort(function(a, b){return b - a}) //sort array from largest to smallest
    
    cv.cvtColor(img_bin_final, img_bin_final, cv.COLOR_GRAY2RGB); //ungrayscale image so we can draw colour it later
    cv.cvtColor(imageInput, imageInput, cv.COLOR_GRAY2RGB); //ungrayscale for same reason

    //LOOK AT ME: what you need to do: make 9 canvases (done), output to them (done), toBlob each of them
    //creates 9 canvases to output crops of the processed input image to
    let outputCanvasArray = []
    for (let i = 0; i < 9; i++) {
        outputCanvasArray[i] = document.createElement("canvas")
        outputCanvasArray[i].id = "box" + i
        let oldCanvas = document.getElementById("box" + i)
        if (oldCanvas) {oldCanvas.remove()}
        document.body.appendChild(outputCanvasArray[i]);
    }
    
    //image cropping from https://docs.opencv.org/3.4/js_basic_ops_roi.html
    let cropRect
    let croppedMat = new cv.Mat()
    //target box is about 1/30 the area of the example images, so cut anything greater than 1/20th the image's area
    //grab the first 9 boxes that are small enough
    let areaThreshold = 20000; //replace this with a non-hardcoded value later, get image length and width, multiply them, get a portion of that area
    let drawnBoxes = 0 //counter for boxes we draw/boxes that fit in the area threshold

    for (let i = 0; i < areaArray.length; i++) {
        if (drawnBoxes > 8) {console.log("drawn 9 target boxes"); break} //stop drawing boxes after you draw the 9 largest that fit in the threshold
        const area = stats.intAt(areaDict[areaArray[i]], cv.CC_STAT_AREA);
        //console.log(area, area < areaThreshold);
        if (true) {
            //get values of the box
            const x      = stats.intAt(areaDict[areaArray[i]], cv.CC_STAT_LEFT);
            const y      = stats.intAt(areaDict[areaArray[i]], cv.CC_STAT_TOP);
            const width  = stats.intAt(areaDict[areaArray[i]], cv.CC_STAT_WIDTH);
            const height = stats.intAt(areaDict[areaArray[i]], cv.CC_STAT_HEIGHT);
            //xy is top right corner, so to get the label plus data box, use a rect from x-width, y to x+width, y+height

            cropRect = new cv.Rect(x-(width*85/100), y, width * 2, height) //create rectangle object of target crop

            if (cropRect.x > 0 && cropRect.height < 100 && area < areaThreshold) {
                console.log("valid rectangle :: " + i, cropRect, "area: " + area)
                
                cv.rectangle(img_bin_final, new cv.Point(x-width,y), new cv.Point(x+width,y+height), new cv.Scalar(125, 125, 0), 2) //draws red box showing crop
                cv.rectangle(img_bin_final, new cv.Point(x,y), new cv.Point(x+width,y+height), new cv.Scalar(0, 255, (1 + drawnBoxes) * (255 / 9)), 2) //draws green box showing detected box
                cv.rectangle(imageInput, new cv.Point(x,y), new cv.Point(x+width,y+height), new cv.Scalar(0, 0, 0), 5) //removes box (fills with black) on image read by opencv
                cv.imshow('debugCanvasOutputOne', img_bin_final); //draw to canvas

                croppedMat = imageInput.roi(cropRect); //output crop of processed image
                cv.imshow("box"+drawnBoxes, croppedMat); //draw crop to target canvas
                drawnBoxes += 1
            } else {
                console.error("invalid rectangle, skipping :: " + i, cropRect, "area: " + area)
                cv.rectangle(img_bin_final, new cv.Point(x,y), new cv.Point(x+width,y+height), new cv.Scalar(125, 0, 0), 2) //draws red box showing detected box
                cv.imshow('debugCanvasOutputOne', img_bin_final); //draw to canvas
            }
        }
    }

    //draw to various canvases
    cv.imshow('canvasOutput', imageInput); //draw to canvas
    cv.imshow('debugCanvasOutputOne', img_bin_final); //draw to canvas

    let fileArray = []
    
    //creates image file from main canvas output, then feeds file to scribe
    /*
    outputCanvas.toBlob(function(blob) {
        console.log()
        console.log(":: starting blob processing main", blob);
        let file = new File([blob], 'canvasImage.png', { type: 'image/png' });
        console.log(":: blob processing results:", file);
        scribeFile([file])
    }, "image/png")
    */

    //creates image files from cropped canvas outputs, then feeds array of files to scribe
    for (let i = 0; i < 9; i++) {
        outputCanvasArray[i].toBlob(function(blob) {
            console.log()
            console.log(":: starting blob processing " + i, blob);
            let file = new File([blob], 'canvasImage' + i + '.png', { type: 'image/png' });
            console.log(":: blob processing results:", file);
            fileArray.push(file)
            if (i == 8) {scribeFile(fileArray)}
        }, "image/png")
    }


    //remove connectedComponentsWithStats output variables
    labels.delete();
    stats.delete();
    centroids.delete();
    //remove shown image mats
    croppedMat.delete();
    imageInput.delete();
    img_bin_final.delete();

    imageHolder.src = null; // remove image source since we draw it in the canvas
    //console.log("canvas: ", outputCanvas); //adjust width for viewing pleasure
    console.log(":: finished opencv processing")
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
    console.log()
    console.log(":: scribing files")
    await scribe.importFiles(filelist);

    await scribe.recognize(ocrParams.langs);
    const ocrExport = scribe.exportData('txt');
    console.log(":: scribed files, processing text:", ocrExport);

    //string modification
    //get ocr export as string and remove cull characters, which are all useless
    let ocrString = (await ocrExport).valueOf();
    const cullCharacters = [`~`,`(`,`)`,` `,`-`,`—`,`–`,`_`,"'",`=`,`+`,`,`,`{`,`}`,`“`,`”`,`»`,`¢`,`‘`,`’`,`!`,`:`,`[`,`]`,`§`,`<`,`>`,`*`,`/`,`\\`,`?`,`;`,`©`,`®`,`«`]
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

    //combines array into a single string, helps find 'lost' label/data pairs that were split across array entries
    let combinedString = "";
    ocrStringArray.forEach((entry) => {
        combinedString += entry;
    })
    //console.log("combined string: ", combinedString);
    //pick one of these! one adds the string to the array, one just replaces the whole array with the string
    //ocrStringArray.push(combinedString);
    //ocrStringArray = [combinedString]
    
    //display results
    outputTextArea.value = ocrStringArray.toString().replaceAll(",", "\n");
    //console.log(ocrStringArray);
    //console.log(outputTextArea.value);

    dataLabels.forEach((dataLabel) => {
        if (dataLabelToHTMLIDTranslator[dataLabel]) {
            document.getElementById(dataLabelToHTMLIDTranslator[dataLabel]).value = null;
        }
    })


    //track found labels so we can log which we didn't find
    //let labelNotFound = ["LVEF", "MVEEMean", "MVESeptal", "LAVolIndex", "MVELateral", "TRVelocity", "MVAVmax", "MVEA", "MVEVmax", "MVEESeptal", "MVEELateral"] //this version has all labels
    let labelNotFound = ["MVEEMean", "MVESeptal", "LAVolIndex", "MVELateral", "TRVelocity", "MVEA"] //this version only has labels we use
    //find any with both label and value, apply value to matching html input field
    //per entry, search for each data label. if found, look for a number. if found, set that number as the matching html element's value.
    //if no number found, check next entry for a number
    //if data label not found, check for fragments of the data label.
    dataLabels.forEach((dataLabel) => {
        let foundValue = false
        ocrStringArray.forEach((ocrEntry) => {
            if (foundValue) {return}
            if (ocrEntry.match(new RegExp(dataLabel, "i"))) { //if data label found
                removeArrayEntry(labelNotFound, dataLabel); //remove label from unfound labels array
                //start number search after the location of the found label
                let foundNumber = findFirstNumberInString(ocrEntry.slice(ocrEntry.search(new RegExp(dataLabel, "i"))));
                if (foundNumber && dataLabelToHTMLIDTranslator[dataLabel]) {
                    foundValue = true
                    //found a number for one of the data labels we use
                    document.getElementById(dataLabelToHTMLIDTranslator[dataLabel]).value = foundNumber;
                    console.log("setting " + dataLabel + "/" +  dataLabelToHTMLIDTranslator[dataLabel] + " to " + foundNumber);

                } else if (dataLabelToHTMLIDTranslator[dataLabel]) {
                    //if you don't find a number, try looking in the array entry after the current ocrEntry
                    let ocrEntryIndex = ocrStringArray.indexOf(ocrEntry) + 1; //get next array entry index
                    if (ocrEntryIndex < ocrStringArray.length) {
                        foundValue = true
                        //if you find a number, set it and log it, otherwise say you found no number
                        foundNumber = findFirstNumberInString(ocrStringArray[ocrEntryIndex]);
                        if (foundNumber) {
                            document.getElementById(dataLabelToHTMLIDTranslator[dataLabel]).value = foundNumber;
                            console.log("setting " + dataLabel + "/" +  dataLabelToHTMLIDTranslator[dataLabel] + " to " + foundNumber + " from next array entry");
                        } else {console.log("no number found in next array entry: " + ocrStringArray[ocrEntryIndex])}

                    } else {console.log("no found number for " + dataLabel + "/" + dataLabelToHTMLIDTranslator[dataLabel] + ", no next array")}
                } else {
                    //we have some data labels that our flowchart doesn't use but we still spot.
                    console.log("does not use " + dataLabel);
                }
            }
        })
    })

    //after checking for full labels, check for fragments of labels not found
    labelNotFound.forEach((dataLabel) => { //for each label we haven't found
        //console.log("searching for fragments of "+ dataLabel)
        let foundValue = false;
        ocrStringArray.forEach((ocrEntry) => { //search each entry
            dataLabelFragmentArrays[dataLabel].forEach((labelFragment) => { //per label fragment
                if (foundValue) {return}
                if (ocrEntry.match(new RegExp(labelFragment, "i"))) { //if we find a fragment
                    removeArrayEntry(labelNotFound, dataLabel); //remove label from unfound labels array
                    let foundNumber = findFirstNumberInString(ocrEntry.slice(ocrEntry.search(new RegExp(labelFragment, "i"))));
                    if (foundNumber) {
                        foundValue = true
                        //found a number for the data label fragment
                        document.getElementById(dataLabelToHTMLIDTranslator[dataLabel]).value = foundNumber;
                        console.log("setting " + dataLabel + "/" +  dataLabelToHTMLIDTranslator[dataLabel] + " to " + foundNumber + " from " + labelFragment);
                    } else {
                        //if you don't find a number, try looking in the array entry after the current ocrEntry
                        let ocrEntryIndex = ocrStringArray.indexOf(ocrEntry) + 1; //get next array entry index
                        if (ocrEntryIndex < ocrStringArray.length) {
                            //look for number, if you find a number, set it and log it
                            foundNumber = findFirstNumberInString(ocrStringArray[ocrEntryIndex]);
                            if (foundNumber) {
                                foundValue = true
                                document.getElementById(dataLabelToHTMLIDTranslator[dataLabel]).value = foundNumber;
                                console.log("setting " + dataLabel + "/" +  dataLabelToHTMLIDTranslator[dataLabel] + " to " + foundNumber + " from " + labelFragment + " from next array entry");
                            } else {console.log("no number found in next array entry: " + ocrStringArray[ocrEntryIndex])} //otherwise say you found no number
                        } else {console.log("no found number for " + dataLabel + "/" + dataLabelToHTMLIDTranslator[dataLabel] + ", no next array")}

                    }
                }
            })
        })
    })

    //adjust set values to account for missed decimals
    //average ee
    //e septal
    //lavi
    //e lateral
    //tr velocity
    let trVeloVal = document.getElementById("TRVelocity").value
    while (trVeloVal > 10) {
        trVeloVal = trVeloVal/10
        document.getElementById("TRVelocity").value = Math.round(trVeloVal * 100)/100
    }
    //e/a
    let eaValue = document.getElementById("EA").value
    while (eaValue > 10) {
        eaValue = eaValue/10
        document.getElementById("EA").value = Math.round(eaValue * 100)/100
    }


    labelNotFound.forEach((missingLabel) => {console.error("could not find " + missingLabel)}) //log all labels you couldn't find
    console.log(":: text processed")
    update(); //run flowchart
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

//takes an array and returns a copy without holes
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

//takes an array and value, removes value from array. not tested with multiple of the same value.
function removeArrayEntry(array, entry) {
    let index = array.indexOf(entry, array);
    if (index > -1) {array.splice(index, 1)}
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
    console.log(":: running flowchart");
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
        warningResult = "Warning, missing: ";
        warningArray.forEach(element => {
            warningResult += warningTranslation[element] + ", ";
        });
        warningResult = warningResult.slice(0, warningResult.length - 2)
        warning.innerHTML = warningResult;
    }

    //show the result
    let output = document.getElementById("output");
    output.innerHTML = finalResult;
    console.log(":: flowchart ran")
}