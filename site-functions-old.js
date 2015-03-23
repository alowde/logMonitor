        function renderNew(numRows) {

            if ($("#title").next().length == 0) { return true; };       // Confirm the DOM isn't empty

            // First we need to find out the maximum row ID currently displayed
            // We'll use JQuery to get the first element after the title row
            var currentMaxDisplay = ($("#title").next().attr('id')).substring(3);

            //$.each(recordSet, function (key, data) {    // Really should be a for...next loop rather than iterating through the entire array
                                                        // Needs to be refactored
            for (i=0;;i++) {
                if ((parseInt(recordSet[key].ID) > currentMaxDisplay) && (parseInt(recordSet[key].ID) <= (parseInt(currentMaxDisplay) + numRows))) {
                    $("#title").after("<tr id=\"row" + recordSet[key].ID + "\">");
                    $.each(recordSet[key], function (id, value) {
                        if (id != "scanned" && id != "processed" && id != "priority") {
                            $("#row" + recordSet[key].ID).append("<td id=\"" + id + "\">" + value + "</td>");
                        };
                    });
                    $("#row" + recordSet[i].ID).append("<td class=\"upArrow\" id=\"up" + recordSet[i].ID + "\">&nbsp&nbsp</td>");               // Ad
                    $("#row" + recordSet[i].ID).append("<td class=\"downArrow\" id=\"down" + recordSet[i].ID + "\">&nbsp&nbsp</td>");   // Add a cell
                };
            //});
            }
        };


        // Requests new rows from the server and adds them to the end of the data array

        function requestNew(numRows, callback) {

            // If there's no records yet, just start at 0
            arrayMaxValue = recordSet[(recordSet.length -1)] ? recordSet[(recordSet.length - 1)].ID : 0;
                                                        // Storing the array length before we start modifying it
            var arrayLength = recordSet.length;         // prevents interesting issues with checking the length while changing it
            $.getJSON("response.php", {
                    command: "getMessagesNew",
                    minID: arrayMaxValue,
                    offset: numRows
                },
                function (data) {
                    $.each(data, function (key, rowObject) {
                        console.log("Now setting key: " + key);
                        console.log("Setting recordSet position: " + (arrayLength +key));
                        recordSet[arrayLength + key] = $.parseJSON(rowObject);
                    });
                    if (callback) { renderNew(50); };   // POTENTIAL BUG! If we get more than 50 rows between the newMsgISR interval we'll have issue
                                                        // May need to re-think limiting renderNew
                }
            );
        };

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
                    if (callback) { renderOld(30); };           // Yeah, yeah, this should really be a callback on complete instead of munged into th

                }
            );
        };

        // Gets rows from the data array and adds to the end of the currently shown list

        function renderOld(numRows) {

                // First we need to find out the minimum row ID currently displayed
                // We'll use JQuery to get the last <tr>

            var currentMinDisplay = ($("tr").last().attr('id').substring(3));

            for (i=0;;i++) {

                if (recordSet[i].ID == currentMinDisplay) { break; }; // Breaking the loop manually if we hit the current minimum. Maybe change later

                $("#row" + currentMinDisplay).after("<tr id=\"row" + recordSet[i].ID + "\">");          // Add the row

                $.each(recordSet[i], function (id, value) {                                             // Add a cell for each non-hidden record fiel
                    if (id != "scanned" && id != "processed" && id != "priority") {
                        $("#row" + recordSet[i].ID).append("<td id=\"" + id + "\">" + value + "</td>");
                    };
                });
                $("#row" + recordSet[i].ID).append("<td class=\"upArrow\" id=\"up" + recordSet[i].ID + "\">&nbsp&nbsp</td>");           // Add a cell
                $("#row" + recordSet[i].ID).append("<td class=\"downArrow\" id=\"down" + recordSet[i].ID + "\">&nbsp&nbsp</td>");       // Add a cell

            };
        };

        // Initialisation function, calls server and fills our initial table data

        function initialiseTable() {
            $.getJSON("response.php", {
                    command: "getDbLen"
                },

                function (dbLength) {
                    console.log(dbLength);
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
                                $("#title").after("<tr id=\"row" + recordSet[key].ID + "\">");
                                $.each(recordSet[key], function (id, value) {
                                    if (id != "scanned" && id != "processed" && id != "priority") {
                                        $("#row" + recordSet[key].ID).append("<td id=\"" + id + "\">" + value + "</td>");
                                    };
                                });
                                $("#row" + recordSet[key].ID).append("<td class=\"upArrow\" id=\"up" + recordSet[key].ID + "\">&nbsp&nbsp</td>");
                                $("#row" + recordSet[key].ID).append("<td class=\"downArrow\" id=\"down" + recordSet[key].ID + "\">&nbsp&nbsp</td>");

                            });
                        }
                    );
            });
        }

