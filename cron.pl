#!/usr/bin/perl -w

use strict;
use v5.10;

use DBI;
use File::Pid;

use sigtrap qw(handler clean_stop normal-signals);

#  PID file handler
my $pidfile = File::Pid->new({
    file => '/var/run/cron.pid',
});
if ( my $num = $pidfile->running ) {
    clean_stop("cron.pl appears to already be running, PID $num was recorded in /var/run/cron.pid\n");
}
$pidfile->write;


#   Prepare the database connection and select statements
    my $dbConnection = DBI->connect('dbi:mysql:syslogng','syslog','secoifjwe')
                            or clean_stop("Failed to connect to database\n");
	#  sqlMinProcessed finds the number of the least processed record in the table
    my $sqlMinProcessed = "SELECT MIN(`processed`) FROM `syslog_messages`;";
	#  For maximum speed, where possible we avoid running a regex against multiple fields.
	#  This is believed to save time by avoiding MySQL searching for the regex ".*", which
	#  should match all fields anyway.
	
	#  When we do have to run against multiple fields we currently just run regex against 
	#  all of them. 
	
	#  Processing `message` first in this case is useful as it's likely to
	#  fail early, short-cutting the query.
    my $sqlUpdateAll = "UPDATE DELAYED `syslog_messages` SET `priority` = `priority` + :priority, `processed` = :procS WHERE `processed` = procC AND `message` REGEXP :message AND `host` REGEXP :host AND `program` REGEXP :program AND `pid` REGEXP :pid AND `datetime` REGEXP :datetime;";
    my $sqlUpdateDatetime = "UPDATE DELAYED `syslog_messages` SET `priority` = `priority` + ?, `processed` = ? WHERE `processed` = ? AND `datetime` REGEXP ?;";
	my $sqlUpdateHost = "UPDATE DELAYED `syslog_messages` SET `priority` = `priority` + ?, `processed` = ? WHERE `processed` = ? AND `host` REGEXP ?;";
	my $sqlUpdateProgram = "UPDATE DELAYED `syslog_messages` SET `priority` = `priority` + ?, `processed` = ? WHERE `processed` = ? AND `program` REGEXP ?;";
	my $sqlUpdatePid = "UPDATE DELAYED `syslog_messages` SET `priority` = `priority` + ?, `processed` = ? WHERE `processed` = ? AND `pid` REGEXP ?;";
	my $sqlUpdateMessage = "UPDATE DELAYED `syslog_messages` SET `priority` = `priority` + ?, `processed` = ? WHERE `processed` = ? AND `message` REGEXP ?;";
	
	my $sqlMinProcessedStatement = $dbConnection->prepare($sqlMinProcessed);
	my $sqlUpdateAllStatement = $dbConnection->prepare($sqlUpdateAll);
    my $sqlUpdateDatetimeStatement = $dbConnection->prepare($sqlUpdateDatetime);
	my $sqlUpdateHostStatement = $dbConnection->prepare($sqlUpdateHost);
	my $sqlUpdateProgramStatement = $dbConnection->prepare($sqlUpdateProgram);
	my $sqlUpdatePid Statement = $dbConnection->prepare($sqlUpdatePid);
	my $sqlUpdateMessageStatement = $dbConnection->prepare($sqlUpdateMessage);

#   Get the regexes we'll be using
    my @regexes = initialiseRegexes();

    do {
        $sqlMinProcessedStatement->execute or clean_stop("Unable to find out least-processed row");
		my $minProc = $sqlMinProcessedStatement->fetchrow_array)[0]
		for (my $i = $minProc + 1; $i < $regexes; $i++) { #  If any rows have a lower processed number than the number of regexes:
					
			if (($regexes[$i]{message} != ".*") 
				and ($regexes[$i]{host} = ".*") 
				and ($regexes[$i]{program} = ".*") 
				and ($regexes[$i]{pid} = ".*") 
				and ($regexes[$i]{datetime} = ".*")) {	  #  We can use the faster UpdateMessage statement and save the DB server some time searching.
					
		
		
		
        @message = $selectStatement->fetchrow_array;  #   Return one row from the database
        unless (@message) { sleep 1;};                #   If we haven't received a row, wait a second before trying again
    
    } while 1;

	
sub initialiseRegexes {

    my @returnArray;

    my $dbConnection = DBI->connect('dbi:mysql:syslogng','syslog','secoifjwe')
                            or clean_stop("Failed to connect to database when initialising regexes\n");

#   Grab all regexes from table
    my $sql = "SELECT * FROM `regexes`";
    my $statement = $dbConnection->prepare($sql);

    $statement->execute or clean_stop("Failed to load regexes from table");

#   Push each regex onto the return array as a set of key-value pairs
    while (my @row = $statement->fetchrow_array) {
        push @returnArray, {
                id          => $row[0],
                datestamp   => $row[1],
                host        => $row[2],
                program     => $row[3],
                pid         => $row[4],
                message     => $row[5],
                processed   => $row[6],
                priority    => $row[7],
        };
    };

    return @returnArray;
}

sub clean_stop {

    $dbConnection->disconnect();
    $pidfile->remove or say "Warning! Couldn't remove PID file, will need to be deleted manually";
    my $die_message = $_ ? $_ : "Received kill signal, exiting gracefully.\n";
    exit $die_message;

}
