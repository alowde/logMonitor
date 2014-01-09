#!/usr/bin/perl -w

use strict;
use v5.10;

use threads;
use Thread::Queue;
use Thread::Queue::Any;
use threads::shared;

my $messageQueue = Thread::Queue::Any->new();

#	Need to set up code for automatically determining 
my $thread1 = threads->create(\&sqlInput);
my $thread2 = threads->create(\&sqlOutput);

#   Lock variable, exists only for locking between threads
our $dblock :shared;

$thread1->join();

#sub fileInput {
#
#    require File::Tail;
#    File::Tail->import();
#
#    $file=File::Tail->new("/root/testfile");
#
#    while (defined( $line=$file->read) ) {
#    	$messageQueue->enqueue($line);
#    }
#}
	


sub sqlInput {

    require DBI;
    DBI->import();

#   Get the regexes we'll be using
    my @regexes = initialiseRegexes();

#   Prepare the database connection and select statements
    my $dbConnection = DBI->connect('dbi:mysql:syslogng','syslog','secoifjwe')
                            or die "Read thread " . threads->tid() . " died after failing to connect to database\n";
    my $sqlSelect = "SELECT * FROM `syslog_messages_incoming` LIMIT 0, 1;";
    my $sqlDelete = "DELETE FROM `syslog_messages_incoming` WHERE `ID` = ?;";
    my $selectStatement = $dbConnection->prepare($sqlSelect);
    my $deleteStatement = $dbConnection->prepare($sqlDelete);

    do {
       
#	Declare initial variables	   
        my @message;

#   	Lock the database connection while we grab a row and delete it        
{        
        lock ($dblock);
         
#        $selectStatement->execute or die "Read thread " . threads->tid() . " died after failing to run a select statement";

#	Return one row from the database        
#        @message = $selectStatement->fetchrow_array;

        do {             #die "No rows found" };	# Not particularly sensible. Needs to wait instead, and preferably wait an amount of time that corresponds with how busy we are

        $selectStatement->execute or die "Read thread " . threads->tid() . " died after failing to run a s";

        #   Return one row from the database        
        @message = $selectStatement->fetchrow_array;

        unless (@message) { sleep 1;};
        
        } while !(@message);



#	Delete same row from database, identified by ID
        $deleteStatement->execute($message[0]) or die "Write thread " . threads->tid() . " died after failing to run a delete statement";

}
#	The lock is released once we go out of scope as defined by the braces {}
#	Another thread can now make a query without concern that it might grab the same row

#       Initialisation - set starting processed value, scanned value and starting priority to 0
        my $i = 0;
        unless ($message[8]) { $message[8] = 0 };
        unless ($message[6]) { $message[6] = 0 };

#       Check each regexes for match
        foreach (@regexes) {

            if (($message[5] =~ /$_->{message}/) and     #  Likely to not match, so we check it first
                ($message[1] =~ /$_->{datestamp}/) and
                ($message[2] =~ /$_->{host}/) and
                ($message[3] =~ /$_->{program}/) and
                ($message[4] =~ /$_->{pid}/)) {
                
                 $message[8] += $_->{priority}           #  If we match all regexes, increment or decrement as appropriate
            }
            $i++                                            #  For every regex, matched or not, increment the number of regexes checked
        };

        $message[7] = $i;                                    #  Set processed according to the number of regexes checked
    
        $messageQueue->enqueue(@message);  		#  Pop the message onto the queue for processing   

    } while 1;						#  Currently the thread loops infinitely. This can probably be better implemented
							#  Priorities are - maintaining a small number of long-running threads
							#		  - gracefully recovering from errors by restarting threads if appropriate

}


sub sqlOutput {

#   Outputting to normal mySQL table

    require DBI;
    DBI->import();

#   Prepare the database connection and insert statements
    my $dbConnection = DBI->connect('dbi:mysql:syslogng','syslog','secoifjwe')
                            or die "Failed to connect to database for message output, error: " . $DBI::err . "\n";
    my $sqlInsertOne = "INSERT INTO `syslogng`.`syslog_messages` (`ID`, `datetime`, `host`, `program`, `pid`, `message`, `scanned`, `processed`, `priority`) VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?); ";
    my $sqlInsertFive = "INSERT INTO `syslogng`.`syslog_messages` (`ID`, `datetime`, `host`, `program`, `pid`, `message`, `scanned`, `processed`, `priority`) VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?), (NULL, ?, ?, ?, ?, ?, ?, ?, ?), (NULL, ?, ?, ?, ?, ?, ?, ?, ?), (NULL, ?, ?, ?, ?, ?, ?, ?, ?), (NULL, ?, ?, ?, ?, ?, ?, ?, ?);"; 


#  Only using InsertOne at the moment, need to check the queue and decide what to use.
	my $statement = $dbConnection->prepare($sqlInsertOne);

    do {

#  Grab a message off the queue. Will block until a message is available
	my @message = $messageQueue->dequeue;

#  Binding parameters starting at 1 as we don't try to insert the ID.

	for (my $i=1; $i<=8; $i++) {
	    $statement->bind_param( $i, $message[$i]);
	}
   
#  Try to actually insert the value

	$statement->execute or die "Write thread died after failing to write a message to the main database";

    } while 1;

}

sub consoleOutput {

#   Output function used in debugging, dumps all messages to console
#   THIS MEANS THEY WILL BE LOST

    do {
	say $messageQueue->dequeue;
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
