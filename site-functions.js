function Record(ID, datetime, host, program, pid, message, priority, processed, scanned) {
    this.ID = ID;
    this.datetime = datetime;
    this.host = host;
    this.program = program;
    this.pid = pid;
    this.message = message;
    this.priority = priority;
    this.processed = processed;
    this.scanned = scanned;
}
Record.prototype.toHtmlCell = function () {
    return ("<td class='ID'>" + this.ID + "</td> " +
    "<td class='datetime'>" + this.datetime + "</td>" +
    "<td class='host'>" + this.host + "</td>" +
    "<td class='program'>" + this.program + "</td>" +
    "<td class='pid'>" + this.pid + "</td>" +
    "<td class='message'>" + this.message + "</td>");
};

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
        if (recordSet[i].priority  >= document.getElementById("threshold").value) {
            $("#title").after("<tr id=\"row" + recordSet[i].ID + "\" onmouseup=\"selectionAdd()\">");
            $("#row" + recordSet[i].ID).append(recordSet[i].toHtmlCell());
        }
    }
}

// Requests new rows from the server and adds them to the end of the data array
function requestNew(numRows, callback) {

    // If there's no records yet, just start at 0
    var arrayMaxValue = recordSet[(recordSet.length - 1)] ? recordSet[(recordSet.length - 1)].ID : 0;
    // Storing the array length before we start modifying it
    var arrayLength = recordSet.length; // prevents interesting issues with checking the length while changing it
    $.getJSON("response.php", {
            command: "getMessagesNew",
            minID: arrayMaxValue,
            offset: numRows
        },
        function (data) {
            $.each(data, function (key, rowObject) {
                var temp = $.parseJSON(rowObject);
                recordSet[arrayLength + key] = new Record(temp.ID, temp.datetime, temp.host, temp.program, temp.pid, temp.message, temp.priority)
            });
            if (callback) {
                renderNew(50);
            } // POTENTIAL BUG! If we get more than 50 rows between the newMsgISR interval we'll have issue
            // May need to re-think limiting renderNew
        }
    );
}

// Requests old rows from the server and concatenates them to the start of the data array
function requestOld(numRows, renderOnLoad) {

    // If there's no records yet, just start at 0. If there is, start with the ID of the first record
    var arrayMinValue = recordSet[0] ? recordSet[0].ID : 0;

    if (dataInFlight == false) {
        dataInFlight = true;
        $.getJSON("response.php", {
                command: "getMessagesOld",
                maxID: arrayMinValue,
                offset: numRows
            },
            function (data) {
                var tempArray = [];
                $.each(data, function (key, rowObject) {
                    var temp = $.parseJSON(rowObject);
                    tempArray[key] = new Record(temp.ID, temp.datetime, temp.host, temp.program, temp.pid, temp.message, temp.priority)
                });
                recordSet = tempArray.concat(recordSet);
                if (renderOnLoad) {
                    renderOld(30);
                } // Yeah, yeah, this should really be a callback on complete instead of munged into th
                dataInFlight = false;
            }
        );
    }
}

// Gets rows from the data array and adds to the end of the currently shown list
function renderOld(numRows) {

    // First we need to find out the minimum row ID currently displayed
    // We'll use JQuery to get the last <tr>

    var currentMinDisplay = ($("tr").last().attr('id').substring(3));

    for (var i = 0;; i++) {

        // Two ways of doing this, throw a break or calculate ahead of time how many rows we need
        if (currentMinDisplay == recordSet[i].ID) {
            break;
        }
        if (recordSet[i].priority  >= document.getElementById("threshold").value) {
            $("#row" + currentMinDisplay).after("<tr id=\"row" + recordSet[i].ID + "\" onmouseup=\"selectionAdd()\">"); // Add the row
            $("#row" + recordSet[i].ID).append(recordSet[i].toHtmlCell());
        }
    }
}

