import scribe from './libraries/node_modules/scribe.js-ocr/scribe.js';

function runFlowChart(epSeptal, epLateral, EeSeptal, EeLateral, averageEe, LAVI, TRVelocity, EA){
    //console.log("RUNNING FLOWCHART")
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
        console.log("Reduced e' velocity (septal <= 6, lateral <= 7, or combined <= 13)");
    }
    if (averageEe > 14) {
        stageOneMarkerCount += 1;
        EeHigh = true
        console.log("High average E/e' (>14)");
    }
    if (LAVI > 34) {
        stageOneMarkerCount += 1;
        console.log("High LAVI (>34)");
    }
    if (EA <= 0.8) {
        stageOneMarkerCount += 1;
        isEALow = true;
        console.log("E/A low (<=0.8)");

    } else if (EA >= 2) {
        stageOneMarkerCount += 1;
        isEAHigh = true
        console.log("E/A high (>=2)");
    }
    
    //stage 1 marker count
    if (stageOneMarkerCount >= 2) {
        console.log("dysfunction present,", stageOneMarkerCount, "markers found");
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
        console.log("dysfunction NOT present,", stageOneMarkerCount, "marker found");
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
//runs after you upload a file to the image input, specifically after that function feeds it to the image html element and it loads
imageHolder.onload = async () => {
    console.log()
    console.log(":: starting opencv processing :: ", imageHolder, imageHolder.width, imageHolder.height);
    
    //imageHolder.width = imageHolder.width / 1; //halve image resolution for better ocr results
    let imageInput = cv.imread(imageHolder); //reads image from file to cv mat
    //imageHolder.width = imageHolder.width * 1; //reset image resolution, otherwise subsequent uses have their resolution exponentially halved
    imageHolder.src = null; // remove image source since we draw it in the canvas
    
    //image adjustement parameters
    let scaleSize = 0.5 //base val 0.5
    let blurSize = Math.round(scaleSize * 6) % 2 == 0 ? Math.round(scaleSize * 6) + 1 : Math.round(scaleSize * 6) //must be a positive odd int, base val 3. round up is safer.
    let gapSizeX = Math.ceil(scaleSize * 6) //6
    let gapSizeY = Math.ceil(scaleSize * 4) //4
    console.log("blur size:" , blurSize, "gap size x and y:", gapSizeX, gapSizeY)
    //var c = ((a < b) ? 'minor' : 'major');

    //adjusting image for better ocr results
    cv.resize(imageInput, imageInput, new cv.Size(), scaleSize, scaleSize, cv.INTER_LINEAR)
    cv.GaussianBlur(imageInput, imageInput, {width: blurSize, height: blurSize}, 0, 0); //gauss blur
    cv.cvtColor(imageInput, imageInput, cv.COLOR_RGBA2GRAY); //grayscale
    cv.imshow('canvasOutput', imageInput); //draw to canvas
    cv.normalize(imageInput, imageInput, 0, 255, cv.NORM_MINMAX); //normalize
    
    cv.imshow('canvasOutput', imageInput); //draw to canvas
    //return

    //auto thresholding
    let thresholdImage = new cv.Mat();
    let thresholdRange = 255 //cannot be greater than 255, can be smaller though
    let maxSteps = 2 //steps to take
    //sets max steps to the power of two required to include the entire threshold range
    let rangefinder = 1; while (rangefinder < thresholdRange) { maxSteps += 1; rangefinder = rangefinder * 2 }

    let stepCount = 0 //steps taken
    let stepSize = 0 //amount to adjust input
    let binarySearchResult = Math.round(thresholdRange/2) //input threshold value

    let measuredWhitePercent = 0 //white pixel percent in the adjusted bw image
    let targetWhitePercent = 8 //compared to measured white percent, tried values: 7

    while (stepCount < maxSteps) {
        cv.threshold(imageInput, thresholdImage, Math.round(binarySearchResult), 255, cv.THRESH_BINARY_INV); //create black and white image from threshold
        measuredWhitePercent = cv.countNonZero(thresholdImage) / (thresholdImage.cols*thresholdImage.rows) * 100 //get white pixel percent

        stepSize = Math.max(1, Math.ceil(thresholdRange / Math.pow(2, stepCount + 1))) //sets step size to an integer >= 1, rounds up
        if (measuredWhitePercent > targetWhitePercent) { binarySearchResult -= stepSize } //too much white
        else if (measuredWhitePercent < targetWhitePercent) { binarySearchResult += stepSize } //not enough white

        //console.log(binarySearchResult, stepSize)
        stepCount += 1
    }

    console.log("white pixel count: ", cv.countNonZero(thresholdImage), "image area: ", thresholdImage.cols*thresholdImage.rows, "\npercentage: ", Math.round(cv.countNonZero(thresholdImage) / (thresholdImage.cols*thresholdImage.rows) * 10000)/100 + "%", "threshold value:", binarySearchResult); //gets percentage of white in the image
    imageInput = thresholdImage

    //gap closing
    let gapSize = new cv.Size(gapSizeX, gapSizeY)
    cv.dilate(imageInput, imageInput, cv.getStructuringElement(cv.MORPH_RECT, gapSize)); //thickens lines, base val 3, 2. must be ints.
    cv.erode(imageInput, imageInput, cv.getStructuringElement(cv.MORPH_RECT, gapSize)); //thins them, base val 3, 2. must be ints.
    //doing these in that order closes gaps, reverse order removes small items. ORDER REVERSES IF IMAGE IS BW VS WB

    //box detection adapted from https://towardsdatascience.com/checkbox-table-cell-detection-using-opencv-python-332c57d25171/
    let line_min_width_h = imageInput.rows/144 //82
    let line_min_width_v = imageInput.rows/75 //27, 35, 65
    console.log("image width:", imageInput.cols, "image height:", imageInput.rows, "\nmin line width/height:", line_min_width_h, line_min_width_v)
    //object that defines a horizontal line
    let kernal_h = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(line_min_width_h, 1)); //[[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]]
    //object that defines a vertical line
    let kernal_v = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(1, line_min_width_v)); //[[1], [1], [1], [1], [1], [1], [1], [1], [1], [1], [1], [1], [1], [1], [1]]

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

    //fill holes in the boxes
    cv.dilate(img_bin_final, img_bin_final, cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(10, 5))); //thickens them
    cv.erode(img_bin_final, img_bin_final, cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(9, 4))); //thins lines
    cv.bitwise_not(img_bin_final, img_bin_final); //invert image
    
    cv.imshow('canvasOutput', imageInput); //draw to canvas
    
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

    //creates 9 canvases to output crops of the processed input image to
    let outputCanvasArray = []
    for (let i = 0; i < 9; i++) {
        let oldCanvas = document.getElementById("box" + i)
        if (oldCanvas) {oldCanvas.remove()}
        outputCanvasArray[i] = document.createElement("canvas")
        outputCanvasArray[i].id = "box" + i
        outputCanvasArray[i].width = 15
        outputCanvasArray[i].height = 1
        document.body.appendChild(outputCanvasArray[i]);
    }

    //grab the first 9 boxes that are small enough
    let areaUpperBound = imageInput.cols*imageInput.rows/36;
    let areaLowerBound = imageInput.cols*imageInput.rows/94;
    let widthThreshold = imageInput.cols/3;
    let heightThreshold = imageInput.rows/4;
    console.log("width, height, area image values:", imageInput.cols, imageInput.rows, imageInput.cols*imageInput.rows, "\nwidth, height, area thresholds:", widthThreshold, heightThreshold, areaUpperBound)

    //image cropping from https://docs.opencv.org/3.4/js_basic_ops_roi.html
    let cropRect
    let croppedMat = new cv.Mat()
    let drawnBoxes = 0 //counter for boxes we draw/boxes that fit in the area threshold

    for (let i = 0; i < areaArray.length; i++) {
        if (drawnBoxes > 8) {console.log("drawn 9 target boxes"); break} //stop drawing boxes after you draw the 9 largest that fit in the threshold
        const area = stats.intAt(areaDict[areaArray[i]], cv.CC_STAT_AREA);
        if (true) {
            //get values of the box
            const x      = stats.intAt(areaDict[areaArray[i]], cv.CC_STAT_LEFT);
            const y      = stats.intAt(areaDict[areaArray[i]], cv.CC_STAT_TOP);
            const width  = stats.intAt(areaDict[areaArray[i]], cv.CC_STAT_WIDTH);
            const height = stats.intAt(areaDict[areaArray[i]], cv.CC_STAT_HEIGHT);
            //xy is top right corner, so to get the label plus data box, use a rect from x-width, y to x+width, y+height

            cropRect = new cv.Rect(x-(width*85/100), y, width*185/100, height) //create rectangle object of target crop
            if (cropRect.x > 0 && area < areaUpperBound && area > areaLowerBound && cropRect.width < widthThreshold && cropRect.height < heightThreshold) {
                console.log("valid rectangle :: " + i, cropRect, "area: " + area)
                cv.rectangle(img_bin_final, new cv.Point(cropRect.x,cropRect.y), new cv.Point(cropRect.x+cropRect.width,cropRect.y+cropRect.height), new cv.Scalar(125, 125, 0), 2) //draws red box showing crop
                cv.rectangle(img_bin_final, new cv.Point(x,y), new cv.Point(x+width,y+height), new cv.Scalar(0, 255, (1 + drawnBoxes) * (255 / 9)), 2) //draws green box showing detected box
                cv.rectangle(imageInput, new cv.Point(x,y), new cv.Point(x+width,y+height), new cv.Scalar(0, 0, 0), 5) //removes box (fills with black) on image read by opencv
                cv.imshow('debugCanvasOutputOne', img_bin_final); //draw to canvas
                //cv.imshow('canvasOutput', imageInput); //draw to canvas

                croppedMat = imageInput.roi(cropRect); //output crop of processed image
                cv.imshow("box"+drawnBoxes, croppedMat); //draw crop to target canvas
                drawnBoxes += 1
            } else {
                console.error("invalid rectangle, skipping :: " + i, cropRect, "area: " + area, "\nrectangle left/start over zero:", cropRect.x > 0, "area too large:", area > areaUpperBound, "area too small:", area < areaLowerBound, "width below threshold:", cropRect.width < widthThreshold, "height below threshold:", cropRect.height < heightThreshold)
                cv.rectangle(img_bin_final, new cv.Point(x,y), new cv.Point(x+width,y+height), new cv.Scalar(125, 0, 0), 2) //draws red box showing detected box
                cv.imshow('debugCanvasOutputOne', img_bin_final); //draw to canvas
                if (area < areaLowerBound) {console.error("below area lower bound"); break}
            }
        }
    }

    //draw to various canvases
    //cv.imshow('canvasOutput', imageInput); //draw to canvas
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
    for (let i = 0; i < drawnBoxes; i++) {
        outputCanvasArray[i].toBlob(function(blob) {
            console.log()
            console.log(":: starting blob processing " + i, blob);
            let file = new File([blob], 'canvasImage' + i + '.png', { type: 'image/png' });
            console.log(":: blob processing results:", file);
            fileArray.push(file)
            if (i == drawnBoxes - 1) {scribeFile(fileArray)} //else {console.log(i, drawnBoxes)}
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
    console.log(":: finished opencv processing")
}
/*==end of OpenCV stuff==*/

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
    ocrStringArray.forEach((value, index) => {if (value.length <= 2) { console.log("removing " + ocrStringArray[index]); delete ocrStringArray[index] }})
    ocrStringArray = removeArrayHoles(ocrStringArray); //removing holes in array

    //enter label as key, get array of fragments of that label. you want these to be the shortest fragments unique to the word
    const dataLabelFragmentArrays = {
        //LVEF: [], DOES NOT USE
        MVEEMean: ["veem", "ean"],
        MVESeptal: ["sep"],
        LAVolIndex: ["lav", "vol", "lin", "dex"], //failed: la
        MVELateral: ["lat", "ral"],
        TRVelocity: ["tr", "velo", "city"], //failed: vel
        //MVAVmax: [], DOES NOT USE
        MVEA: ["vea"],
        //MVEVmax: [], DOES NOT USE
        //MVEESeptal: [], not on data
        //MVEELateral: [], not on data
    }

    //next: take the string array, cut the fluff! if you can't find a data label (ex: mveseptal) in it or any number, remove the entry
    //consider using the fragment system here too?
    ocrStringArray.forEach((currentValue, index) => {
        let hasLabel = false;
        let hasNum = false;
        //search for labels
        dataLabels.forEach((dataLabel) => {
            if (currentValue.match(new RegExp(dataLabel, "i"))) { hasLabel = true; } //found label
            else if (dataLabelFragmentArrays[dataLabel]) {
                dataLabelFragmentArrays[dataLabel].forEach((labelFragment) => {
                    if (currentValue.match(new RegExp(labelFragment, "i"))) { hasLabel = true; } //found label from fragment
                })
            }
            //else check for fragments
        });
        
        if (currentValue.match(/\d/)) { hasNum = true } //search for numbers

        if (!hasLabel && !hasNum) { //delete if no number or label found
            console.log("no num or label found in " + ocrStringArray[index])
            //delete ocrStringArray[index];
        }
    })
    ocrStringArray = removeArrayHoles(ocrStringArray); //removing holes in array
    
    //display results
    outputTextArea.value = ocrStringArray.toString().replaceAll(",", "\n");

    //clear html input zones
    dataLabels.forEach((dataLabel) => {
        if (dataLabelToHTMLIDTranslator[dataLabel]) {
            document.getElementById(dataLabelToHTMLIDTranslator[dataLabel]).value = null;
        }
    })

    //create array to track which strings were used or not
    let usedStringTracker = []
    ocrStringArray.forEach((ocrEntry) => { usedStringTracker.push(false); })

    //track found labels so we can log which we didn't find
    let labelNotFound = ["MVEEMean", "MVESeptal", "LAVolIndex", "MVELateral", "TRVelocity", "MVEA"] //this only has labels we use
    //find label, look for value, apply to input field. if label not found, search for label fragments, look for value, apply.
    dataLabels.forEach((dataLabel) => {
        //console.log("---\nlooking for", dataLabel)
        let foundValue = false

        ocrStringArray.forEach((ocrEntry) => {
            if (foundValue) {return}
            
            if (ocrEntry.match(new RegExp(dataLabel, "i"))) { //if data label found
                //console.log("found", dataLabel, "in", ocrEntry)
                removeArrayEntry(labelNotFound, dataLabel); //remove label from unfound labels array

                let foundNumber = findFirstNumberInString(ocrEntry.slice(ocrEntry.search(new RegExp(dataLabel, "i")))); //start number search after the location of the found label
                if (foundNumber && dataLabelToHTMLIDTranslator[dataLabel]) {
                    
                    foundValue = true //found a number for one of the data labels we use
                    usedStringTracker[ocrStringArray.indexOf(ocrEntry)] = true

                    document.getElementById(dataLabelToHTMLIDTranslator[dataLabel]).value = foundNumber;
                    console.log("setting " + dataLabel + "/" +  dataLabelToHTMLIDTranslator[dataLabel] + " to " + foundNumber);

                } else if (dataLabelToHTMLIDTranslator[dataLabel]) { //if no number, look in the next array entry
                    let ocrEntryIndex = ocrStringArray.indexOf(ocrEntry) + 1;
                    if (ocrEntryIndex < ocrStringArray.length) {

                        foundNumber = findFirstNumberInString(ocrStringArray[ocrEntryIndex]);
                        if (foundNumber) { //if you find a number, set it and log it, otherwise say you found no number

                            foundValue = true //found a number for one of the data labels we use
                            usedStringTracker[ocrEntryIndex - 1] = true
                            usedStringTracker[ocrEntryIndex] = true
                            
                            document.getElementById(dataLabelToHTMLIDTranslator[dataLabel]).value = foundNumber;
                            console.log("setting " + dataLabel + "/" +  dataLabelToHTMLIDTranslator[dataLabel] + " to " + foundNumber + " from next array entry");

                        } else {console.error("no number found for " + dataLabel + "/" + dataLabelToHTMLIDTranslator[dataLabel] + " in own or next array entry: " + ocrStringArray[ocrEntryIndex])}

                    } else {console.error("no found number for " + dataLabel + "/" + dataLabelToHTMLIDTranslator[dataLabel] + ", no next array")}
                    
                } else {console.log("does not use " + dataLabel); foundValue = true;} //we have some data labels that our flowchart doesn't use but we still spot.
            
            } else if (dataLabelFragmentArrays[dataLabel]) { //if you don't find the label and it has fragments...
                dataLabelFragmentArrays[dataLabel].forEach((labelFragment) => { //per label fragment
                    if (foundValue) {return}

                    if (ocrEntry.match(new RegExp(labelFragment, "i"))) { //if we find a fragment
                        //console.log("found", dataLabel, "from fragment", labelFragment, "in", ocrEntry)
                        removeArrayEntry(labelNotFound, dataLabel); //remove label from unfound labels array

                        let foundNumber = findFirstNumberInString(ocrEntry.slice(ocrEntry.search(new RegExp(labelFragment, "i")))); //start number search after the location of the fragment
                        if (foundNumber) {
                            
                            foundValue = true //found a number for the data label fragment
                            usedStringTracker[ocrStringArray.indexOf(ocrEntry)] = true

                            document.getElementById(dataLabelToHTMLIDTranslator[dataLabel]).value = foundNumber;
                            console.log("setting " + dataLabel + "/" +  dataLabelToHTMLIDTranslator[dataLabel] + " to " + foundNumber + " from " + labelFragment);

                        } else { //if no number, look in the next array entry
                            let ocrEntryIndex = ocrStringArray.indexOf(ocrEntry) + 1;
                            if (ocrEntryIndex < ocrStringArray.length) {

                                foundNumber = findFirstNumberInString(ocrStringArray[ocrEntryIndex]);
                                if (foundNumber) { //if you find a number, set it and log it, otherwise say you found no number
                                    
                                    foundValue = true //found a number for the data label fragment
                                    usedStringTracker[ocrEntryIndex - 1] = true
                                    usedStringTracker[ocrEntryIndex] = true

                                    document.getElementById(dataLabelToHTMLIDTranslator[dataLabel]).value = foundNumber;
                                    console.log("setting " + dataLabel + "/" +  dataLabelToHTMLIDTranslator[dataLabel] + " to " + foundNumber + " from " + labelFragment + " from next array entry");

                                } else {console.error("no number found for " + dataLabel + "/" + dataLabelToHTMLIDTranslator[dataLabel] + " in own or next array entry: " + ocrStringArray[ocrEntryIndex])} //otherwise say you found no number

                            } else {console.error("no found number for " + dataLabel + "/" + dataLabelToHTMLIDTranslator[dataLabel] + ", no next array")}
                        }
                    }
                })
            }
        })

        //if we didn't find it yet, per entry do a levenshtein value search
        if (foundValue == false && dataLabelFragmentArrays[dataLabel]) {
            //console.log("search failed, trying levenshtein value search")

            ocrStringArray.forEach((ocrEntry) => {
                //console.log("couldn't find label or fragment of", dataLabel, "in", ocrEntry, "trying levenshtein distance method")
                let labelSlice = ocrEntry
                if (ocrEntry.search(/\d/) > -1) { //if you find a number,
                    labelSlice = ocrEntry.slice(0, ocrEntry.search(/\d/)) //cut entry at number's index to get only the label
                }

                //console.log("lev distance of", dataLabel, "and", labelSlice, "is", levenshteinDistance(dataLabel, labelSlice))
                if (levenshteinDistance(dataLabel, labelSlice) < 2) {
                    //console.log("lev distance of", dataLabel, "and", labelSlice, "is", levenshteinDistance(dataLabel, labelSlice))
                    removeArrayEntry(labelNotFound, dataLabel); //remove label from unfound labels array
                    
                    let foundNumber = findFirstNumberInString(ocrEntry.slice(ocrEntry.search(new RegExp(dataLabel, "i")))); //start number search after the location of the found label
                    if (foundNumber && dataLabelToHTMLIDTranslator[dataLabel]) {
                        
                        foundValue = true //found a number for one of the data labels we use
                        usedStringTracker[ocrStringArray.indexOf(ocrEntry)] = true

                        document.getElementById(dataLabelToHTMLIDTranslator[dataLabel]).value = foundNumber;
                        console.log("levenshtein match found, setting " + dataLabel + "/" +  dataLabelToHTMLIDTranslator[dataLabel] + " to " + foundNumber);

                    } else if (dataLabelToHTMLIDTranslator[dataLabel]) { //if no number, look in the next array entry
                        let ocrEntryIndex = ocrStringArray.indexOf(ocrEntry) + 1;
                        if (ocrEntryIndex < ocrStringArray.length) {

                            foundNumber = findFirstNumberInString(ocrStringArray[ocrEntryIndex]);
                            if (foundNumber) { //if you find a number, set it and log it, otherwise say you found no number

                                foundValue = true //found a number for one of the data labels we use
                                usedStringTracker[ocrEntryIndex - 1] = true
                                usedStringTracker[ocrEntryIndex] = true
                                
                                document.getElementById(dataLabelToHTMLIDTranslator[dataLabel]).value = foundNumber;
                                console.log("levenshtein match found, setting " + dataLabel + "/" +  dataLabelToHTMLIDTranslator[dataLabel] + " to " + foundNumber + " from next array entry");

                            } else {console.error("no number found for " + dataLabel + "/" + dataLabelToHTMLIDTranslator[dataLabel] + " in own or next array entry: " + ocrStringArray[ocrEntryIndex])}

                        } else {console.error("no found number for " + dataLabel + "/" + dataLabelToHTMLIDTranslator[dataLabel] + ", no next array, no levenshtein match")}
                        
                    } else {console.log("does not use " + dataLabel); foundValue = true;} //we have some data labels that our flowchart doesn't use but we still spot.
                }
            })
        }
        
        //console.log(dataLabel, "search end\n---")
    })

    labelNotFound.forEach((missingLabel) => {console.error("could not find " + missingLabel)}) //log all labels you couldn't find
    //log strings we couldn't get data from
    let unusedStrings = []
    for (let i = 0; i < ocrStringArray.length; i++) {
        if (!usedStringTracker[i]) { unusedStrings.push(ocrStringArray[i]) }
    }
    if (unusedStrings.length > 0) { console.error("did not extract data from:", unusedStrings) }

    //adjust set values to account for missed decimals
    //average ee
    let averageEeVal = document.getElementById("averageEe").value
    while (averageEeVal > 50) {
        averageEeVal = averageEeVal/10
        document.getElementById("averageEe").value = Math.round(averageEeVal * 100)/100
    }
    //e septal
    let eSeptalVal = document.getElementById("epSeptal").value
    while (eSeptalVal > 0.4) {
        eSeptalVal = eSeptalVal/10
        document.getElementById("epSeptal").value = Math.round(eSeptalVal * 100)/100
    }
    //lavi
    let laviVal = document.getElementById("LAVI").value
    while (laviVal > 100) {
        laviVal = laviVal/10
        document.getElementById("LAVI").value = Math.round(laviVal * 100)/100
    }
    //e lateral
    let eLateralVal = document.getElementById("epLateral").value
    while (eLateralVal > 0.4) {
        eLateralVal = eLateralVal/10
        document.getElementById("epLateral").value = Math.round(eLateralVal * 100)/100
    }
    //tr velocity
    let trVeloVal = document.getElementById("TRVelocity").value
    while (trVeloVal > 10) {
        trVeloVal = trVeloVal/10
        document.getElementById("TRVelocity").value = Math.round(trVeloVal * 100)/100
    }
    //e/a
    let eaValue = document.getElementById("EA").value
    while (eaValue > 5) {
        eaValue = eaValue/10
        document.getElementById("EA").value = Math.round(eaValue * 100)/100
    }

    console.log(":: text processed")
    update(); //run flowchart
}
/*==end of Scribe stuff and word proccessing==*/


//from: https://www.30secondsofcode.org/js/s/levenshtein-distance/
const levenshteinDistance = (stringOne, stringtwo) => {
  if (!stringOne.length) return stringtwo.length;
  if (!stringtwo.length) return stringOne.length;
  const array = [];
  for (let i = 0; i <= stringtwo.length; i++) {
    array[i] = [i];
    for (let j = 1; j <= stringOne.length; j++) {
      array[i][j] =
        i === 0
          ? j
          : Math.min(
              array[i - 1][j] + 1,
              array[i][j - 1] + 1,
              array[i - 1][j - 1] + (stringOne[j - 1] === stringtwo[i - 1] ? 0 : 1)
            );
    }
  }
  //console.table(array)
  return array[stringtwo.length][stringOne.length];
};

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
            console.error(variableInput[key] + " undefined")
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

    finalResult = runFlowChart(variableInput["epSeptal"]*100, variableInput["epLateral"]*100, variableInput["EeSeptal"], variableInput["EeLateral"], variableInput["averageEe"], variableInput["LAVI"], variableInput["TRVelocity"], variableInput["EA"]);

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