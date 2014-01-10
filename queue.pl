#!/usr/bin/perl -w

use strict;
use v5.10;

use DBI;
use File::Pid;

use sigtrap qw(handler clean_stop normal-signals);

#  PID file handler

my $pidfile = File::Pid->new({
    file => '/var/run/queue.pid',
});
if ( my $num = $pidfile->running ) {
    clean_stop("queue.pl appears to already be running, PID $num was recorded in /var/run/queue.pid\n");
}
$pidfile->write;


#   Prepare the database connection and select statements
    my $dbConnection = DBI->connect('dbi:mysql:syslogng','syslog','secoifjwe')
                            or clean_stop("Process after failing to connect to database\n");
    my $sqlSelect = "SELECT * FROM `syslog_messages_incoming` LIMIT 0, 1;";
    my $sqlDelete = "DELETE FROM `syslog_messages_incoming` WHERE `ID` = ?;";
    my $sqlInsertOne = "INSERT INTO `syslogng`.`syslog_messages` (`ID`, `datetime`, `host`, `program`, `pid`, `message`, `scanned`, `processed`, `priority`) VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?); ";
    my $selectStatement = $dbConnection->prepare($sqlSelect);
    my $deleteStatement = $dbConnection->prepare($sqlDelete);
    my $insertStatement = $dbConnection->prepare($sqlInsertOne);


#   Get the regexes we'll be using
    my @regexes = initialiseRegexes();

#   Main program loop

    do {
       
        my @message;
        do {                                              #   SELECT loop will repeat until we get a row
            $selectStatement->execute or clean_stop("Read thread died after failing to run a s");
            @message = $selectStatement->fetchrow_array;  #   Return one row from the database
            unless (@message) { sleep 1;};                #   If we haven't received a row, wait a second before trying again
        
        } while !(@message);

        #  Delete same row from temporary table, identified by ID
        $deleteStatement->execute($message[0]) or clean_stop("Write thread died after failing to run a delete statement");

        #  Initialisation - set starting processed value, scanned value and starting priority to 0
        my $i = 0;
        unless ($message[8]) { $message[8] = 0 };
        unless ($message[6]) { $message[6] = 0 };

        #  Check each regexes for match
        foreach (@regexes) {

            if (($message[5] =~ /$_->{message}/) and     #  Likely to not match, so we check it first
                ($message[1] =~ /$_->{datestamp}/) and
                ($message[2] =~ /$_->{host}/) and
                ($message[3] =~ /$_->{program}/) and
                ($message[4] =~ /$_->{pid}/)) {
                 $message[8] += $_->{priority}           #  If we match all regexes, increment or decrement as appropriate
            }
            $i++                                         #  For every regex, matched or not, increment the number of regexes checked
        };
        $message[7] = $i;                                #  Set processed according to the number of regexes checked
    


        #  Outputting to normal mySQL table
        #  Binding parameters starting at 1 as we don't try to insert the ID.
	    for (my $i=1; $i<=8; $i++) {
	        $insertStatement->bind_param( $i, $message[$i]);
        }
           
        #  Try to actually insert the value
        $insertStatement->execute or clean_stop("Write died after failing to write a message to the main database");

    } while 1;  #  Currently not ever breaking out of the loop


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
