function renderNew(numRows) {

    if ($("#title").next().length == 0) {
        return true;
    } // Confirm the DOM isn't empty

    // First we need to find out the maximum row ID currently displayed
    // We'll use JQuery to get the first element after the title row
    var currentMaxDisplay = ($("#title").next().attr('id')).substring(3); // TODO: rewrite this with one call to jquery selector

    var oldMaxRecordSet;

    // Find where the highest undisplayed record is in the recordSet
    for (var i = (recordSet.length - 1); i > 0; i--) {
        if (recordSet[i].ID == currentMaxDisplay) {
            oldMaxRecordSet = i;
            i = 0;
        }
    }

    for (i = oldMaxRecordSet; i <= oldMaxRecordSet + numRows; i++) { // TODO: add a try...catch loop to handle the TypeError when we try to use undefined recordSets

        $("#title").after("<tr id=\"row" + recordSet[i].ID + "\" onmouseup=\"selectionAdd()\">");
        $.each(recordSet[i], function (id, value) {
            if (id != "scanned" && id != "processed" && id != "priority") {
                $("#row" + recordSet[i].ID).append("<td id=\"" + id + "\">" + value + "</td>");
            }
        });
        //$("#row" + recordSet[i].ID).append("<td class=\"upArrow\" id=\"up" + recordSet[i].ID + "\">&nbsp&nbsp</td>" +
        //    "<td class=\"downArrow\" id=\"down" + recordSet[i].ID + "\">&nbsp&nbsp</td>");
    }
}

// Requests new rows from the server and adds them to the end of the data array
function requestNew(numRows, callback) {

    // If there's no records yet, just start at 0
    arrayMaxValue = recordSet[(recordSet.length - 1)] ? recordSet[(recordSet.length - 1)].ID : 0;
    // Storing the array length before we start modifying it
    var arrayLength = recordSet.length; // prevents interesting issues with checking the length while changing it
    $.getJSON("response.php", {
            command: "getMessagesNew",
            minID: arrayMaxValue,
            offset: numRows
        },
        function (data) {
            $.each(data, function (key, rowObject) {
                recordSet[arrayLength + key] = $.parseJSON(rowObject);
            });
            if (callback) {
                renderNew(50);
            } // POTENTIAL BUG! If we get more than 50 rows between the newMsgISR interval we'll have issue
            // May need to re-think limiting renderNew
        }
    );
}

// Requests old rows from the server and concatenates them to the start of the data array
function requestOld(numRows, callback) {

    // If there's no records yet, just start at 0. If there is, start with the ID of the first record
    var arrayMinValue = recordSet[0] ? recordSet[0].ID : 0;

    var tempArray = [];

    $.getJSON("response.php", {
            command: "getMessagesOld",
            maxID: arrayMinValue,
            offset: numRows
        },
        function (data) {
            $.each(data, function (key, rowObject) {
                tempArray[key] = $.parseJSON(rowObject);
            });
            recordSet = tempArray.concat(recordSet);
            if (callback) {
                renderOld(30);
            } // Yeah, yeah, this should really be a callback on complete instead of munged into th

        }
    );
}

// Gets rows from the data array and adds to the end of the currently shown list
function renderOld(numRows) {

    // First we need to find out the minimum row ID currently displayed
    // We'll use JQuery to get the last <tr>

    var currentMinDisplay = ($("tr").last().attr('id').substring(3));

    for (i = 0;; i++) {

        if (currentMinDisplay == recordSet[i].ID) {
            break;
        } // Breaking the loop manually if we hit the current minimum. Maybe change later

        $("#row" + currentMinDisplay).after("<tr id=\"row" + recordSet[i].ID + "\" onmouseup=\"selectionAdd()\">"); // Add the row

        $.each(recordSet[i], function (id, value) { // Add a cell for each non-hidden record field
            if (id !== "scanned" && id !== "processed" && id !== "priority") {
                $("#row" + recordSet[i].ID).append("<td id=\"" + id + "\">" + value + "</td>");
            }
        });
        //$("#row" + recordSet[i].ID).append("<td class=\"upArrow\" id=\"up" + recordSet[i].ID + "\">&nbsp&nbsp</td>" + // Add a cell
        //    "<td class=\"downArrow\" id=\"down" + recordSet[i].ID + "\">&nbsp&nbsp</td>"); // Add a cell

    }
}

