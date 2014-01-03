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
        $("#row" + recordSet[i].ID).append("<td class=\"upArrow\" id=\"up" + recordSet[i].ID + "\">&nbsp&nbsp</td>" +
            "<td class=\"downArrow\" id=\"down" + recordSet[i].ID + "\">&nbsp&nbsp</td>");
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
        $("#row" + recordSet[i].ID).append("<td class=\"upArrow\" id=\"up" + recordSet[i].ID + "\">&nbsp&nbsp</td>" + // Add a cell
            "<td class=\"downArrow\" id=\"down" + recordSet[i].ID + "\">&nbsp&nbsp</td>"); // Add a cell

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
                        $("#row" + recordSet[key].ID).append("<td class=\"upArrow\" id=\"up" + recordSet[key].ID + "\">&nbsp&nbsp</td>" +
                            "<td class=\"downArrow\" id=\"down" + recordSet[key].ID + "\">&nbsp&nbsp</td>");

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