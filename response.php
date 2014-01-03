<?php

/*
  response.php
 
  Ashley Lowde 12/2013

  Returns data to the client as requested

*/


//  Adding an error handler for failed connections to database

if (mysqli_connect_errno()) {
    error_log ("DB Connect failed: " . $db_connection( mysqli_connect_error()));
    exit();
} 

//  Returns up to offset rows, the oldest being the row with ID minID
//
//  Expects to have GET variables minID, offset defined
//  Optionally expects minPriority

function returnMessagesNew() {

	//  Start the connection
	$db_connection = new mysqli("localhost", "syslog", "secoifjwe", "syslogng");

	//  Prepare the SQL query and run it against the DB
	$query = "SELECT * FROM syslogng.syslog_messages LIMIT " . $_GET["minID"] . "," . $_GET["offset"] . ";";
	$result = $db_connection->query($query);

	//  Fill a temporary result array with the data retrieved
	while ($row = $result->fetch_array(MYSQLI_ASSOC)) {
	    $rows[] = json_encode($row);
	}

	//  Return JSON (if any results were received)
	
	if (isset($rows)) {
	    print( json_encode(  $rows ));
	};
}

//  Returns up to offset rows, the oldest being the row with ID minID
//
//  Expects to have GET variables maxID, offset defined
//  Optionally expects minPriority

function returnMessagesOld() {

        //  Start the connection
        $db_connection = new mysqli("localhost", "syslog", "secoifjwe", "syslogng");

        //  Prepare the SQL query and run it against the DB
        $query = "SELECT * FROM syslogng.syslog_messages WHERE (ID > " . ((int)$_GET["maxID"] - (int)$_GET["offset"]) . ") AND ( ID < " . $_GET["maxID"] . ");";
        $result = $db_connection->query($query);

        //  Fill a temporary result array with the data retrieved
        while ($row = $result->fetch_array(MYSQLI_ASSOC)) {
            $rows[] = json_encode($row);
        }

        //  Return JSON (if any results were received)

        if (isset($rows)) {
            print( json_encode(  $rows ));
        } else {
	};
}


//  Returns the total number of records in the database

function returnDbLength() {

        $db_connection = new mysqli("localhost", "syslog", "secoifjwe", "syslogng");

        $query = "SELECT COUNT(*) FROM syslogng.syslog_messages";
        $result = $db_connection->query($query);
	$row = $result->fetch_assoc();	
	
	print( json_encode($row["COUNT(*)"]) );


}


function regexAdd() {

    //  Start the connection
    $db_connection = new mysqli("localhost", "syslog", "secoifjwe", "syslogng");

    //  Query whether we have an identical regex already
    $query = "SELECT * FROM syslogng.regexes WHERE `datestamp` = " . $_GET["datetime"] .
                                               "AND `host` = " . $_GET["host"] .
                                               "AND `program` = " . $_GET["program"] .
                                               "AND `pid` = " . $_GET["pid"] .
                                               "AND `message` = " . $_GET["message"] . ";";

    $result = $db_connection->query($query);

    if (!($result->num_rows > 0)) {
        $query = "INSERT INTO `syslogng`.`regexes` `ID`, `datestamp`, `host`, `program`, `pid`, `message`, `processed`, `priority`) VALUES (NULL, '" .
                  $_GET["datetime"] ."', '". $_GET["host"] ."', '". $_GET["program"]  ."', '". $_GET["pid"]  ."', '". $_GET["message"]  ."', 'NULL', '". $_GET["priority"] ."');";
        $result2 = $db_connection->query($query);
        while ($row = $result2->fetch_array(MYSQLI_ASSOC)) {
            error_log("insert failed" . $row);
        }
    } else {
        error_log("row existed");
    };

}



if (isset( $_GET["command"] )) {
	if ($_GET["command"] == "getDbLen") {

		returnDbLength();
	
	} elseif ( $_GET["command"] == "getMessagesNew") {

		returnMessagesNew();

	} elseif ( $_GET["command"] == "getMessagesOld") {

		returnMessagesOld();

    } elseif ( $_GET["command"] == "regexAdd") {

        regexAdd();
	}
}


?>
