#!/usr/bin/perl -w

use strict;
use v5.10;
# use DBI;

use threads;
use Thread::Queue;
use Thread::Queue::Any;
use threads::shared;

my $messageQueue = Thread::Queue::Any->new();


my $thread1 = threads->create(\&inbound1);

#   Lock variable, exists only for locking between threads
our $dblock :shared;

$thread1->join();

sub inbound1 {

    require DBI;
    DBI->import();

#   Get the regexes we'll be using
    my @regexes = initialiseRegexes();

#   Prepare the database connection and select statements
    my $dbConnection = DBI->connect('dbi:mysql:syslogng','syslog','secoifjwe')
                            or die "Failed to connect to database when getting new messages\n";
    my $sqlSelect = "SELECT * FROM `syslog_messages_incoming` LIMIT 0, 1;";
    my $sqlDelete = "DELETE FROM `syslog_messages_incoming` WHERE `ID` = ?;";
    my $selectStatement = $dbConnection->prepare($sqlSelect);
    my $deleteStatement = $dbConnection->prepare($sqlDelete);

    do {
       
#   Lock the database connection while we grab a row and delete it

        my @result;
        
{        
        lock ($dblock);
         
        $selectStatement->execute or die "Thread " . threads->tid() . " died while failing to run a select statement)";
        
        @result = $selectStatement->fetchrow_array;

        unless (@result) { die "No rows found" };

        $deleteStatement->execute($result[0]) or die "Thread " . threads->tid() . " died while failing to run a delete statement";

}
#       Initialisation - set starting processed value, scanned value and starting priority to 0
        my $i = 0;
        unless ($result[8]) { $result[8] = 0 };
        unless ($result[6]) { $result[6] = 0 };

#       Check each regexes for match
        foreach (@regexes) {

            if (($result[5] =~ /$_->{message}/) and     #  Likely to fail, so we check it first
                ($result[1] =~ /$_->{datestamp}/) and
                ($result[2] =~ /$_->{host}/) and
                ($result[3] =~ /$_->{program}/) and
                ($result[4] =~ /$_->{pid}/)) {
                
                 $result[8] += $_->{priority}              #  If we match all regexes, increment or decrement as appropriate
            }
            $i++                                            #  For every regex, matched or not, increment the number of regexes checked
        };

        $result[7] = $i;                                    #  Set processed according to the number of regexes checked
    
        $messageQueue->enqueue(@result);     

    } while 1;

}

sub initialiseRegexes {

#   Set up database
    require DBI;
    DBI->import();

    my @returnArray;

    my $dbConnection = DBI->connect('dbi:mysql:syslogng','syslog','secoifjwe')
                            or die "Failed to connect to database when initialising regexes\n";

#   Grab all regexes from table
    my $sql = "SELECT * FROM `regexes`";
    my $statement = $dbConnection->prepare($sql);

    $statement->execute or die "Failed to load regexes from table";

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
