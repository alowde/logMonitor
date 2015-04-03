<?php

/*
  response.php
 
  Ashley Lowde 12/2013

  Returns data to the client as requested

*/


//  Returns up to offset rows, the oldest being the row with ID minID
//
//  Expects to have GET variables minID, offset defined
//  Optionally expects minPriority

function returnMessagesNew() {

	//  Start the connection
	$db_connection = new mysqli("localhost", "syslog", "secoifjwe", "syslogng");

	//  Prepare the SQL query and run it against the DB
    $stmtSelectNew = $db_connection->prepare("SELECT * FROM syslogng.syslog_messages WHERE `priority` > ? LIMIT ?,?");
    //  Set priority to -128 if not defined
    $minPriority = isset($_GET["minPriority"]) ? $_GET["minPriority"] : -128;
    $stmtSelectNew->bind_param("iii", $minPriority, $_GET["minID"], $_GET["offset"]);
	if (!$stmtSelectNew->execute()){
        print($stmtSelectNew->error);
    };
    $result = $stmtSelectNew->get_result();

	//  Fill a temporary result array with the data retrieved
	while ($row = $result->fetch_array(MYSQLI_ASSOC)) {
	    $rows[] = json_encode($row);
	}

	//  Return JSON (if any results were received)
	if (isset($rows)) {
        print(json_encode($rows));
    }
    else {
        print("Hmm...");
    }
};


//  Returns up to offset rows, the oldest being the row with ID minID
//
//  Expects to have GET variables maxID, offset defined
//  Optionally expects minPriority

function returnMessagesOld() {

    //  Start the connection
    $db_connection = new mysqli("localhost", "syslog", "secoifjwe", "syslogng");

    //  Prepare the SQL query
    $stmtSelectOld = $db_connection->prepare("SELECT * FROM (SELECT * FROM `syslog_messages` WHERE `ID` < ? AND `priority` > ? ORDER BY `ID` DESC LIMIT 0,?) s ORDER BY ID;");
    //  Set priority to -128 if not defined
    $minPriority = isset($_GET["minPriority"]) ? $_GET["minPriority"] : -128;
    //  Bind the parameters and execute the statement
    $stmtSelectOld->bind_param("iii",$_GET["maxID"], $minPriority, $_GET["offset"]);
    $stmtSelectOld->execute();
    $result = $stmtSelectOld->get_result();
    //  Fill a temporary result array with the data retrieved
    while ($row = $result->fetch_array(MYSQLI_ASSOC)) {
        $rows[] = json_encode($row);
    }

    //  Return JSON (if any results were received)
    if (isset($rows)) {
        print( json_encode(  $rows ));
    } else {
        print("Hmmm...");
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

    //  Pre-prepare our queries
    $stmtSearchRegexes = $db_connection->prepare("SELECT `ID`, `priority` FROM syslogng.regexes WHERE `datestamp` = ? AND `host` = ? AND `program` = ? AND `pid` = ? AND `message` = ?");
    $stmtInsertRegex = $db_connection->prepare("INSERT INTO `syslogng`.`regexes` (`datestamp`, `host`, `program`, `pid`, `message`, `priority`) VALUES (?, ?, ?, ?, ?, ?)");
    $stmtUpdateRegexPri = $db_connection->prepare("UPDATE syslogng.regexes SET `priority` = ? WHERE `ID` = ?");

    //  Check for an identical regex
    $stmtSearchRegexes->bind_param("sssss", $_POST["datetime"], $_POST["host"], $_POST["program"], $_POST["pid"], $_POST["message"]);
    $stmtSearchRegexes->execute();
    $stmtSearchRegexesResult = $stmtSearchRegexes->get_result();

    if (!($stmtSearchRegexesResult->num_rows > 0)) {
        // Didn't find anything, so we'll insert our new regex
        $stmtInsertRegex->bind_param("sssssi", $_POST["datetime"], $_POST["host"], $_POST["program"], $_POST["pid"], $_POST["message"], $_POST["priority"]);
        // If there's an error return that, otherwise return "OK"
        print ($stmtInsertRegex->execute() ? json_encode("OK") : $stmtInsertRegex->error);
    } else {
        // There's already a matching regex, so we'll change the priority on that one
        $searchResult  = $stmtSearchRegexesResult->fetch_assoc();
        $stmtUpdateRegexPri->bind_param("ii", intval($searchResult["priority"] + $_POST["priority"]), $searchResult["ID"]);
        $stmtUpdateRegexPri->execute();
        print( json_encode("Found regex object $searchResult, updating with priority " . $_POST['priority']) );
    };

}

if (isset($_GET["command"])) {
	switch ($_GET["command"]) {
        case "getDbLen":
            returnDbLength();
            break;
        case "getMessagesNew":
            returnMessagesNew();
            break;
        case "getMessagesOld":
            returnMessagesOld();
            break;
        case "regexAdd":
            echo "regexAdd's not here man...";
            break;
        default:
            echo "Received a GET command I didn't understand.";
    }
} elseif (isset($_POST["command"])) {
    switch ($_POST["command"]) {
        case "regexAdd":
            regexAdd();
            break;
        default:
            echo "Received a POST command I didn't understand.";
    }
} else {
    echo "&ltlurch&gt You rang? &lt/lurch&gt";
}


?>