// Initialisation function, calls server and fills our initial table data
function initialiseTable() {
    //noinspection JSHint
    $.getJSON("response.php", {
            command: "getDbLen"
        },

        function (dbLength) {
            $.getJSON("response.php", {
                    command: "getMessagesNew",
                    minID: (dbLength - 30),
                    offset: 30
                },
                function (data) {
                    $.each(data, function (key, rowObject) {
                        recordSet[key + 0] = $.parseJSON(rowObject);
                    });
                    $.each(recordSet, function (key, data) {
                        $("#title").after("<tr id=\"row" + recordSet[key].ID + "\" onmouseup=\"selectionAdd()\">");
                        $.each(recordSet[key], function (id, value) {
                            if (id != "scanned" && id != "processed" && id != "priority") {
                                $("#row" + recordSet[key].ID).append("<td id=\"" + id + "\">" + value + "</td>");
                            }
                        });
                        //$("#row" + recordSet[key].ID).append("<td class=\"upArrow\" id=\"up" + recordSet[key].ID + "\">&nbsp&nbsp</td>" +
                        //    "<td class=\"downArrow\" id=\"down" + recordSet[key].ID + "\">&nbsp&nbsp</td>");

                    });
                }
            );
        });
}

// Removes all highlights from the document
function selectionClear(columnID){

    if (columnID !== undefined) {   // If we've specified a column, just hit that one
        var useless;
    } else {                        // Otherwise run through the entire document
        $("span:first-child").each(function(){  // and for each cell with a span, replace its contents with plain text
            this.parentNode.innerHTML = this.parentNode.textContent;
        });
    }


}

 function selectionCommit(updownvote) {

        var regexToCommit = {       // We create the regex with the default pattern for each field, [match all]
                datetime: '.*',
                host:     '.*',
                facility: '.*',
                pid:      '.*',
                program:  '.*',
                message:  '.*',
                priority: updownvote
        };

    if (updownvote == '1') {
        $('#upArrow').height(80);
        $('#upArrow').css('background-size:', 'auto, 80px');
        console.log("Upsized");
    };

        $("span:first-child").each(function(){                  // For each <span> element that's the first <span> in it's cell
                                                                // I.e., for each cell with a span element
            var cellHTML = this.parentNode.innerHTML;           // Grab the cell HTML
            cellHTML.replace(/([\.\\\+\*\?\[\^\]\$\(\)])/g, '\\$1');    // Escape any regex characters that will mess with us later
            if (cellHTML.match(/^<span class="selection">/)) {                  // If the selected text starts at line start
                cellHTML = cellHTML.replace(/^<span class="selection">/,'^');   // Just remove the first tag
            } else {
                cellHTML = cellHTML.replace(/^.*?<span class="selection">/,'^.*'); // Otherwise remove non-selected text from line start to the first span tag, including the tag
            }
            while (cellHTML.match(/<span class="selection">/)){
                cellHTML = cellHTML.replace(/<\/span>.*?<span class="selection">/,'.*'); // As above for each middle tag
            }
            cellHTML = cellHTML.replace(/<\/span>.*$/,'.*');                  // And again for the final tag
            switch (this.parentNode.attributes['id'].value){
                case "datetime":
                    regexToCommit.datetime = cellHTML;
                    break;
                case "host":
                    regexToCommit.host = cellHTML;
                    break;
                case "facility":
                    regexToCommit.facility = cellHTML;
                    break;
                case "pid":
                    regexToCommit.pid = cellHTML;
                    break;
                case "program":
                    regexToCommit.program = cellHTML;
                    break;
                case "message":
                    regexToCommit.message = cellHTML;
                    break;
                default:
                    // Something fishy is happening - shouldn't have a <td> with different ID
                    console.log("Damnit, Unhygienix - value shouldn't be: "+ rangeObj.startContainer.attributes['id'].value);
            } // Using a switch statement to avoid passing a DOM ID directly
        });

        regexToCommit.command = "regexAdd";

        $.getJSON("response.php", regexToCommit, function (response) {
                    console.log(response);
                }
        );

    }

    function selectionAdd() {

        var workingRowId;
        var rangeObj;                            // The rangeObj object is used specifically when manipulating selected text, can't do it directly
        var selection = window.getSelection ();  // Get the current selected text
        if (!(selection.toString())) {  return;}  // If called when nothing is selected, exit immediately
        rangeObj = selection.getRangeAt(0);      // Create a range object from the selection
        if (rangeObj.endContainer != rangeObj.startContainer) {rangeObj.setEndAfter(rangeObj.startContainer);} // If we have multiple cells selected, adjust the range to only the first cell
        workingRowId = rangeObj.startContainer.parentNode.parentNode.firstChild.innerHTML;
        if (workingRowId != currentRegex.ID) {   // Confirm we're still highlighting the same row
            selectionClear();
            currentRegex.ID = workingRowId;
        }
        var span = document.createElement("span"); // Create a span tag so we can highlight the text for cosmetic purposes
        span.className="selection";              // Set the span to the highlight class
        rangeObj.surroundContents(span);         // Put the span tag on the selected text
        if (rangeObj.startContainer.attributes['id'].value === "ID"){
            selectionClear();
        }
     }