// Initialisation function, calls server and fills our initial table data
function initialiseTable() {
    //  Make a getJSON call asking for the DB length, and set a callback to process that
    $.getJSON("response.php", {
            command: "getDbLen"
        },
        //  Now we have the DB length, make a getJSON call for newMessages and set a callback to process them
        function (dbLength) {
            $.getJSON("response.php", {
                    command: "getMessagesNew",
                    minID: (dbLength - 30), // TODO: Fix this to support an initial non-zero threshold
                    offset: 30
                },
                // Now we have a response from newMessages, add the resulting data to the table
                function (data) {
                    //  For each element in the returned data strip the packaging JSON and put the result in the recordSet array
                    $.each(data, function (key, rowObject) {
                        // parsing the JSON once for speed
                        var temp = $.parseJSON(rowObject);
                        // Currently we're manually setting the properties of the record. Less flexible than dynamically searching the JSON for matching keys, but eh.
                        recordSet[key + 0] = new Record(temp.ID, temp.datetime, temp.host, temp.program, temp.pid, temp.message, temp.priority)
                    });
                    //  Now iterate through the recordSet array and turn each element into an HTML row
                    $.each(recordSet, function (key, data) {
                        $("#title").after("<tr id=\"row" + recordSet[key].ID + "\" onmouseup=\"selectionAdd()\">");
                        $("#row" + recordSet[key].ID).append(recordSet[key].toHtmlCell());
                    });
                });
            //  Last but not least, now we've finished initialising the page we can enable some timed service routines
            //scrollISRInterval = window.setInterval(scrollISR,200);
            window.setInterval(scrollISR, 200);
            window.setInterval(newMsgISR, 5000);


        }
    );
}




// Removes all highlights from the document
function selectionClear(columnID){

    // Selective clearing of a single column is not yet implemented
    $("span:first-child").each(function(){  // For each cell with a span, replace its contents with plain text
        this.parentNode.innerHTML = this.parentNode.textContent;
    });
}

function selectionCommit(updownvote) {

    var regexToCommit = {       // We create the regex with the default pattern for each field, [match all]
        datetime: '%',
        host:     '%',
        facility: '%',
        pid:      '%',
        program:  '%',
        message:  '%',
        priority: updownvote
    };

    if (updownvote == '1') {
        $('#upArrow').height(80);
        $('#upArrow').css('background-size:', 'auto, 80px');
    }

    $("span:first-child").each(function(){                  // For each <span> element that's the first <span> in it's cell
                                                                // I.e., for each cell with a span element
        var cellHTML = this.parentNode.innerHTML;           // Grab the cell HTML
            cellHTML.replace(/([%_\\])/, '\$1');            // Escape %, _ and \ by adding a \
            if (cellHTML.match(/^<span class="selection">/)) {                  // If the selected text starts at line start
                cellHTML = cellHTML.replace(/^<span class="selection">/,'');   // Just remove the first tag
            } else {
                cellHTML = cellHTML.replace(/^.*?<span class="selection">/,'%'); // Otherwise remove non-selected text from line start to the first span tag, including the tag
            }
            while (cellHTML.match(/<span class="selection">/)){
                cellHTML = cellHTML.replace(/<\/span>.*?<span class="selection">/,'%'); // As above for each middle tag
            }
            cellHTML = cellHTML.replace(/<\/span>.*$/,'%');                  // And again for the final tag
            switch (this.parentNode.attributes['class'].value){
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
                    console.log("Damnit, Unhygienix - value shouldn't be: "+ rangeObj.startContainer.attributes['class'].value);
            } // Using a switch statement to avoid passing a DOM ID directly
        });

        regexToCommit.command = "regexAdd";

        if (document.getElementById("debug-mode").checked) {
            console.log(regexToCommit);
        }
    $.post("response.php", regexToCommit, function (response) {
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
        if (rangeObj.startContainer.attributes['class'].value === "ID"){
            selectionClear();
        }
     }

